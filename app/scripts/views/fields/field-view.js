const Backbone = require('backbone');
const CopyPaste = require('../../comp/copy-paste');
const Tip = require('../../util/tip');
const Locale = require('../../util/locale');

const FieldView = Backbone.View.extend({
    template: require('templates/details/field.hbs'),

    events: {
        'click .details__field-label': 'fieldLabelClick',
        'click .details__field-value': 'fieldValueClick',
        'dragstart .details__field-label': 'fieldLabelDrag'
    },

    getValue: function () {
        return typeof this.model.value === 'function' ? this.model.value() : this.model.value;
    },

    getClipboardValue: function () {
        const value = this.getValue();

        if (value && value.isProtected) {
            return value.getText();
        }
        return value;
    },

    getValueSource: function () {
        return 'KdbxFieldOnly';
    },

    getDisplayTitle: function (title) {
        return title || Locale.unnamedField;
    },

    render: function() {
        this.value = this.getValue();
        this.renderTemplate({ editable: !this.readonly, multiline: this.model.multiline, title: this.getDisplayTitle(this.model.title),
            canEditTitle: this.model.newField, protect: this.value && this.value.isProtected });
        this.valueEl = this.$el.find('.details__field-value');
        this.valueEl.html(this.renderValue(this.value));
        this.labelEl = this.$el.find('.details__field-label');
        if (this.model.tip) {
            this.tip = typeof this.model.tip === 'function' ? this.model.tip() : this.model.tip;
            if (this.tip) {
                this.valueEl.attr('title', this.tip);
                Tip.createTip(this.valueEl);
            }
        }
        return this;
    },

    remove: function() {
        if (this.tip) {
            Tip.hideTip(this.valueEl[0]);
        }
        Backbone.View.prototype.remove.apply(this, arguments);
    },

    update: function() {
        if (typeof this.model.value === 'function') {
            const newVal = this.model.value();
            if (!_.isEqual(newVal, this.value) || (this.value && newVal && this.value.toString() !== newVal.toString())) {
                this.render();
            }
        }
    },

    fieldLabelClick: function(e) {
        e.stopImmediatePropagation();
        if (this.preventCopy) {
            return;
        }
        const field = this.model.name;
        if (field) {
            const text = this.getClipboardValue();

            if (!text) {
                return;
            }
            if (!CopyPaste.simpleCopy) {
                CopyPaste.createHiddenInput(text);
            }
            const copyRes = CopyPaste.copy(text);
            this.trigger('copy', { source: this, copyRes: copyRes });
        }
    },

    fieldValueClick: function(e) {
        if (['a', 'input', 'textarea', 'label'].indexOf(e.target.tagName.toLowerCase()) >= 0) {
            return;
        }
        const sel = window.getSelection().toString();
        if (!sel) {
            this.edit();
        }
    },

    fieldLabelDrag: function(e) {
        e.stopPropagation();
        if (!this.value) {
            return;
        }
        const dt = e.originalEvent.dataTransfer;
        const txtval = this.getClipboardValue();
        if (this.valueEl[0].tagName.toLowerCase() === 'a') {
            dt.setData('text/uri-list', txtval);
        }
        dt.setData('text/plain', txtval);
        dt.effectAllowed = 'copy';
    },

    edit: function() {
        if (this.readonly || this.editing) {
            return;
        }
        this.$el.addClass('details__field--edit');
        this.editStartValueSource = this.getValueSource();
        this.startEdit();
        this.editing = true;
        this.preventCopy = true;
        this.labelEl[0].setAttribute('draggable', 'false');
    },

    endEdit: function(newVal, extra) {
        if (!this.editing) {
            return;
        }
        this.editing = false;
        setTimeout(() => { this.preventCopy = false; }, 300);
        let textEqual;
        if (this.value && this.value.isProtected) {
            textEqual = this.value.equals(newVal);
        } else if (newVal && newVal.isProtected) {
            textEqual = newVal.equals(this.value);
        } else {
            textEqual = _.isEqual(this.value, newVal);
        }
        const protectedEqual = (newVal && newVal.isProtected) === (this.value && this.value.isProtected);
        const nameChanged = extra && extra.newField;
        let valueSourceChanged = false;
        if (this.editStartValueSource !== this.getValueSource()) {
            valueSourceChanged = true;
        }

        let arg;
        if (newVal !== undefined && (!textEqual || !protectedEqual || nameChanged || valueSourceChanged)) {
            arg = { val: newVal, field: this.model.name };
            if (extra) {
                _.extend(arg, extra);
            }
        } else if (extra) {
            arg = extra;
        }
        if (arg) {
            this.triggerChange(arg);
        }
        this.valueEl.html(this.renderValue(this.value));
        this.$el.removeClass('details__field--edit');
        this.labelEl[0].setAttribute('draggable', 'true');
    },

    triggerChange: function(arg) {
        arg.sender = this;
        this.trigger('change', arg);
    }
});

module.exports = FieldView;
