const Backbone = require('backbone');

const BrowserIntegrationView = Backbone.View.extend({
    template: require('templates/details/browser-integration.hbs'),

    events: {
        'click': 'click',
        'keypress input': 'keyPress',
        'keydown input': 'keyDown',
        'click #browser_extension_form_field_settings_show_link': 'showSettings',
        'change #browser_extension_form_field_settings_type': 'setType',
        'change #browser_extension_form_field_settings_placeholders': 'setPlaceholderHandling',
        'change #browser_extension_form_field_settings_state': 'setIntegrationState',
        'mousedown': 'panelMousedown'
    },

    closing: function() {
        // onChange event doesn't always fire before we start the closing
        // process so update internal state from fields first
        this.fieldName = $('#browser_extension_form_field_settings_name').val();
        this.fieldId = $('#browser_extension_form_field_settings_id').val();
        this.fieldPlaceholderHandling = $('#browser_extension_form_field_settings_placeholders').val();
        this.fieldType = $('#browser_extension_form_field_settings_type').val();

        if (this.fieldName !== this.model.get('name')) {
            this.model.set('name', this.fieldName);
        }
        if (this.fieldId !== this.model.get('fieldId')) {
            this.model.set('fieldId', this.fieldId);
        }
        if (this.fieldType !== this.model.get('type')) {
            this.model.set('type', this.fieldType);
        }
        const oldPlaceholderSetting = this.model.get('placeholderHandling');
        if (this.displayGlobalPlaceholderOption) {
            if (this.fieldPlaceholderHandling !== oldPlaceholderSetting) {
                this.model.set('placeholderHandling', this.fieldPlaceholderHandling);
            }
        } else {
            if ((this.fieldPlaceholderHandling === 'Disabled' && oldPlaceholderSetting === 'Enabled') ||
                (this.fieldPlaceholderHandling === 'Enabled' && oldPlaceholderSetting !== 'Enabled')) {
                this.model.set('placeholderHandling', this.fieldPlaceholderHandling);
            }
        }
    },

    initialize: function(opts) {
        this.pos = opts.pos;
        this.displayGlobalPlaceholderOption = opts.displayGlobalPlaceholderOption;

        // We track all state internally and only propagate to the model when we are
        // closing because our state is essentially tied to the field that created
        // us rather than existing independently
        this.fieldType = this.model.get('type');
        this.fieldId = this.model.get('fieldId');
        this.fieldName = this.model.get('name');
        this.fieldPlaceholderHandling = this.model.get('placeholderHandling');

        this.listenTo(Backbone, 'lock-workspace', this.remove.bind(this));
    },

    render: function() {
        const isCustomField = this.model.get('displayName') !== 'KeePass password' && this.model.get('displayName') !== 'KeePass username';
        this.renderTemplate({
            canEditType: isCustomField,
            canDisable: isCustomField,
            enabled: this.model.get('displayName').length > 0,
            name: this.model.get('name'),
            id: this.model.get('fieldId'),
            type: this.model.get('type'),
            placeholderHandling: this.model.get('placeholderHandling'),
            displayGlobalPlaceholderOption: this.displayGlobalPlaceholderOption
        });
        return this;
    },

    click: function(e) {
        e.stopPropagation();
    },

    panelMousedown: function(e) {
        e.stopPropagation();
    },

    keyPress: function(e) {
        e.stopPropagation();
    },

    keyDown: function(e) {
        e.stopPropagation();
    },

    showSettings: function(e) {
        e.stopPropagation();
        // TODO: Might be neater to fade out the link for 0.1s before moving the element and starting the expansion animation
        // ... or just get any animation working for a start
        this.$el.find('#browser_extension_form_field_settings_content').toggleClass('hide', false);
        e.target.parentNode.classList.remove('collapsed');
        e.target.classList.add('hide');
    },

    setPlaceholderHandling: function (e) {
        const ph = e.target.value;
        const warningDiv = this.$el.find('#browser_extension_form_field_settings_placeholders_warning')[0];
        if (ph === 'Enabled') {
            warningDiv.classList.remove('hide');
        } else {
            warningDiv.classList.add('hide');
        }
    },

    setType: function (e) {
        const t = e.target.value;
        if (t === 'FFTcheckbox') {
            this.trigger('changeToCheckbox');
        } else if (this.fieldType === 'FFTcheckbox') {
            this.trigger('changeFromCheckbox');
        }
        this.fieldType = t;
    },

    setIntegrationState: function (e) {
        if (e.target.checked) {
            $('#browser_extension_form_field_settings_type,#browser_extension_form_field_settings_name,#browser_extension_form_field_settings_id,#browser_extension_form_field_settings_placeholders').removeAttr('disabled');
            this.trigger('integrationEnabled');
        } else {
            $('#browser_extension_form_field_settings_type').val('FFTtext').attr('disabled', 'disabled');
            $('#browser_extension_form_field_settings_name').val('').attr('disabled', 'disabled');
            $('#browser_extension_form_field_settings_id').val('').attr('disabled', 'disabled');
            if (this.displayGlobalPlaceholderOption) {
                $('#browser_extension_form_field_settings_placeholders').val('Default').attr('disabled', 'disabled');
            } else {
                $('#browser_extension_form_field_settings_placeholders').val('Disabled').attr('disabled', 'disabled');
            }
            this.trigger('integrationDisabled');
        }
    }

});

module.exports = BrowserIntegrationView;
