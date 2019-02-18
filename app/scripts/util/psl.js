const suffixList = require('../comp/publicsuffixlist');
const punycode = require('punycode/');
const pslData = require('../const/pslData');

suffixList.parse(pslData.text, punycode.toASCII);

const PSL = {
    getDomain: suffixList.getDomain
};

module.exports = PSL;
