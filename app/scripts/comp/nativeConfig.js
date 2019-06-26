
const Capacitor = require('@capacitor/core');
const Logger = require('../util/logger');
const logger = new Logger('nativeConfig');

const NativeConfigClass = function () {};

NativeConfigClass.prototype.init = async function () {
    // if (model.deviceInfo.platform === 'web') return Promise.resolved();

    window.addEventListener('capacitorConfigUpdated', async (ev) => {
        // eslint-disable-next-line no-console
        console.error(Date.now() + ': message = ' + JSON.stringify(ev));
        await this.load();
    });
    await this.load();
};

NativeConfigClass.prototype.load = async function () {
    try {
        this.config = await Capacitor.Plugins.NativeConfig.get();
        // eslint-disable-next-line no-console
        console.error(this.config);
        // If autofill has been set to true from false and vault is already open, trigger NativeCache.update(), otherwise all config changes will just modify the behaviour as the app loads and user signs in.
        // WILL NEED TO CHECK FOR PENDING AUTOFILL REQUESTS WITHIN THE NATIVECACHE CAPACITOR PLUGIN THOUGH SO THAT IT CAN PROCEED ONCE USER HAS LOGGED IN (OR INSTANT RESPONSE FROM THIS LOGIC BRANCH HAS FINISHED)
    } catch (e) {
        logger.error('Failed to read config from native host: ' + e);
    }
};

// No writing. Calls to other plugins (like the nativecache) may update the config and prompt this plugin to re-read the latest config

const NativeConfig = new NativeConfigClass();
module.exports = NativeConfig;
