const kdbxweb = require('kdbxweb');
const Capacitor = require('@capacitor/core');
const Logger = require('../util/logger');
const Hex = require('../util/hex');
const logger = new Logger('nativeCache');

const deferInitPromiseResolvers = [];

const NativeCacheClass = function () {};

NativeCacheClass.prototype.mapModel = async function(model) {
    if (!this.KPRPCHandler) {
        const deferPromise = new Promise((resolve, reject) => {
            deferInitPromiseResolvers.push(resolve);
        });
        await deferPromise;
    }

    const id = (model.account.get('user') && model.account.get('user').emailHashed) ? model.account.get('user').emailHashed : 'demo';
    const secretKey = (model.account.get('user') && model.account.get('user').secretKey) ? model.account.get('user').secretKey : Hex.byteArrayToBase64(kdbxweb.Random.getBytes(32));
    const state = {
        id,
        config: {
            cache: {
                expiry: 180,
                authPresenceLimit: 30
            },
            auth: {
                expiry: 300,
                interactiveExpiry: 900,
                secretKey
            }
        },
        vault: await this.KPRPCHandler.invokeLocalGetAllDatabases(true)
    };
    logger.debug('All private data: ' + JSON.stringify(state));
    return state;
};

NativeCacheClass.prototype.init = function (KPRPCHandler) {
    this.KPRPCHandler = KPRPCHandler;
    let deferInitPromiseResolver;
    while ((deferInitPromiseResolver = deferInitPromiseResolvers.shift()) !== undefined) {
        deferInitPromiseResolver();
    }
};

NativeCacheClass.prototype.update = async function (model) {
    // if (model.deviceInfo.platform === 'web') return;
    try {
        Capacitor.Plugins.NativeCache.update(await this.mapModel(model));
    } catch (e) {
        logger.error('Failed to send data to native cache: ' + e);
    }
};

const NativeCache = new NativeCacheClass();
module.exports = NativeCache;
