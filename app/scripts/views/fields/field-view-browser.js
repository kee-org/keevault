const FieldViewText = require('./field-view-text');
const kdbxweb = require('kdbxweb');
const BrowserIntegrationView = require('./browser-integration-view');
const BrowserFieldModel = require('../../models/browser-addon/browser-field-model');
const KeyHandler = require('../../comp/key-handler');
const Keys = require('../../const/keys');
const Locale = require('../../util/locale');

const FieldViewBrowser = FieldViewText.extend({

    initialize: function(opts) {
        this.browserFieldModel = opts.browserFieldModel;
        this.displayGlobalPlaceholderOption = opts.displayGlobalPlaceholderOption;

        this.browserIntegrationEnabled = false;
        if (this.browserFieldModel) {
            this.browserIntegrationEnabled = true;
        }
        this.prepareBrowserIntegrationSettings();
    },

    getInputValue: function() {
        if (this.browserIntegrationEnabled && this.input.attr('type') === 'checkbox') {
            return this.input[0].checked ? 'KEEFOX_CHECKED_FLAG_TRUE' : 'KEEFOX_CHECKED_FLAG_FALSE';
        } else {
            return this.input.val();
        }
    },

    render: function() {
        FieldViewText.prototype.render.call(this);
        return this;
    },

    prepareBrowserIntegrationSettings: function() {
        if (!this.browserFieldModel) {
            this.browserFieldModel = new BrowserFieldModel({
                displayName: this.getBrowserFieldDisplayName(),
                name: '',
                type: this.getBrowserFieldTypeDefault(),
                fieldId: '',
                page: -1,
                placeholderHandling: 'Default'
            });
        }
    },

    browserIntegrationConfigured: function () {
        if (!this.browserFieldModel) {
            return false;
        }
        if (this.browserFieldModel.fieldId === '' &&
            this.browserFieldModel.name === '' &&
            this.browserFieldModel.placeholderHandling === 'Default' &&
            this.browserFieldModel.page === -1) {
            return false;
        }
        return true;
    },

    getBrowserFieldDisplayName: function() {
        if (this.model.name === '$Password') return 'KeePass password';
        else if (this.model.name === '$UserName') return 'KeePass username';
        else return '';
    },

    getBrowserFieldTypeDefault: function() {
        if (this.model.name === '$Password') return 'FFTpassword';
        else if (this.model.name === '$UserName') return 'FFTusername';
        else return 'FFTtext';
    },

    // NEVER call this after initial edit rendering has begun. Directly call renderCheckbox or FieldViewText.prototype.renderInput instead.
    renderInput: function(text, isProtected) {
        this.valueEl.html('');
        if (this.browserFieldModel && this.browserFieldModel.get('type') === 'FFTcheckbox') {
            const checked = text === 'KEEFOX_CHECKED_FLAG_TRUE';
            this.renderCheckbox(checked);
        } else {
            FieldViewText.prototype.renderInput.call(this, text, isProtected);
        }
        this.openBrowserFieldView();
    },

    renderCheckbox: function(checked) {
        this.input = $(document.createElement('input'));
        this.input.attr('type', 'checkbox');
        this.input.attr('id', 'FFTcheckbox_value');
        if (checked) this.input.attr({ checked });
        const label = $(document.createElement('label'));
        label.attr('for', 'FFTcheckbox_value');
        label.bind({
            mousedown: this.fieldValueCheckboxMouseDown.bind(this)
        });

        this.valueEl.prepend(label);
        this.valueEl.prepend(this.input);

        this.input.bind({
            mousedown: this.fieldValueCheckboxMouseDown.bind(this)
        });
    },

    openBrowserFieldView: function () {
        // Back and forth form settings enabling can leave us without a default model so this
        // ensures we're in a good state to open this no matter how many times it happens
        this.prepareBrowserIntegrationSettings();

        const fieldRect = this.input[0].getBoundingClientRect();

        if (this.browserFieldView) this.browserFieldView.remove();
        this.browserFieldView = new BrowserIntegrationView({
            model: this.browserFieldModel,
            pos: {left: fieldRect.left, top: fieldRect.bottom},
            displayGlobalPlaceholderOption: this.displayGlobalPlaceholderOption
        }).render();

        this.$el.find('.details__field-value')
        .append($('<div class="details__field-value-autocomplete-space"></div>'))
        .append(this.browserFieldView.el);

        this.browserFieldView.once('remove', this.browserFieldViewClosed.bind(this));
        this.listenTo(this.browserFieldView, 'changeToCheckbox', this.onBrowserFieldTypeChangedToCheckbox);
        this.listenTo(this.browserFieldView, 'changeFromCheckbox', this.onBrowserFieldTypeChangedFromCheckbox);
        this.listenTo(this.browserFieldView, 'integrationEnabled', this.onBrowserIntegrationEnabled);
        this.listenTo(this.browserFieldView, 'integrationDisabled', this.onBrowserIntegrationDisabled);
    },

    fieldValueCheckboxMouseDown: function(e) {
        e.stopPropagation();
    },

    onBrowserIntegrationEnabled: function () {
        this.browserIntegrationEnabled = true;
    },

    onBrowserIntegrationDisabled: function () {
        this.browserIntegrationEnabled = false;
    },

    onBrowserFieldTypeChangedToCheckbox: function () {
        this.valueEl.children('label,input').remove();
        this.renderCheckbox(false);
    },

    onBrowserFieldTypeChangedFromCheckbox: function () {
        this.valueEl.children('label,input').remove();
        FieldViewText.prototype.renderInput.call(this, '', false);
    },

    browserFieldViewClosed: function() {
        if (this.browserFieldView) {
            delete this.browserFieldView;
        }
        this.endEdit(this.getInputValue());
    },

    renderProtectedValueParaphernalia: function () {
        this.$el.find('.details__field-value-btn.details__field-value-btn-protect').remove();
        if (this.browserIntegrationEnabled) {
            this.$el.toggleClass('details__field--protected', false);
            return;
        }

        if (this.isProtected === undefined) {
            this.isProtected = this.value instanceof kdbxweb.ProtectedValue;
        }
        this.$el.toggleClass('details__field--protected', this.isProtected);
        $('<div/>').addClass('details__field-value-btn details__field-value-btn-protect')
            .attr('title', this.isProtected ? Locale.unprotectField : Locale.protectField)
            .appendTo(this.valueEl)
            .mousedown(this.protectBtnClick.bind(this));
    },

    closeEditor: function (value) {
        if (this.browserFieldView) {
            this.browserFieldView.closing();
            this.browserFieldView.remove();
            this.browserFieldView = null;
        } else {
            this.endEdit(value);
        }
    },

    fieldValueBlur: function() {
        if (!this.gen && this.input) {
            this.closeEditor(this.getInputValue());
        }
    },

    externalEndEdit: function() {
        if (this.input) {
            this.closeEditor(this.getInputValue());
        }
    },

    // Called after an edit operation on ANY of the fields on the page.
    update: function() {
        const newVal = this.getValue();
        if (!_.isEqual(newVal, this.value) || (this.value && newVal && this.value.toString() !== newVal.toString())) {
            this.render();
        }
    },

    fieldValueKeydown: function(e) {
        KeyHandler.reg();
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            if (!this.model.multiline || (!e.altKey && !e.shiftKey && !e.ctrlKey)) {
                if (this.gen) {
                    e.target.value = this.gen.password;
                    this.hideGenerator();
                    return;
                }
                this.stopBlurListener();
                this.closeEditor(e.target.value);
            }
        } else if (code === Keys.DOM_VK_ESCAPE) {
            this.stopBlurListener();
            this.closeEditor();
        } else if (code === Keys.DOM_VK_TAB) {
            e.preventDefault();
            this.stopBlurListener();
            this.closeEditor(e.target.value, { tab: { field: this.model.name, prev: e.shiftKey } });
        } else if (code === Keys.DOM_VK_G && e.metaKey) {
            e.preventDefault();
            this.showGenerator();
        } else if (code === Keys.DOM_VK_S && (e.metaKey || e.ctrlKey)) {
            this.stopBlurListener();
            this.closeEditor(e.target.value);
            return;
        }
        e.stopPropagation();
    }

});

module.exports = FieldViewBrowser;
