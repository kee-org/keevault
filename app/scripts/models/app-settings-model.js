const Backbone = require('backbone');
const SettingsStore = require('../comp/settings-store');

const AppSettingsModel = Backbone.Model.extend({
    defaults: {
        theme: 'lt',
        locale: null,
        expandGroups: true,
        listViewWidth: null,
        menuViewWidth: null,
        tagsViewHeight: null,
        autoUpdate: 'install',
        clipboardSeconds: 0,
        autoSave: true,
        rememberKeyFiles: false,
        idleMinutes: 0,
        minimizeOnClose: false,
        tableView: false,
        colorfulIcons: false,
        titlebarStyle: 'default',
        lockOnMinimize: true,
        lockOnCopy: false,
        lockOnOsLock: false,
        helpTipCopyShown: false,
        templateHelpShown: false,
        skipOpenLocalWarn: false,
        hideEmptyFields: false,
        skipHttpsWarning: false,
        demoOpened: false,
        fontSize: 1,
        tableViewColumns: null,
        generatorPresets: {
            user: [],
            disabled: {
                Mac: true,
                Hash128: true,
                Hash256: true
            },
            default: 'High'
        },
        generatorHidePassword: false,
        cacheConfigSettings: false,

        canOpen: true,
        canOpenDemo: true,
        canOpenSettings: true,
        canCreate: true,
        canImportXml: true,
        canRemoveLatest: true,

        dropbox: false,
        webdav: false,
        gdrive: false,
        onedrive: false,

        rememberedAccountEmail: null,
        vaultIntroCompleted: false,
        saveAdviceAlertDismissed: false,
        recentClientTokens: {},
        encryptedAccessCredentials: null
    },

    initialize: function() {
        this.listenTo(this, 'change', this.save);
    },

    load: function() {
        return SettingsStore.load('app-settings').then(data => {
            if (data) {
                this.upgrade(data);
                this.set(data, {silent: true});
            }
        });
    },

    upgrade: function(data) {
        if (data.rememberKeyFiles === true) {
            data.rememberKeyFiles = 'data';
        }
        if (data.versionWarningShown) {
            delete data.versionWarningShown;
        }
    },

    save: function() {
        SettingsStore.save('app-settings', this.attributes);
    }
});

AppSettingsModel.instance = new AppSettingsModel();

module.exports = AppSettingsModel;
