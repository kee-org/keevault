const fs = require('fs');

function replaceFont(css) {
    css.walkAtRules('font-face', rule => {
        const fontFamily = rule.nodes.filter(n => n.prop === 'font-family')[0];
        if (!fontFamily) {
            throw 'Font rule missing font-face: ' + rule.toString();
        }
        const value = fontFamily.value.replace(/["']/g, '');
        const fontFiles = {
            'Font Awesome 5 Brands': 'fa-brands-400.woff2',
            'Font Awesome 5 Free': {
                '400': 'fa-regular-400.woff2',
                '900': 'fa-solid-900.woff2'
            }
        };
        let fontFile = fontFiles[value];
        if (!fontFile) {
            throw 'Unsupported font ' + value + ': ' + rule.toString();
        }
        if (typeof fontFile !== 'string') {
            const fontWeight = rule.nodes.filter(n => n.prop === 'font-weight')[0];
            if (!fontWeight) {
                throw 'Font rule missing font-weight: ' + rule.toString();
            }
            fontFile = fontFile[fontWeight.value];
            if (!fontFile) {
                throw 'Unsupported font ' + value + ': ' + rule.toString();
            }
        }
        const data = fs.readFileSync('tmp/fonts/' + fontFile, 'base64');
        const src = 'url(data:application/font-woff2;charset=utf-8;base64,{data}) format(\'woff2\')'
            .replace('{data}', data);
        rule.nodes = rule.nodes.filter(n => n.prop !== 'src');
        rule.append({ prop: 'src', value: src });
    });
}

module.exports = replaceFont;
