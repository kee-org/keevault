const Backbone = require('backbone');
const AppSettingsModel = require('./app-settings-model');
const MenuModel = require('./menu/menu-model');
const EntryModel = require('./entry-model');
const GroupModel = require('./group-model');
const FileCollection = require('../collections/file-collection');
const EntryCollection = require('../collections/entry-collection');
const FileInfoCollection = require('../collections/file-info-collection');
const FileModel = require('./file-model');
const FileInfoModel = require('./file-info-model');
const Storage = require('../storage');
const Timeouts = require('../const/timeouts');
const IdGenerator = require('../util/id-generator');
const Logger = require('../util/logger');
const AccountModel = require('./account-model');
const Format = require('../util/format');
const UrlUtil = require('../util/url-util');
const EmailUtil = require('../util/email');
const RuntimeInfo = require('../comp/runtime-info');

require('../mixins/protected-value-ex');

const AppModel = Backbone.Model.extend({
    defaults: {},

    initialize: function() {
        this.tags = [];
        this.files = new FileCollection();
        this.fileInfos = FileInfoCollection.instance;
        this.menu = new MenuModel();
        this.filter = {};
        this.sort = 'title';
        this.settings = AppSettingsModel.instance;
        this.activeEntryId = null;
        this.isBeta = RuntimeInfo.beta;
        this.account = AccountModel.instance;

        this.listenTo(Backbone, 'refresh', this.refresh);
        this.listenTo(Backbone, 'set-filter', this.setFilter);
        this.listenTo(Backbone, 'add-filter', this.addFilter);
        this.listenTo(Backbone, 'set-sort', this.setSort);
        this.listenTo(Backbone, 'empty-trash', this.emptyTrash);
        this.listenTo(Backbone, 'select-entry', this.selectEntry);

        this.appLogger = new Logger('app');

        AppModel.instance = this;
    },

    handleHashItem: function(key, val) {
        switch (key) {
            case 'dest': this.destinationFeature = val; break;
            case 'pfEmail': if (EmailUtil.validate(val)) {
                this.prefillEmail = val;
            } break;
            case 'couponCode': if (/^[a-zA-Z0-9]{3,60}$/.test(val)) { this.couponCode = val; } break;
            case 'resetEmail': if (EmailUtil.validate(val)) { this.resetEmail = val; } break;
            case 'resetAuthToken': this.resetAuthToken = val; break;
        }
    },

    prepare: function() {
        _.forEach(Storage, prv => prv.init());

        this.KPRPCActions = {};
        const hash = window.location.hash;
        if (hash && hash.length > 1 && hash.indexOf('#') === 0) {
            const hashItems = hash.substring(1).split(',');
            hashItems.forEach(hashItem => {
                const itemComponents = hashItem.split('=');
                if (itemComponents && itemComponents.length === 2) {
                    const key = itemComponents[0];
                    const val = itemComponents[1];
                    this.handleHashItem(key, val);
                }
            });
            window.location.hash = '';
        }
    },

    setKPRPCActions: function(actions) {
        this.KPRPCActions = actions;
    },

    addFile: function(file) {
        if (this.files.get(file.id)) {
            return false;
        }
        this.files.add(file);
        file.get('groups').forEach(function (group) {
            this.menu.groupsSection.addItem(group);
        }, this);
        this._addTags(file);
        this._tagsChanged();
        this.menu.filesSection.addItem({
            icon: 'lock',
            title: file.get('name'),
            page: 'file',
            file: file
        });
        this.refresh();
        this.listenTo(file, 'reload', this.reloadFile);
        this.KPRPCActions.onOpened();
        this.setRandomId();
        this.trackOpenAction(file);
        return true;
    },

    reloadFile: function(file) {
        this.menu.groupsSection.replaceByFile(file, file.get('groups').first());
        this.updateTags();
    },

    _addTags: function(file) {
        const tagsHash = {};
        this.tags.forEach(tag => {
            tagsHash[tag.toLowerCase()] = true;
        });
        file.forEachEntry({}, entry => {
            _.forEach(entry.tags, tag => {
                if (!tagsHash[tag.toLowerCase()]) {
                    tagsHash[tag.toLowerCase()] = true;
                    this.tags.push(tag);
                }
            });
        });
        this.tags.sort();
    },

    _tagsChanged: function() {
        if (this.tags.length) {
            this.menu.tagsSection.set('scrollable', true);
            this.menu.tagsSection.setItems(this.tags.map(tag => {
                return {title: tag, icon: 'tag', filterKey: 'tag', filterValue: tag, editable: true};
            }));
        } else {
            this.menu.tagsSection.set('scrollable', false);
            this.menu.tagsSection.removeAllItems();
        }
    },

    updateTags: function() {
        const oldTags = this.tags.slice();
        this.tags.splice(0, this.tags.length);
        this.files.forEach(function(file) {
            this._addTags(file);
        }, this);
        if (!_.isEqual(oldTags, this.tags)) {
            this._tagsChanged();
        }
    },

    renameTag: function(from, to) {
        this.files.forEach(file => file.renameTag(from, to));
        this.updateTags();
    },

    closeAllFiles: function() {
        this.files.each(file => {
            file.close();
            this.fileClosed(file);
            file.destroy();
        });
        this.files.reset();
        this.menu.groupsSection.removeAllItems();
        this.menu.tagsSection.set('scrollable', false);
        this.menu.tagsSection.removeAllItems();
        this.menu.filesSection.removeAllItems();
        this.tags.splice(0, this.tags.length);
        this.filter = {};
        this.menu.select({ item: this.menu.allItemsItem });
        this.KPRPCActions.onClosed();
    },

    closeFile: function(file) {
        file.close();
        this.fileClosed(file);
        this.files.remove(file);
        this.updateTags();
        this.menu.groupsSection.removeByFile(file);
        this.menu.filesSection.removeByFile(file);
        this.menu.select({ item: this.menu.allItemsSection.get('items').first() });
        file.destroy();
        this.KPRPCActions.onClosed();
    },

    emptyTrash: function() {
        this.files.forEach(file => file.emptyTrash());
        this.refresh();
    },

    setFilter: function(filter) {
        this.filter = filter;
        this.filter.subGroups = this.settings.get('expandGroups');
        const entries = this.getEntries();
        if (!this.activeEntryId || !entries.get(this.activeEntryId)) {
            const firstEntry = entries.first();
            this.activeEntryId = firstEntry ? firstEntry.id : null;
        }
        Backbone.trigger('filter', { filter: this.filter, sort: this.sort, entries: entries });
        Backbone.trigger('entry-selected', entries.get(this.activeEntryId));
    },

    refresh: function() {
        this.setFilter(this.filter);
    },

    selectEntry: function(entry) {
        this.activeEntryId = entry.id;
        this.refresh();
    },

    addFilter: function(filter) {
        this.setFilter(_.extend(this.filter, filter));
    },

    setSort: function(sort) {
        this.sort = sort;
        this.setFilter(this.filter);
    },

    getEntries: function() {
        const entries = this.getEntriesByFilter(this.filter);
        entries.sortEntries(this.sort);
        if (this.filter.trash) {
            this.addTrashGroups(entries);
        }
        return entries;
    },

    getEntriesByFilter: function(filter) {
        filter = this.prepareFilter(filter);
        const entries = new EntryCollection();
        this.files.forEach(file => {
            file.forEachEntry(filter, entry => entries.push(entry));
        });
        return entries;
    },

    updateMasterPassword: async function(newPassword) {
        const hashedNewPassword = await newPassword.getHash();
        return this.account.changePassword(hashedNewPassword, async () => {
            const emailAddrParts = EmailUtil.split(this.account.get('email'));
            const file = this.files.first();
            const oldPasswordHash = file.db.credentials.passwordHash.clone(); // Not certain clone is needed
            file.setPassword(newPassword, emailAddrParts);
            this.syncFile(file, { skipValidation: true, startedByUser: false, remoteKey: {passwordHash: oldPasswordHash} });
            return true;
        });
    },

    addTrashGroups: function(collection) {
        this.files.forEach(file => {
            const trashGroup = file.getTrashGroup();
            if (trashGroup) {
                trashGroup.getOwnSubGroups().forEach(group => {
                    collection.unshift(GroupModel.fromGroup(group, file, trashGroup));
                });
            }
        });
    },

    prepareFilter: function(filter) {
        filter = _.clone(filter);
        filter.textLower = filter.text ? filter.text.toLowerCase() : '';
        filter.tagLower = filter.tag ? filter.tag.toLowerCase() : '';
        return filter;
    },

    getFirstSelectedGroup: function() {
        const selGroupId = this.filter.group;
        let file,
            group;
        if (selGroupId) {
            this.files.some(f => {
                file = f;
                group = f.getGroup(selGroupId);
                return group;
            });
        }
        if (!group) {
            file = this.files.first();
            group = file.get('groups').first();
        }
        return { group: group, file: file };
    },

    completeUserNames: function(part) {
        const userNames = {};
        this.files.forEach(file => {
            file.forEachEntry({ text: part, textLower: part.toLowerCase(), advanced: { user: true } }, entry => {
                const userName = entry.user;
                if (userName) {
                    userNames[userName] = (userNames[userName] || 0) + 1;
                }
            });
        });
        const matches = _.pairs(userNames);
        matches.sort((x, y) => y[1] - x[1]);
        const maxResults = 5;
        if (matches.length > maxResults) {
            matches.length = maxResults;
        }
        return matches.map(m => m[0]);
    },

    getEntryTemplates: function() {
        const entryTemplates = [];
        this.files.forEach(file => {
            file.forEachEntryTemplate(entry => {
                entryTemplates.push({ file, entry });
            });
        });
        return entryTemplates;
    },

    setRandomId: function() {
        if (this.files) {
            const file = this.files.first();
            if (file) {
                const id = file.getRandomId();
                if (id) {
                    window.cdstorage.setItem('randomId', id);
                    window.onRandomIdRetrievedFromStorage(id);
                }
            }
        }
    },

    reduceNumberAccuracy: function(count) {
        if (count <= 50) return count;
        if (count <= 500) return Math.round(count / 5) * 5;
        if (count <= 5000) return Math.round(count / 50) * 50;
        if (count <= 50000) return Math.round(count / 500) * 500;
        return Math.round(count / 5000) * 5000;
    },

    detectTheme: function() {
        let theme = 'ot';
        if (document.body.classList.contains('th-lt')) theme = 'lt';
        if (document.body.classList.contains('th-dk')) theme = 'dk';
        return theme;
    },

    trackOpenAction: function(file) {
        if (!file) return;
        const time = file.loadStartTime ? Date.now() - file.loadStartTime : 0;
        setImmediate(() => {
            const count = this.reduceNumberAccuracy(file.entryCountAtLoadTime);
            const configLength = this.reduceNumberAccuracy(file.getConfigLength());
            window.trackMatomoAction(['setCustomVariable', 1, 'entryCount', count, 'page']);
            window.trackMatomoAction(['setCustomVariable', 2, 'configLength', configLength, 'page']);
            window.trackMatomoAction(['setCustomVariable', 2, 'vaultTheme', this.detectTheme(), 'visit']);
            window.trackMatomoAction(['trackEvent', 'Vault', 'Open', 'primary', time]);
        });
    },

    createNewEntry: function(args) {
        const sel = this.getFirstSelectedGroup();
        if (args && args.template) {
            if (sel.file !== args.template.file) {
                sel.file = args.template.file;
                sel.group = args.template.file.get('groups').first();
            }
            const templateEntry = args.template.entry;
            const newEntry = EntryModel.newEntry(sel.group, sel.file);
            newEntry.copyFromTemplate(templateEntry);
            return newEntry;
        } else {
            return EntryModel.newEntry(sel.group, sel.file, {
                tag: this.filter.tag
            });
        }
    },

    createNewGroup: function() {
        const sel = this.getFirstSelectedGroup();
        return GroupModel.newGroup(sel.group, sel.file);
    },

    createNewTemplateEntry: function() {
        const file = this.getFirstSelectedGroup().file;
        const group = file.getEntryTemplatesGroup() || file.createEntryTemplatesGroup();
        return EntryModel.newEntry(group, file);
    },

    createDemoFile: function() {
        if (!this.files.getByName('Demo')) {
            const demoFile = new FileModel({ id: IdGenerator.uuid() });
            demoFile.openDemo(() => {
                this.addFile(demoFile);
            });
            return true;
        } else {
            return false;
        }
    },

    createNewFile: function() {
        let name;
        for (let i = 0; ; i++) {
            name = 'New' + (i || '');
            if (!this.files.getByName(name) && !this.fileInfos.getByName(name)) {
                break;
            }
        }
        const newFile = new FileModel({ id: IdGenerator.uuid() });
        newFile.create(name);
        this.addFile(newFile);
    },

    openFile: function(params, callback) {
        const logger = new Logger('open', params.name);
        logger.info('File open request');
        const fileInfo = params.id ? this.fileInfos.get(params.id) : this.fileInfos.getMatch(params.storage, params.name, params.path);
        if (!params.opts && fileInfo && fileInfo.get('opts')) {
            params.opts = fileInfo.get('opts');
        }
        if (fileInfo && fileInfo.get('modified')) {
            logger.info('Open file from cache because it is modified');
            this.openFileFromCache(params, (err, file) => {
                if (!err && file) {
                    logger.info('Sync just opened modified file');
                    const remotePassword = params.tempRemoteSyncPassword ? { remoteKey: {
                        password: params.tempRemoteSyncPassword.clone() } } : undefined;
                    _.defer(() => this.syncFile(file, remotePassword));
                }
                callback(err);
            }, fileInfo);
        } else if (params.fileData) {
            logger.info('Open file from supplied content');
            const needSaveToCache = params.storage !== 'file';
            this.openFileWithData(params, callback, fileInfo, params.fileData, needSaveToCache);
        } else if (!params.storage) {
            logger.info('Open file from cache as main storage');
            this.openFileFromCache(params, callback, fileInfo);
        } else if (fileInfo && fileInfo.get('openDate') && fileInfo.get('rev') === params.rev && fileInfo.get('storage') !== 'file') {
            logger.info('Open file from cache because it is latest');
            this.openFileFromCache(
                params,
                (err, file) => {
                    if (err) {
                        logger.warn('Load from cache failed. Probably Private browsing mode is enabled? Loading from storage instead');
                        this.openFileFromStorage(params, callback, fileInfo, logger, true);
                    } else {
                        callback(err, file);
                    }
                },
                fileInfo);
        } else if (!fileInfo || !fileInfo.get('openDate') || params.storage === 'file') {
            this.openFileFromStorage(params, callback, fileInfo, logger);
        } else {
            logger.info('Open file from cache, will sync after load', params.storage);
            this.openFileFromCache(params, (err, file) => {
                if (!err && file) {
                    logger.info('Sync just opened file');
                    const remotePassword = params.tempRemoteSyncPassword ? { remoteKey: {
                        password: params.tempRemoteSyncPassword.clone() } } : undefined;
                    _.defer(() => this.syncFile(file, remotePassword));
                    callback(err);
                } else {
                    logger.warn('Load from cache failed. Probably Private browsing mode is enabled? Loading from storage instead');
                    this.openFileFromStorage(params, callback, fileInfo, logger, true);
                }
            }, fileInfo);
        }
    },

    openFileFromCache: function(params, callback, fileInfo) {
        Storage.cache.load(fileInfo.id, null, (err, data) => {
            if (!data) {
                err = 'Load from cache failed. Probably Private browsing mode is enabled? Loading from storage instead';
            }
            new Logger('open', params.name).info('Loaded file from cache', err);
            if (err) {
                callback(err);
            } else {
                this.openFileWithData(params, callback, fileInfo, data);
            }
        });
    },

    openFileFromStorage(params, callback, fileInfo, logger, noCache) {
        logger.info('Open file from storage', params.storage);
        const storage = Storage[params.storage];
        const storageLoad = () => {
            logger.info('Load from storage');
            storage.load(params.path, params.opts, (err, data, stat) => {
                if (err) {
                    if (fileInfo && fileInfo.get('openDate')) {
                        logger.warn('Open file from cache because of storage load error', err);
                        this.openFileFromCache(params, callback, fileInfo);
                    } else {
                        logger.error('Storage load error', err);
                        callback(err);
                    }
                } else {
                    logger.info('Opening file with content loaded from storage');
                    params.fileData = data;
                    params.rev = stat && stat.rev || null;

                    // Attempts to update cache. Even in Private browsing mode this
                    // might work, but only until the window is closed.
                    const needSaveToCache = storage.name !== 'file';
                    this.openFileWithData(params, callback, fileInfo, data, needSaveToCache);
                }
            });
        };
        const cacheRev = fileInfo && fileInfo.get('rev') || null;
        if (cacheRev && storage.stat) {
            logger.info('Stat file');
            storage.stat(params.path, params.opts, (err, stat) => {
                if (!noCache && fileInfo && storage.name !== 'file' && (err || (stat && stat.rev === cacheRev))) {
                    logger.info('Open file from cache because ' + (err ? 'stat error' : 'it is latest'), err);
                    this.openFileFromCache(params, callback, fileInfo);
                } else if (stat) {
                    logger.info('Open file from storage (' + stat.rev + ', local ' + cacheRev + ')');
                    storageLoad();
                } else {
                    logger.error('Stat error', err);
                    callback(err);
                }
            });
        } else {
            storageLoad();
        }
    },

    openFileWithData: function(params, callback, fileInfo, data, updateCacheOnSuccess) {
        const logger = new Logger('open', params.name);
        let needLoadKeyFile = false;
        if (!params.keyFileData && fileInfo && fileInfo.get('keyFileName')) {
            params.keyFileName = fileInfo.get('keyFileName');
            if (this.settings.get('rememberKeyFiles') === 'data') {
                params.keyFileData = FileModel.createKeyFileWithHash(fileInfo.get('keyFileHash'));
            } else if (this.settings.get('rememberKeyFiles') === 'path' && fileInfo.get('keyFilePath')) {
                params.keyFilePath = fileInfo.get('keyFilePath');
                if (Storage.file.enabled) {
                    needLoadKeyFile = true;
                }
            }
        } else if (params.keyFilePath && !params.keyFileData && !fileInfo) {
            needLoadKeyFile = true;
        }
        const file = new FileModel({
            id: fileInfo ? fileInfo.id : IdGenerator.uuid(),
            name: params.name,
            storage: params.storage,
            path: params.path,
            keyFileName: params.keyFileName,
            keyFilePath: params.keyFilePath,
            backup: fileInfo && fileInfo.get('backup') || null,
            fingerprint: fileInfo && fileInfo.get('fingerprint') || null
        });
        const openComplete = err => {
            if (err) {
                return callback(err);
            }
            if (this.files.get(file.id)) {
                return callback('Duplicate file id');
            }
            if (fileInfo && fileInfo.get('modified')) {
                if (fileInfo.get('editState')) {
                    logger.info('Loaded local edit state');
                    file.setLocalEditState(fileInfo.get('editState'));
                }
                logger.info('Mark file as modified');
                file.set('modified', true);
            }
            if (fileInfo) {
                file.set('syncDate', fileInfo.get('syncDate'));
            }
            if (updateCacheOnSuccess) {
                logger.info('Save loaded file to cache');
                Storage.cache.save(file.id, null, params.fileData, (err) => {
                    if (err) {
                        logger.warn('Failed to save newly loaded file to cache. Probably caused by Private browsing mode but could be other causes like local disk space full?');
                    } else {
                        logger.info('Saved to cache');
                    }
                    // Say we're clean even if an error occurred since neither us nor the user can do anything about it.
                    file.set('dirty', false);
                });
            }
            const rev = params.rev || fileInfo && fileInfo.get('rev');
            this.setFileOpts(file, params.opts);
            this.addToLastOpenFiles(file, rev);
            file.loadStartTime = params.loadStartTime;
            this.addFile(file);
            callback(null, file);
            this.fileOpened(file, data, params);
        };
        const open = () => {
            file.open(params.password, data, params.keyFileData, openComplete);
        };
        params.loadStartTime = Date.now();
        if (needLoadKeyFile) {
            Storage.file.load(params.keyFilePath, {}, (err, data) => {
                if (err) {
                    logger.error('Storage load error', err);
                    callback(err);
                } else {
                    params.keyFileData = data;
                    open();
                }
            });
        } else {
            open();
        }
    },

    importFileWithXml: function(params, callback) {
        const logger = new Logger('import', params.name);
        logger.info('File import request with supplied xml');
        const file = new FileModel({
            id: IdGenerator.uuid(),
            name: params.name,
            storage: params.storage,
            path: params.path
        });
        file.importWithXml(params.fileXml, err => {
            logger.info('Import xml complete ' + (err ? 'with error' : ''), err);
            if (err) {
                return callback(err);
            }
            this.addFile(file);
            this.fileOpened(file);
        });
    },

    addToLastOpenFiles: function(file, rev) {
        this.appLogger.debug('Add last open file', file.id, file.get('name'), file.get('storage'), file.get('path'), rev);
        const dt = new Date();
        const fileInfo = new FileInfoModel({
            id: file.id,
            name: file.get('name'),
            storage: file.get('storage'),
            path: file.get('path'),
            opts: this.getStoreOpts(file),
            modified: file.get('modified'),
            editState: file.getLocalEditState(),
            rev: rev,
            syncDate: file.get('syncDate') || dt,
            openDate: dt,
            backup: file.get('backup'),
            fingerprint: file.get('fingerprint')
        });
        switch (this.settings.get('rememberKeyFiles')) {
            case 'data':
                fileInfo.set({
                    keyFileName: file.get('keyFileName') || null,
                    keyFileHash: file.getKeyFileHash()
                });
                break;
            case 'path':
                fileInfo.set({
                    keyFileName: file.get('keyFileName') || null,
                    keyFilePath: file.get('keyFilePath') || null
                });
        }
        this.fileInfos.remove(file.id);
        this.fileInfos.unshift(fileInfo);
        this.fileInfos.save(this.account.get('user').userId);
    },

    getStoreOpts: function(file) {
        const opts = file.get('opts');
        const storage = file.get('storage');
        if (Storage[storage] && Storage[storage].fileOptsToStoreOpts && opts) {
            return Storage[storage].fileOptsToStoreOpts(opts, file);
        }
        return null;
    },

    setFileOpts: function(file, opts) {
        const storage = file.get('storage');
        if (Storage[storage] && Storage[storage].storeOptsToFileOpts && opts) {
            file.set('opts', Storage[storage].storeOptsToFileOpts(opts, file));
        }
    },

    fileOpened: function(file, data) {
        if (file.get('storage') === 'file') {
            Storage.file.watch(file.get('path'), _.debounce(() => {
                this.syncFile(file);
            }, Timeouts.FileChangeSync));
        }
        const backup = file.get('backup');
        if (data && backup && backup.enabled && backup.pending) {
            this.scheduleBackupFile(file, data);
        }
    },

    fileClosed: function(file) {
        if (file.get('storage') === 'file') {
            Storage.file.unwatch(file.get('path'));
        }
    },

    removeFileInfo: function(id) {
        Storage.cache.remove(id);
        this.fileInfos.remove(id);
        this.fileInfos.save(this.account.get('user').userId);
    },

    getFileInfo: function(file) {
        return this.fileInfos.get(file.id) ||
            this.fileInfos.getMatch(file.get('storage'), file.get('name'), file.get('path'));
    },

    syncFile: function(file, options, callback) {
        if (file.get('demo')) {
            this.KPRPCActions.onSaved();
            return callback && callback();
        }
        if (file.get('syncing')) {
            return callback && callback('Sync in progress');
        }
        if (!options) {
            options = {};
        }
        const logger = new Logger('sync', file.get('name'));
        const storage = options.storage || file.get('storage');
        let path = options.path || file.get('path');
        const opts = options.opts || file.get('opts');
        if (storage && Storage[storage].getPathForName && (!path || storage !== file.get('storage'))) {
            path = Storage[storage].getPathForName(file.get('name'));
        }
        logger.info('Sync started', storage, path, options);
        let fileInfo = this.getFileInfo(file);
        if (!fileInfo) {
            logger.info('Create new file info');
            const dt = new Date();
            fileInfo = new FileInfoModel({
                id: IdGenerator.uuid(),
                name: file.get('name'),
                storage: file.get('storage'),
                path: file.get('path'),
                opts: this.getStoreOpts(file),
                modified: file.get('modified'),
                editState: null,
                rev: null,
                syncDate: dt,
                openDate: dt,
                backup: file.get('backup')
            });
        }
        file.setSyncProgress();
        const complete = (err, savedToCache) => {
            if (!err && savedToCache === undefined) { savedToCache = true; }
            logger.info('Sync finished', err || 'no error');
            file.setSyncComplete(path, storage, err ? err.toString() : null, savedToCache);
            fileInfo.set({
                name: file.get('name'),
                storage: storage,
                path: path,
                opts: this.getStoreOpts(file),
                modified: file.get('modified'),
                editState: file.getLocalEditState(),
                syncDate: file.get('syncDate')
            });
            if (this.settings.get('rememberKeyFiles') === 'data') {
                fileInfo.set({
                    keyFileName: file.get('keyFileName') || null,
                    keyFileHash: file.getKeyFileHash()
                });
            }
            if (!this.fileInfos.get(fileInfo.id)) {
                this.fileInfos.unshift(fileInfo);
            }
            this.fileInfos.save(this.account.get('user').userId);
            this.KPRPCActions.onSaved();
            if (callback) { callback(err); }
        };
        if (!storage) {
            if (!file.get('modified') && fileInfo.id === file.id) {
                logger.info('Local, not modified');
                return complete();
            }
            logger.info('Local, save to cache');
            file.getData((data, err) => {
                if (err) { return complete(err); }
                Storage.cache.save(fileInfo.id, null, data, (err) => {
                    logger.info('Saved to cache', err || 'no error');
                    complete(err);
                    if (!err) {
                        this.scheduleBackupFile(file, data);
                    }
                });
            });
        } else {
            const maxLoadLoops = 3;
            let loadLoops = 0;
            const loadFromStorageAndMerge = () => {
                if (++loadLoops === maxLoadLoops) {
                    return complete('Too many load attempts');
                }
                logger.info('Load from storage, attempt ' + loadLoops);
                Storage[storage].load(path, opts, (err, data, stat) => {
                    logger.info('Load from storage', stat, err || 'no error');
                    if (err) { return complete(err); }
                    file.mergeOrUpdate(data, options.remoteKey, (err) => {
                        logger.info('Merge complete', err || 'no error');
                        this.refresh();
                        if (err) {
                            if (err.code === 'InvalidKey') {
                                logger.info('Remote key changed, request to enter new key');
                                Backbone.trigger('remote-key-changed', { file: file });
                            }
                            return complete(err);
                        }
                        if (stat && stat.rev) {
                            logger.info('Update rev in file info');
                            fileInfo.set('rev', stat.rev);
                        }
                        file.set('syncDate', new Date());
                        if (file.get('modified')) {
                            logger.info('Updated sync date, saving modified file');
                            saveToCacheAndStorage();
                        } else if (file.get('dirty')) {
                            logger.info('Saving not modified dirty file to cache');
                            Storage.cache.save(fileInfo.id, null, data, (err) => {
                                if (err) { return complete(err); }
                                file.set('dirty', false);
                                logger.info('Complete, remove dirty flag');
                                complete();
                            });
                        } else {
                            logger.info('Complete, no changes');
                            complete();
                        }
                    });
                });
            };
            const saveToStorage = (data, cacheError) => {
                logger.info('Save data to storage');
                const storageRev = fileInfo.get('storage') === storage ? fileInfo.get('rev') : undefined;
                let storageOpts = opts;
                if (storage === 'vault') {
                    storageOpts = storageOpts || {};
                    storageOpts.readOnly = this.get('readOnly');
                    const fileNameCheck = this.files.where({path})[0];
                    if (fileNameCheck && fileNameCheck.get('nameChanged') === true) {
                        storageOpts.newName = fileNameCheck.get('name');
                    }
                }
                Storage[storage].save(path, storageOpts, data, (err, stat) => {
                    if (err && err.revConflict) {
                        logger.info('Save rev conflict, reloading from storage');
                        loadFromStorageAndMerge();
                    } else if (err) {
                        logger.error('Error saving data to storage');
                        complete(err);
                    } else {
                        if (stat && stat.rev) {
                            logger.info('Update rev in file info');
                            fileInfo.set('rev', stat.rev);
                        }
                        if (stat && stat.path) {
                            logger.info('Update path in file info', stat.path);
                            file.set('path', stat.path);
                            fileInfo.set('path', stat.path);
                            path = stat.path;
                        }
                        file.set('syncDate', new Date());
                        file.set('nameChanged', false);
                        logger.info('Save to storage complete, update sync date');
                        this.scheduleBackupFile(file, data);
                        complete();
                    }
                }, storageRev);
            };
            const saveToCacheAndStorage = () => {
                logger.info('Getting file data for saving');
                file.getData((data, err) => {
                    if (err) {
                        logger.warn('Failed to load data for saving to cache. Unsure why/when this might happen! Aborting local and remote save operation. Error: ' + err);
                        return complete(err);
                    }
                    if (storage === 'file') {
                        logger.info('Saving to file storage');
                        saveToStorage(data);
                    } else if (!file.get('dirty')) {
                        logger.info('Saving to storage, skip cache because not dirty');
                        saveToStorage(data);
                    } else {
                        logger.info('Saving to cache');
                        Storage.cache.save(fileInfo.id, null, data, (err) => {
                            if (err) {
                                logger.warn('Failed to save to cache, saving to storage. Probably caused by Private browsing mode but could be other causes like local disk space full?');
                            } else {
                                logger.info('Saved to cache, saving to storage');
                            }
                            // Say we're clean even if an error occurred since neither us nor the user can do anything about it.
                            file.set('dirty', false);
                            saveToStorage(data, err);
                        });
                    }
                });
            };
            logger.info('Stat file');
            Storage[storage].stat(path, opts, (err, stat) => {
                if (err) {
                    if (err.notFound) {
                        logger.info('File does not exist in storage, creating');
                        saveToCacheAndStorage();
                    } else if (file.get('dirty')) {
                        logger.info('Stat error, dirty, save to cache', err || 'no error');
                        file.getData((data) => {
                            if (data) {
                                Storage.cache.save(fileInfo.id, null, data, (e) => {
                                    if (!e) {
                                        file.set('dirty', false);
                                    }
                                    logger.info('Saved to cache, exit with error', err || 'no error');
                                    complete(err);
                                });
                            }
                        });
                    } else {
                        logger.info('Stat error, not dirty', err || 'no error');
                        complete(err);
                    }
                } else if (stat.rev === fileInfo.get('rev')) {
                    if (file.get('modified')) {
                        logger.info('Stat found same version, modified, saving');
                        saveToCacheAndStorage();
                    } else {
                        logger.info('Stat found same version, not modified');
                        complete();
                    }
                } else {
                    logger.info('Found new version, loading from storage');
                    loadFromStorageAndMerge();
                }
            });
        }
    },

    clearStoredKeyFiles: function() {
        this.fileInfos.each(fileInfo => {
            fileInfo.set({
                keyFileName: null,
                keyFilePath: null,
                keyFileHash: null
            });
        });
        this.fileInfos.save(this.account.get('user').userId);
    },

    setFileBackup: function(fileId, backup) {
        const fileInfo = this.fileInfos.get(fileId);
        if (fileInfo) {
            fileInfo.set('backup', backup);
        }
        this.fileInfos.save(this.account.get('user').userId);
    },

    backupFile: function(file, data, callback) {
        const opts = file.get('opts');
        let backup = file.get('backup');
        const logger = new Logger('backup', file.get('name'));
        if (!backup || !backup.storage || !backup.path) {
            return callback('Invalid backup settings');
        }
        let path = backup.path.replace('{date}', Format.dtStrFs(new Date()));
        logger.info('Backup file to', backup.storage, path);
        const saveToFolder = () => {
            if (Storage[backup.storage].getPathForName) {
                path = Storage[backup.storage].getPathForName(path);
            }
            Storage[backup.storage].save(path, opts, data, (err) => {
                if (err) {
                    logger.error('Backup error', err);
                } else {
                    logger.info('Backup complete');
                    backup = file.get('backup');
                    backup.lastTime = Date.now();
                    delete backup.pending;
                    file.set('backup', backup);
                    this.setFileBackup(file.id, backup);
                }
                callback(err);
            });
        };
        let folderPath = UrlUtil.fileToDir(path);
        if (Storage[backup.storage].getPathForName) {
            folderPath = Storage[backup.storage].getPathForName(folderPath).replace('.kdbx', '');
        }
        Storage[backup.storage].stat(folderPath, opts, err => {
            if (err) {
                if (err.notFound) {
                    logger.info('Backup folder does not exist');
                    if (!Storage[backup.storage].mkdir) {
                        return callback('Mkdir not supported by ' + backup.storage);
                    }
                    Storage[backup.storage].mkdir(folderPath, err => {
                        if (err) {
                            logger.error('Error creating backup folder', err);
                            callback('Error creating backup folder');
                        } else {
                            logger.info('Backup folder created');
                            saveToFolder();
                        }
                    });
                } else {
                    logger.error('Stat folder error', err);
                    callback('Cannot stat backup folder');
                }
            } else {
                logger.info('Backup folder exists, saving');
                saveToFolder();
            }
        });
    },

    scheduleBackupFile: function(file, data) {
        const backup = file.get('backup');
        if (!backup || !backup.enabled) {
            return;
        }
        const logger = new Logger('backup', file.get('name'));
        let needBackup = false;
        if (!backup.lastTime) {
            needBackup = true;
            logger.debug('No last backup time, backup now');
        } else {
            const dt = new Date(backup.lastTime);
            switch (backup.schedule) {
                case '0':
                    break;
                case '1d':
                    dt.setDate(dt.getDate() + 1);
                    break;
                case '1w':
                    dt.setDate(dt.getDate() + 7);
                    break;
                case '1m':
                    dt.setMonth(dt.getMonth() + 1);
                    break;
                default:
                    return;
            }
            if (dt.getTime() <= Date.now()) {
                needBackup = true;
            }
            logger.debug('Last backup time: ' + new Date(backup.lastTime) +
                ', schedule: ' + backup.schedule +
                ', next time: ' + dt +
                ', ' + (needBackup ? 'backup now' : 'skip backup'));
        }
        if (!backup.pending) {
            backup.pending = true;
            this.setFileBackup(file.id, backup);
        }
        if (needBackup) {
            this.backupFile(file, data, _.noop);
        }
    },

    logout: function() {
        this.account.logout();
        this.account = AccountModel.instance;
    }
});

module.exports = AppModel;
