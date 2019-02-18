const Backbone = require('backbone');
const SettingsPrvView = require('./settings-prv-view');
const SettingsLogsView = require('./settings-logs-view');
const Format = require('../../util/format');
const AppSettingsModel = require('../../models/app-settings-model');
const UpdateModel = require('../../models/update-model');
const RuntimeInfo = require('../../comp/runtime-info');
const SettingsManager = require('../../comp/settings-manager');
const Storage = require('../../storage');
const FeatureDetector = require('../../util/feature-detector');
const Locale = require('../../util/locale');
const SemVer = require('../../util/semver');

const SettingsGeneralView = Backbone.View.extend({
    template: require('templates/settings/settings-general.hbs'),

    events: {
        'change .settings__general-theme': 'changeTheme',
        'change .settings__general-locale': 'changeLocale',
        'change .settings__general-font-size': 'changeFontSize',
        'change .settings__general-expand': 'changeExpandGroups',
        'change .settings__general-auto-update': 'changeAutoUpdate',
        'change .settings__general-idle-minutes': 'changeIdleMinutes',
        'change .settings__general-clipboard': 'changeClipboard',
        'change .settings__general-auto-save': 'changeAutoSave',
        'change .settings__general-minimize': 'changeMinimize',
        'change .settings__general-lock-on-minimize': 'changeLockOnMinimize',
        'change .settings__general-lock-on-copy': 'changeLockOnCopy',
        'change .settings__general-lock-on-os-lock': 'changeLockOnOsLock',
        'change .settings__general-table-view': 'changeTableView',
        'change .settings__general-colorful-icons': 'changeColorfulIcons',
        'change .settings__general-titlebar-style': 'changeTitlebarStyle',
        'click .settings__general-restart-btn': 'restartApp',
        'change .settings__general-prv-check': 'changeStorageEnabled',
        'click .settings__general-show-logs-link': 'showLogs'
    },

    views: null,

    initialize: function() {
        this.views = {};
        this.listenTo(UpdateModel.instance, 'change:status', this.render, this);
        this.listenTo(UpdateModel.instance, 'change:updateStatus', this.render, this);
    },

    render: function() {
        const storageProviders = this.getStorageProviders();

        this.renderTemplate({
            themes: _.mapObject(SettingsManager.allThemes, theme => Locale[theme]),
            activeTheme: AppSettingsModel.instance.get('theme'),
            locales: SettingsManager.allLocales,
            activeLocale: SettingsManager.activeLocale,
            fontSize: AppSettingsModel.instance.get('fontSize'),
            expandGroups: AppSettingsModel.instance.get('expandGroups'),
            canClearClipboard: false,
            clipboardSeconds: AppSettingsModel.instance.get('clipboardSeconds'),
            rememberKeyFiles: AppSettingsModel.instance.get('rememberKeyFiles'),
            supportFiles: false,
            autoSave: AppSettingsModel.instance.get('autoSave'),
            idleMinutes: AppSettingsModel.instance.get('idleMinutes'),
            minimizeOnClose: AppSettingsModel.instance.get('minimizeOnClose'),
            devTools: false,
            canMinimize: false,
            canDetectMinimize: false,
            canDetectOsSleep: false,
            lockOnMinimize: false,
            lockOnCopy: AppSettingsModel.instance.get('lockOnCopy'),
            lockOnOsLock: AppSettingsModel.instance.get('lockOnOsLock'),
            tableView: AppSettingsModel.instance.get('tableView'),
            canSetTableView: !FeatureDetector.isMobile,
            colorfulIcons: AppSettingsModel.instance.get('colorfulIcons'),
            supportsTitleBarStyles: false,
            titlebarStyle: AppSettingsModel.instance.get('titlebarStyle'),
            storageProviders: storageProviders
        });
        this.renderProviderViews(storageProviders);
    },

    renderProviderViews: function(storageProviders) {
        storageProviders.forEach(function(prv) {
            if (this.views[prv.name]) {
                this.views[prv.name].remove();
            }
            if (prv.hasConfig) {
                this.views[prv.name] = new SettingsPrvView({
                    el: this.$el.find('.settings__general-' + prv.name),
                    model: prv
                }).render();
            }
        }, this);
    },

    getUpdateInfo: function() {
        switch (UpdateModel.instance.get('status')) {
            case 'checking':
                return Locale.setGenUpdateChecking + '...';
            case 'error':
                let errMsg = Locale.setGenErrorChecking;
                if (UpdateModel.instance.get('lastError')) {
                    errMsg += ': ' + UpdateModel.instance.get('lastError');
                }
                if (UpdateModel.instance.get('lastSuccessCheckDate')) {
                    errMsg += '. ' + Locale.setGenLastCheckSuccess.replace('{}', Format.dtStr(UpdateModel.instance.get('lastSuccessCheckDate'))) +
                        ': ' + Locale.setGenLastCheckVer.replace('{}', UpdateModel.instance.get('lastVersion'));
                }
                return errMsg;
            case 'ok':
                let msg = Locale.setGenCheckedAt + ' ' + Format.dtStr(UpdateModel.instance.get('lastCheckDate')) + ': ';
                const cmp = SemVer.compareVersions(RuntimeInfo.version, UpdateModel.instance.get('lastVersion'));
                if (cmp >= 0) {
                    msg += Locale.setGenLatestVer;
                } else {
                    msg += Locale.setGenNewVer.replace('{}', UpdateModel.instance.get('lastVersion')) + ' ' +
                        Format.dStr(UpdateModel.instance.get('lastVersionReleaseDate'));
                }
                switch (UpdateModel.instance.get('updateStatus')) {
                    case 'downloading':
                        return msg + '. ' + Locale.setGenDownloadingUpdate;
                    case 'extracting':
                        return msg + '. ' + Locale.setGenExtractingUpdate;
                    case 'error':
                        return msg + '. ' + Locale.setGenCheckErr;
                }
                return msg;
            default:
                return Locale.setGenNeverChecked;
        }
    },

    getStorageProviders: function() {
        const storageProviders = [];
        Object.keys(Storage).forEach(name => {
            const prv = Storage[name];
            if (!prv.system) {
                storageProviders.push(prv);
            }
        });
        storageProviders.sort((x, y) => (x.uipos || Infinity) - (y.uipos || Infinity));
        return storageProviders.map(sp => ({
            name: sp.name,
            enabled: sp.enabled,
            hasConfig: sp.getSettingsConfig
        }));
    },

    changeTheme: function(e) {
        const theme = e.target.value;
        AppSettingsModel.instance.set('theme', theme);
    },

    changeLocale: function(e) {
        const locale = e.target.value;
        if (locale === '...') {
            return;
        }
        AppSettingsModel.instance.set('locale', locale);
    },

    changeFontSize: function(e) {
        const fontSize = +e.target.value;
        AppSettingsModel.instance.set('fontSize', fontSize);
    },

    changeTitlebarStyle: function(e) {
        const titlebarStyle = e.target.value;
        AppSettingsModel.instance.set('titlebarStyle', titlebarStyle);
    },

    changeClipboard: function(e) {
        const clipboardSeconds = +e.target.value;
        AppSettingsModel.instance.set('clipboardSeconds', clipboardSeconds);
    },

    changeIdleMinutes: function(e) {
        const idleMinutes = +e.target.value;
        AppSettingsModel.instance.set('idleMinutes', idleMinutes);
    },

    changeAutoSave: function(e) {
        const autoSave = e.target.checked || false;
        AppSettingsModel.instance.set('autoSave', autoSave);
    },

    changeMinimize: function(e) {
        const minimizeOnClose = e.target.checked || false;
        AppSettingsModel.instance.set('minimizeOnClose', minimizeOnClose);
    },

    changeLockOnMinimize: function(e) {
        const lockOnMinimize = e.target.checked || false;
        AppSettingsModel.instance.set('lockOnMinimize', lockOnMinimize);
    },

    changeLockOnCopy: function(e) {
        const lockOnCopy = e.target.checked || false;
        AppSettingsModel.instance.set('lockOnCopy', lockOnCopy);
    },

    changeLockOnOsLock: function(e) {
        const lockOnOsLock = e.target.checked || false;
        AppSettingsModel.instance.set('lockOnOsLock', lockOnOsLock);
    },

    changeTableView: function(e) {
        const tableView = e.target.checked || false;
        AppSettingsModel.instance.set('tableView', tableView);
        Backbone.trigger('refresh');
    },

    changeColorfulIcons: function(e) {
        const colorfulIcons = e.target.checked || false;
        AppSettingsModel.instance.set('colorfulIcons', colorfulIcons);
        Backbone.trigger('refresh');
    },

    restartApp: function() {
        window.location.reload();
    },

    changeExpandGroups: function(e) {
        const expand = e.target.checked;
        AppSettingsModel.instance.set('expandGroups', expand);
        Backbone.trigger('refresh');
    },

    changeStorageEnabled: function(e) {
        const storage = Storage[$(e.target).data('storage')];
        if (storage) {
            storage.setEnabled(e.target.checked);
            AppSettingsModel.instance.set(storage.name, storage.enabled);
            this.$el.find('.settings__general-' + storage.name).toggleClass('hide', !e.target.checked);
        }
    },

    showLogs: function() {
        if (this.views.logView) {
            this.views.logView.remove();
        }
        this.views.logView = new SettingsLogsView({ el: this.$el.find('.settings__general-advanced') }).render();
        this.$el.find('.settings__general-show-logs-link').toggleClass('hide', true);
        this.scrollToBottom();
    },

    scrollToBottom: function() {
        this.$el.closest('.scroller').scrollTop(this.$el.height());
    }
});

module.exports = SettingsGeneralView;
