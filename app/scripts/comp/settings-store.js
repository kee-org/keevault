const StringUtil = require('../util/string-util');
const Logger = require('../util/logger');

const logger = new Logger('settings');

const SettingsStore = {
    fileName: function(key) {
        return `${key}.json`;
    },

    load: function(key) {
        return new Promise(resolve => {
            const data = localStorage[StringUtil.camelCase(key)];
            return this.parseData(key, data, resolve);
        });
    },

    parseData: function(key, data, resolve) {
        try {
            if (data) {
                return resolve(JSON.parse(data));
            } else {
                resolve();
            }
        } catch (e) {
            logger.error('Error loading ' + key, e);
            resolve();
        }
    },

    save: function(key, data) {
        return new Promise(resolve => {
            localStorage[StringUtil.camelCase(key)] = JSON.stringify(data);
            resolve();
        });
    }
};

module.exports = SettingsStore;
