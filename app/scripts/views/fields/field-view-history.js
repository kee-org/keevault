const FieldView = require('./field-view');
const Locale = require('../../util/locale');

const FieldViewHistory = FieldView.extend({
    getHistoryDescription: function(value) {
        if (!value.length) {
            return Locale.detHistoryEmpty;
        }
        let text = value.length + ' ' + (value.length % 10 === 1 ? Locale.detHistoryRec : Locale.detHistoryRecs);
        if (value.unsaved) {
            text += ' (' + Locale.detHistoryModified + ')';
        }
        return text;
    },

    renderValue: function(value) {
        return '<a class="details__history-link">' + this.getHistoryDescription(value) + '</a>';
    },

    getClipboardValue: function () {
        return this.getHistoryDescription(this.getValue());
    },

    readonly: true
});

module.exports = FieldViewHistory;
