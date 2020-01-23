const FieldView = require('./field-view');

const FieldViewReadOnly = FieldView.extend({
    renderValue: function(value) {
        const val = value.isProtected ? new Array(value.textLength + 1).join('•') : _.escape(value);
        return val.replace(/\n/g, '<br/>');
    },

    readonly: true
});

module.exports = FieldViewReadOnly;
