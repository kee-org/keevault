const Backbone = require('backbone');
const FeatureDetector = require('../../util/feature-detector');

const SettingsShortcutsView = Backbone.View.extend({
    template: require('templates/settings/settings-shortcuts.hbs'),

    render: function() {
        this.renderTemplate({
            cmd: FeatureDetector.actionShortcutSymbol(true),
            alt: FeatureDetector.altShortcutSymbol(true),
            global: FeatureDetector.globalShortcutSymbol(true),
            globalIsLarge: FeatureDetector.globalShortcutIsLarge(),
            globalShortcutsSupported: false
        });
    }
});

module.exports = SettingsShortcutsView;
