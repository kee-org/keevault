const FieldViewText = require('./field-view-text');

const FieldViewUrl = FieldViewText.extend({
    displayUrlRegex: /^https?:\/\//i,

    renderValue: function(value) {
        const fixedUrl = this.fixUrl(value);
        return value ? '<a href="' + _.escape(fixedUrl) + '" rel="noreferrer noopener" target="_blank"' +
            (fixedUrl.startsWith('http://') ? 'class="insecureLink">' : '>') +
            _.escape(this.displayUrl(value)) + '</a>' : '';
    },

    fixUrl: function(url) {
        return this.displayUrlRegex.test(url) ? url : 'http://' + url;
    },

    displayUrl: function(url) {
        return url.replace(this.displayUrlRegex, '');
    }
});

module.exports = FieldViewUrl;
