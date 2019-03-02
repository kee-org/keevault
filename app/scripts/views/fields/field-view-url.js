const FieldViewText = require('./field-view-text');

const FieldViewUrl = FieldViewText.extend({
    displayUrlRegex: /^https?:\/\//i,

    renderValue: function(value) {
        return value ? '<a href="' + _.escape(this.fixUrl(value)) + '" rel="noreferrer noopener" target="_blank">' + _.escape(this.displayUrl(value)) + '</a>' : '';
    },

    fixUrl: function(url) {
        return this.displayUrlRegex.test(url) ? url : 'http://' + url;
    },

    displayUrl: function(url) {
        return url.replace(this.displayUrlRegex, '');
    }
});

module.exports = FieldViewUrl;
