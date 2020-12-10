
const Capacitor = require('@capacitor/core');
const Logger = require('../util/logger');
const logger = new Logger('nativeConfig');

const NativeConfigClass = function () { };

NativeConfigClass.prototype.init = async function () {
    // if (model.deviceInfo.platform === 'web') return Promise.resolved();

    window.addEventListener('capacitorConfigUpdated', async (ev) => {
        // eslint-disable-next-line no-console
        console.error(Date.now() + ': message = ' + JSON.stringify(ev));
        await this.load();
    });
    await this.load();
    return this.config.authkey; // TODO: Need to do this after an update/reloaunch too? what about other config details we might want? any?
};

NativeConfigClass.prototype.load = async function () {
    try {
        this.config = await Capacitor.Plugins.NativeConfig.get();
        // eslint-disable-next-line no-console
        console.error(this.config);
        // TODO: remove this: hack code into KV so that presense of ANY
        // authkey causes demo to be loaded (eventually this will force demo to be skipped and existing user auth to begin)

        // TODO: If autofill has been set to true from false and vault is already open, trigger NativeCache.update(), otherwise all config changes will just modify the behaviour as the app loads and user signs in.
        // BUT: WHY?!!! If user is already logged in then update would have happened previously so native layer already knows all the relevant data. Will ignore this initially and go on assumption that every time user signs in, the cache in the native side gets updated and thus no need to also do it here.
    } catch (e) {
        logger.error('Failed to read config from native host: ' + e);
    }
};

// No writing. Calls to other plugins (like the nativecache) may update the config and prompt this plugin to re-read the latest config

const NativeConfig = new NativeConfigClass();
module.exports = NativeConfig;
