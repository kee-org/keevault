const Backbone = require('backbone');
const RuntimeInfo = require('../../comp/runtime-info');
const Links = require('../../const/links');

const SettingsAboutView = Backbone.View.extend({
    template: require('templates/settings/settings-about.hbs'),

    render: function() {
        const scLink = Links.SourceCode +
            (RuntimeInfo.commit && RuntimeInfo.commit !== 'undefined' ? RuntimeInfo.commit : 'master');
        this.renderTemplate({
            version: RuntimeInfo.version,
            licenseLink: Links.License,
            sourceCodeLink: scLink,
            licenseLinkApache: Links.LicenseApache
        });
    }
});

module.exports = SettingsAboutView;
