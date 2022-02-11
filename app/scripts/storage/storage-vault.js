const StorageBase = require('./storage-base');
// const Locale = require('../util/locale');
const KeeService = require('kee-frontend');
const AccountModel = require('../models/account-model');
const KeeError = require('../comp/kee-error');

const NewFileIdPrefix = 'NewFile:';

const StorageVault = StorageBase.extend({
    name: 'vault',
    enabled: true,
    system: true,
    uipos: 3,
    iconSvg: '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><path d="M86.657536,76.246208 L47.768064,9 L89.111168,' +
        '9 L128,76.246208 L86.657536,76.246208 Z M25.010048,119.08 L102.690048,119.08 L123.36256,83.24 L45.68064,83.24 L25.010048,119.08 L25.010048,' +
        '119.08 Z M38.793088,9.003712 L0,76.30496 L20.671872,112.110016 L59.464704,44.808128 L38.793088,9.003712 Z"></path></svg>',

    items: new Map(), // <string, {urls: KeeService.URLList, rev: string}>

    getPathForName: function(fileName) {
        return NewFileIdPrefix + fileName;
    },

    request: async function(mode, path, opts, data, callback, retriesRemaining = 2) {
        if (!AccountModel.instance.has('user')) {
            return callback && callback('user not found');
        }
        const user = AccountModel.instance.get('user');

        const item = this.items.get(path) || {};

        let urls;
        if (!item.urls) {
            const urlsOrError = await KeeService.Storage.StorageManager.refreshItemLinks(user, path);

            if (urlsOrError === KeeError.LoginRequired) {
                // TODO: Support logging in to Kee Vault account independently of DBs that are already open
                // (e.g. user has changed password from another device)
                return callback && callback(mode + ' operation failed because we don\'t support interactive login during vault operations yet.' +
                ' User probably changed password elsewhere.');
            } else if (urlsOrError.ul) {
                urls = urlsOrError;
            } else {
                // Not sure how to resolve any other problems. Need to see what arises in the real world.
                return callback && callback(mode + ' operation failed because: ' + urlsOrError);
            }

            // Set now in case slow networking and async operations locally mean we can
            // utilise the retrieved urls again before this operation has completed
            item.urls = urls;
            this.items.set(path, item);
        } else {
            urls = item.urls;
        }
        const url = mode === 'load' ? urls.dl : (mode === 'save' ? urls.ul : urls.st);

        const ts = this.logger.ts();
        const params = {
            url: url,
            success: async (response, xhr) => {
                const rev = xhr.getResponseHeader('ETag').replace(/\"/g, '');
                const item = this.items.get(path);
                if (!item) return callback && callback('Missing item!');
                item.rev = rev;
                this.items.set(path, item); // not sure this necessary - map probably holds byref
                this.logger.debug(mode + ' operation complete', path, rev, this.logger.ts(ts));
                if (mode === 'save') {
                    if (opts.newName) {
                        this.logger.info('File name changed locally. Will sync to server now.');
                        try {
                            await KeeService.Storage.StorageManager.update(user, { id: path, name: opts.newName });
                        } catch (e) {
                            this.logger.error('Failed to update database name', e);
                        }
                    }
                    return callback && callback(null, { rev });
                } else if (mode === 'stat') {
                    return callback && callback(null, { rev });
                } else {
                    return callback && callback(null, response, { rev });
                }
            },
            error: (err) => {
                if (err === 'http status 403' && retriesRemaining > 0) {
                    // Try again with new access URLs
                    const item = this.items.get(path);
                    item.urls = null;
                    this.request(mode, path, opts, data, callback, --retriesRemaining);
                } else {
                    this.logger.error(mode + ' operation error', path, err, this.logger.ts(ts));
                    return callback && callback(err);
                }
            }
        };
        if (mode === 'load') params.responseType = 'arraybuffer';
        if (mode === 'stat') params.method = 'HEAD';
        if (mode === 'save') {
            params.method = 'PUT';
            params.data = data;
        }
        this._xhr(params);
    },

    load: async function(path, opts, callback, retriesRemaining = 2) {
        return this.request('load', path, opts, null, callback, retriesRemaining);
    },

    // This is triggered from the sync operation. Could be utilised when listing
    // multiple databases in future too. Returning notFound:true triggers a save
    // operation. Otherwise, the ETAG will be compared to determine if a save operation
    // is required.
    // This means we are doing network requests every time a user logs in or requests
    // a save (sync) operation, even if there is a cached version. That's probably
    // sensible even in the long run but we could consider some form of rate-limiting
    // once the sync channel is implemented. Several pros/cons and variants of that
    // approach so details will need to be planned in 2019.
    stat: async function(path, opts, callback, retriesRemaining = 2) {
        // skip stat for brand new files. This allows us to prohibit list operations on the S3 bucket.
        if (opts && opts.primaryFileCreation) {
            return callback && callback({ notFound: true });
        }
        return this.request('stat', path, opts, null, callback, retriesRemaining);
    },

    save: async function(path, opts, data, callback, revUnusedNotSureWhatThisWasSuppsedToBeFor, retriesRemaining = 2) {
        if (opts.readOnly) {
            return callback && callback('Kee Vault is in READ ONLY mode');
        }
        if (data.byteLength > 10000000) {
            return callback && callback('Your Kee Vault is too large to save and sync to other devices. Delete some large file attachments, empty the bin, etc. and then try again.');
        }
        return this.request('save', path, opts, data, callback, retriesRemaining);
    },

    list: async function(dir, callback) {
        if (!AccountModel.instance.has('user')) {
            return callback && callback('user not found');
        }
        const user = AccountModel.instance.get('user');

        const list = await KeeService.Storage.StorageManager.list(user);

        if (!list || !list.length || !list[0] || !list[0].id) {
            if (list === KeeError.Unexpected || list === KeeError.ServerUnreachable || list === KeeError.ServerTimeout) {
                return callback && callback('probably offline');
            }
            if (list && list.length === 0) {
                return callback && callback('storage item not found');
            }
            return callback && callback('unknown list error');
        }

        list.sort((a, b) => a.primary ? -1 : 0);
        // we sort by primary here, suggesting we expect server to return non-primary items sometimes. check that is acceptable.
        // Err, actually the StorageItem class in keefrontend doesn't even have this property so this sort is moot.
        // TODO:f: stop sorting for no reason

        const fileList = list.map(f => {
            this.items.set(f.id, {urls: f.urls});

            return {
                name: f.name,
                path: f.id,
                rev: undefined,
                dir: false
            };
        });
        return callback && callback(null, fileList);
    },

    remove: function(path, callback) {
        throw new Error('Not implemented');
    }
});

module.exports = new StorageVault();
