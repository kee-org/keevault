const FieldViewBrowser = require('./field-view-browser');
const kdbxweb = require('kdbxweb');
const Logger = require('../../util/logger');

const logger = new Logger('field-view-password');

const FieldViewPassword = FieldViewBrowser.extend({
    initialize: function(opts) {
        this.browserFieldModel = opts.browserFieldModel;
        this.displayGlobalPlaceholderOption = opts.displayGlobalPlaceholderOption;
        this.browserIntegrationEnabled = true;
        this.prepareBrowserIntegrationSettings();
    },

    getValueSource: function(fieldName) {
        if (this.browserIntegrationConfigured()) {
            return 'BrowserAndKdbxField';
        }
        return 'KdbxFieldOnly';
    },

    endEdit: function(newVal, extra) {
        if (this.gen) {
            this.hideGenerator();
        }
        if (!this.editing) {
            return;
        }

        // If attached model is just the default settings, delete it
        if (!this.browserIntegrationConfigured()) {
            this.browserFieldModel = null;
        }

        if (this.browserFieldView) {
            logger.error('this.browserFieldView == true when it should not!');
            this.browserFieldView.remove();
            this.browserFieldView = null;
        }

        delete this.input;
        if (this.mobileControls) {
            this.mobileControls.cancel.remove();
            this.mobileControls.apply.remove();
            delete this.mobileControls;
        }
        this.stopBlurListener();
        if (typeof newVal === 'string' && this.value instanceof kdbxweb.ProtectedValue) {
            newVal = kdbxweb.ProtectedValue.fromString(newVal);
        }
        if (typeof newVal === 'string') {
            newVal = $.trim(newVal);
        }
        FieldViewBrowser.prototype.endEdit.call(this, newVal, extra);
    }
});

module.exports = FieldViewPassword;
