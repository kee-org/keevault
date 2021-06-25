const Backbone = require('backbone');
const AppSettingsModel = require('./app-settings-model');
const KPRPCHandler = require('../comp/keepassrpc');
const Logger = require('../util/logger');
const IdGenerator = require('../util/id-generator');

/*
Not typescript so can't enforce this but we expect the following data structure:

class KeeVaultEmbeddedConfig {
    version: number,
    addon: {
        prefs: AddonPreferences
    },
    vault: {
        prefs: VaultPreferences
        updatedAt: Map<String,int>
    }
}

*/

const CURRENT_VERSION = 1;

const KeeVaultEmbeddedConfigModel = Backbone.Model.extend({

    defaults: function() {
        return {
            version: CURRENT_VERSION,
            addon: { prefs: {}, version: -1 },
            vault: { prefs: {}, updatedAt: {} },
            randomId: IdGenerator.uuid()
        };
    },

    settingsToSync: ['theme', 'locale', 'expandGroups', 'clipboardSeconds', 'autoSave',
        'rememberKeyFiles', 'idleMinutes', 'colorfulIcons', 'lockOnCopy', 'helpTipCopyShown',
        'templateHelpShown', 'hideEmptyFields', 'generatorPresets'],

    initialize: function(model, options) {
        this.logger = new Logger('configSync');
        if (!this.readEmbeddedConfig()) {
            this.logger.warn('Initialisation failed');
            return;
        }
        this.settingsToSync.forEach(setting => {
            this.listenTo(AppSettingsModel.instance, 'change:' + setting, (obj) => {
                this.updateSetting('vault', setting, obj.changed[setting]);
            });
        });
        this.listenTo(Backbone, 'update-addon-settings', (obj) => {
            this.updateAddonSettings(obj.settings, obj.version);
        });
    },

    destroy: function() {
        this.settingsToSync.forEach(setting => {
            // This might have side effects for other things that listen to settings change events
            // but can't see how else to get backbone to not leak references all over the place
            this.stopListening(AppSettingsModel.instance, 'change:' + setting);

            this.stopListening(Backbone, 'update-addon-settings');
        });
    },

    readEmbeddedConfig: function() {
        if (this.get('version') > CURRENT_VERSION) {
            this.logger.error('Account config version greater than latest known config version. Config syncing disabled until page refreshed to load newer version of the Vault app');
            return false;
        }
        // One day, if we load from an older config format, we may need to transform individual
        // Kee Vault or addon settings before passing them to their specific handlers

        this.applyVaultConfig(this.get('vault').prefs, this.get('vault').updatedAt);
        const addonConfig = this.get('addon');
        KPRPCHandler.applyAddonConfig({settings: addonConfig.prefs, version: addonConfig.version});
        return true;
    },

    applyVaultConfig: function (settings, incomingUpdatedAtList) {
        const ourUpdatedAtList = AppSettingsModel.instance.get('vaultConfigUpdatedAt') ?? {};
        const now = Date.now();
        for (const key in settings) {
            if (Object.hasOwnProperty.call(settings, key)) {
                const setting = settings[key];
                let settingUpdatedAt = incomingUpdatedAtList ? incomingUpdatedAtList[key] : null;
                const ourUpdatedAt = ourUpdatedAtList[key];
                if (!settingUpdatedAt) {
                    // We have to assume that this was the most recent change to the setting. Should only happen when someone first loads the new version of the PWA that inspects and creates these values.
                    settingUpdatedAt = now;
                }
                // ourUpdatedAt may be falsy if we have never run this version of the code before, or if it relates to a newly created setting key. In any case, we must assume that our stored data for that key is out of date.
                if (!ourUpdatedAt || settingUpdatedAt > ourUpdatedAt) {
                    AppSettingsModel.instance.set(key, setting);
                    ourUpdatedAtList[key] = settingUpdatedAt;
                }
            }
        }
        AppSettingsModel.instance.set('vaultConfigUpdatedAt', ourUpdatedAtList);
        AppSettingsModel.instance.save();
    },

    updateSetting: function (target, key, value) {
        const tgt = this.get(target);
        tgt.prefs[key] = value;
        if (!tgt.updatedAt) {
            tgt.updatedAt = {};
        }
        tgt.updatedAt[key] = Date.now();
        this.trigger('change');
    },

    updateAddonSettings: function (settings, version) {
        const addonConfig = this.get('addon');
        Object.assign(addonConfig.prefs, settings);
        addonConfig.version = version;
        this.trigger('change');
    },

    parse: function (json) {
        this.unparsedJson = json;
        return JSON.parse(json);
    },
    toJSON: function() {
        const attrs = _.clone(this.attributes);
        const json = JSON.stringify(attrs);
        if (json.length > 500000) {
            this.logger.error('config exceeds 500K characters. Changes will not be saved.');
            return this.unparsedJson;
        } else if (json.length > 250000) {
            this.logger.warn('config exceeds 250K characters. At 500K characters we will no longer accept changes.');
        }
        return json;
    }
});

module.exports = KeeVaultEmbeddedConfigModel;
