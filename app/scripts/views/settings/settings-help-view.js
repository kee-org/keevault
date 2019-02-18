const Backbone = require('backbone');
const Links = require('../../const/links');

const SettingsHelpView = Backbone.View.extend({
    template: require('templates/settings/settings-help.hbs'),

    events: {
        'click #launchDemoButton': 'launchDemoButton',
        'click #settingsHelpLinkToAccount': 'showAccountSettings',
        'click #settingsHelpLinkToAbout': 'showAboutPage'
    },

    render: function() {
        this.renderTemplate({
            forumLink: Links.Forum,
            forumPrivMessageLink: Links.ForumPrivateMessage
        });
    },

    launchDemoButton: function() {
        window.location.hash = '#dest=demo';
        window.location.reload();
    },

    showAccountSettings: function() {
        Backbone.trigger('toggle-settings', 'account');
    },

    showAboutPage: function() {
        Backbone.trigger('toggle-settings', 'about');
    }
});

module.exports = SettingsHelpView;
