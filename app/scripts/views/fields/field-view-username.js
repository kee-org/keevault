const FieldViewAutocomplete = require('./field-view-autocomplete');
const Logger = require('../../util/logger');

const logger = new Logger('field-view-username');

const FieldViewUsername = FieldViewAutocomplete.extend({
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

        FieldViewAutocomplete.prototype.endEdit.call(this, newVal, extra);
    }
});

module.exports = FieldViewUsername;
