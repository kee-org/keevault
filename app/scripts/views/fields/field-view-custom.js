const Backbone = require('backbone');
const FieldViewText = require('./field-view-text');
const FieldViewBrowser = require('./field-view-browser');
const FieldView = require('./field-view');
const Keys = require('../../const/keys');
const kdbxweb = require('kdbxweb');
const Locale = require('../../util/locale');
const PasswordGenerator = require('../../util/password-generator');
const Logger = require('../../util/logger');

const logger = new Logger('field-view-custom');

const FieldViewCustom = FieldViewBrowser.extend({
    events: {
        'mousedown .details__field-label': 'fieldLabelMousedown'
    },

    initialize: function(opts) {
        _.extend(this.events, FieldViewText.prototype.events);
        FieldViewBrowser.prototype.initialize.call(this, opts);
    },

    renderValue: function(value) {
        if (this.browserFieldModel) {
            if (this.browserFieldModel.get('type') === 'FFTcheckbox') {
                return this.model.value() === 'KEEFOX_CHECKED_FLAG_TRUE' ? Locale.enabled : Locale.disabled;
            } else if (this.browserFieldModel.get('type') === 'FFTpassword') {
                return this.model.value() ? PasswordGenerator.present(this.model.value().length) : '';
            } else {
                return this.model.value();
            }
        } else {
            return FieldViewText.prototype.renderValue.call(this, value);
        }
    },

    getValueSource: function(fieldName) {
        if (this.browserIntegrationEnabled) {
            return 'BrowserFieldOnly';
        }
        return 'KdbxFieldOnly';
    },

    onBrowserIntegrationEnabled: function () {
        this.browserIntegrationEnabled = true;
        this.renderProtectedValueParaphernalia();
    },

    onBrowserIntegrationDisabled: function () {
        this.browserIntegrationEnabled = false;
        if (this.input.attr('type') === 'checkbox') {
            this.onBrowserFieldTypeChangedFromCheckbox();
        }
        this.renderProtectedValueParaphernalia();
    },

    startEdit: function() {
        FieldViewText.prototype.startEdit.call(this);
        this.$el.addClass('details__field--can-edit-title');
        this.renderProtectedValueParaphernalia();
    },

    endEdit: function(newVal, extra) {
        this.$el.removeClass('details__field--can-edit-title');
        extra = _.extend({}, extra);
        if (this.model.titleChanged || this.model.newField) {
            extra.newField = this.model.title;
        }
        if (!this.editing) {
            return;
        }

        // If attached model is just the default settings, delete it
        if (!this.browserIntegrationEnabled) {
            this.browserFieldModel = null;
        }

        if (this.browserFieldView) {
            logger.error('this.browserFieldView == true when it should not!');
            this.browserFieldView.remove();
            this.browserFieldView = null;
        }

        delete this.input;
        this.stopListening(Backbone, 'click', this.fieldValueBlur);
        if (typeof newVal === 'string') {
            if (this.isProtected) {
                newVal = kdbxweb.ProtectedValue.fromString(newVal);
            } else {
                newVal = $.trim(newVal);
            }
        }
        FieldView.prototype.endEdit.call(this, newVal, extra);
        if (this.model.titleChanged) {
            delete this.model.titleChanged;
        }
    },

    // "Title" refers to the DisplayName of this field, not the Title of the entry
    startEditTitle: function(emptyTitle) {
        const text = emptyTitle ? '' : this.model.title || '';
        this.labelInput = $('<input/>');
        this.labelEl.html('').append(this.labelInput);
        this.labelInput.attr({ autocomplete: 'off', spellcheck: 'false' })
            .val(text).focus()[0].setSelectionRange(text.length, text.length);
        this.labelInput.bind({
            input: this.fieldLabelInput.bind(this),
            keydown: this.fieldLabelKeydown.bind(this),
            keypress: this.fieldLabelInput.bind(this),
            mousedown: this.fieldLabelInputClick.bind(this),
            click: this.fieldLabelInputClick.bind(this)
        });
    },

    endEditTitle: function(newTitle) {
        if (newTitle && newTitle !== this.model.title) {
            this.model.title = newTitle;
            this.model.titleChanged = true;
        }
        this.$el.find('.details__field-label').text(this.getDisplayTitle(this.model.title));
        delete this.labelInput;
        if (this.editing && this.input) {
            this.input.focus();
        }
    },

    fieldLabelClick: function(e) {
        e.stopImmediatePropagation();
        if (this.model.newField) {
            this.startEditTitle(true);
        } else if (this.editing) {
            this.startEditTitle();
        } else {
            FieldViewText.prototype.fieldLabelClick.call(this, e);
        }
    },

    fieldLabelMousedown: function(e) {
        if (this.editing) {
            e.stopPropagation();
        }
    },

    fieldValueBlur: function() {
        if (this.labelInput) {
            this.endEditTitle(this.labelInput.val());
        }
        if (this.input) {
            this.closeEditor(this.getInputValue());
        }
    },

    fieldLabelInput: function(e) {
        e.stopPropagation();
    },

    fieldLabelInputClick: function(e) {
        e.stopPropagation();
    },

    fieldLabelKeydown: function(e) {
        e.stopPropagation();
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            this.endEditTitle(e.target.value);
        } else if (code === Keys.DOM_VK_ESCAPE) {
            this.endEditTitle();
        } else if (code === Keys.DOM_VK_TAB) {
            e.preventDefault();
            this.endEditTitle(e.target.value);
        }
    },

    fieldValueInputClick: function() {
        if (this.labelInput) {
            this.endEditTitle(this.labelInput.val());
        }
        FieldViewText.prototype.fieldValueInputClick.call(this);
    },

    protectBtnClick: function(e) {
        e.stopPropagation();
        this.isProtected = !this.isProtected;
        this.$el.toggleClass('details__field--protected', this.isProtected);
        e.currentTarget.setAttribute('title', this.isProtected ? Locale.unprotectField : Locale.protectField);
        if (this.labelInput) {
            this.endEditTitle(this.labelInput.val());
        }
        this.setTimeout(function() { this.input.focus(); });
    }

});

module.exports = FieldViewCustom;
