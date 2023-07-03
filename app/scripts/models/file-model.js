const Backbone = require('backbone');
const GroupCollection = require('../collections/group-collection');
const GroupModel = require('./group-model');
const IconUrl = require('../util/icon-url');
const Logger = require('../util/logger');
const kdbxweb = require('kdbxweb');
const demoFileData = require('base64-loader!../../resources/Demo.kdbx');
const Alerts = require('../comp/alerts');
const Locale = require('../util/locale');
const DBSettingsModel = require('./browser-addon/db-settings-model');
const KeeVaultEmbeddedConfigModel = require('./kee-vault-embedded-config-model');
const PasswordStrength = require('../util/password-strength');
const KdbxPlaceholders = new (require('kdbx-placeholders').KdbxPlaceholders)();

const logger = new Logger('file');

const FileModel = Backbone.Model.extend({
    defaults: {
        id: '',
        uuid: '',
        name: '',
        keyFileName: '',
        passwordLength: 0,
        path: '',
        opts: null,
        storage: null,
        modified: false,
        dirty: false,
        nameChanged: false,
        open: false,
        created: false,
        demo: false,
        groups: null,
        oldPasswordLength: 0,
        oldKeyFileName: '',
        passwordChanged: false,
        keyFileChanged: false,
        keyChangeForce: -1,
        syncing: false,
        syncError: null,
        syncDate: null,
        backup: null,
        browserExtensionSettings: null,
        keeVaultEmbeddedConfig: null,
        readOnly: false
    },

    db: null,
    entryMap: null,
    groupMap: null,

    initialize: function() {
        this.entryMap = {};
        this.groupMap = {};
    },

    open: function(password, fileData, keyFileData, callback) {
        try {
            const credentials = new kdbxweb.Credentials(password, keyFileData);
            const ts = logger.ts();

            kdbxweb.Kdbx.load(fileData, credentials)
                .then(db => {
                    this.db = db;
                    this.readModel();
                    this.setOpenFile({ passwordLength: password ? password.textLength : 0 });
                    if (keyFileData) {
                        kdbxweb.ByteUtils.zeroBuffer(keyFileData);
                    }
                    this.fixVersion();
                    logger.info('Opened file ' + this.get('name') + ': ' + logger.ts(ts) + ', ' +
                        this.kdfArgsToString(db.header) + ', ' + Math.round(fileData.byteLength / 1024) + ' kB');
                    callback();
                })
                .catch(err => {
                    if (err.code === kdbxweb.Consts.ErrorCodes.InvalidKey && password && !password.byteLength) {
                        logger.warn('Error opening file with empty password, try to open with null password');
                        return this.open(null, fileData, keyFileData, callback);
                    }
                    logger.error('Error opening file', err.code, err.message, err);
                    callback(err);
                });
        } catch (e) {
            logger.error('Error opening file', e, e.code, e.message, e);
            callback(e);
        }
    },

    fixVersion: function() {
        if (
            this.db.meta.generator === 'KdbxWeb' &&
            this.db.header.versionMajor === 4 &&
            this.db.header.versionMinor === 1
        ) {
            this.db.header.versionMinor = 0;
            logger.info('Fixed file version: 4.1 => 4.0');
        }
    },

    kdfArgsToString: function(header) {
        if (header.kdfParameters) {
            return header.kdfParameters.keys().map(key => {
                const val = header.kdfParameters.get(key);
                if (val instanceof ArrayBuffer) {
                    /* eslint-disable-next-line array-callback-return */
                    return;
                }
                return key + '=' + val;
            }).filter(p => p).join('&');
        } else if (header.keyEncryptionRounds) {
            return header.keyEncryptionRounds + ' rounds';
        } else {
            return '?';
        }
    },

    create: function(name, storage) {
        const password = kdbxweb.ProtectedValue.fromString('');
        const credentials = new kdbxweb.Credentials(password);
        this.db = kdbxweb.Kdbx.create(credentials, name);
        this.set('name', name);
        if (storage) this.set('storage', storage);
        this.readModel();
        this.set({ open: true, created: true, name: name });
    },

    configureArgon2ParamsAuto: function(protectedPassword, emailAddrParts) {
        let password = protectedPassword.getText();
        const strength = PasswordStrength.fuzzyStrength(password, emailAddrParts);
        password = undefined;
        this.configureArgon2ParamsManual(strength);
    },

    configureArgon2ParamsManual: function(strength) {
        let iterations;
        let memory;
        let parallelism;
        switch (strength) {
            case 5: iterations = 1; memory = 3 * 1024 * 1024; parallelism = 4; break;
            case 4: iterations = 1; memory = 10 * 1024 * 1024; parallelism = 4; break;
            case 3: iterations = 1; memory = 25 * 1024 * 1024; parallelism = 4; break;
            case 2: iterations = 1; memory = 50 * 1024 * 1024; parallelism = 4; break;
            default: iterations = 2; memory = 75 * 1024 * 1024; parallelism = 4; break;
        }
        this.setKdfParameter('iterations', iterations);
        this.setKdfParameter('memory', memory);
        this.setKdfParameter('parallelism', parallelism);
    },

    getArgon2StrengthMode: function() {
        const params = this.get('kdfParameters');
        if (!params || !params.iterations || !params.memory || !params.parallelism) {
            return 0;
        }
        if (params.iterations === 2 && params.memory === 75 * 1024 * 1024 && params.parallelism === 4) {
            return 1;
        }
        if (params.iterations === 1 && params.parallelism === 4) {
            if (params.memory === 50 * 1024 * 1024) {
                return 2;
            }
            if (params.memory === 25 * 1024 * 1024) {
                return 3;
            }
            if (params.memory === 10 * 1024 * 1024) {
                return 4;
            }
            if (params.memory === 3 * 1024 * 1024) {
                return 5;
            }
        }
        return 0;
    },

    importKPRPCSettings: function(importSourceDB) {
        this.db.meta.customData['KeePassRPC.Config'] = importSourceDB.meta.customData['KeePassRPC.Config'];
        this.db.meta.settingsChanged = new Date();
        this.reload();
        const settings = this.get('browserExtensionSettings');
        settings.set('rootUUID', this.db.getDefaultGroup().uuid.toString());

        let prioritiesSet = false;
        this.forEachEntry({}, entry => {
            const es = entry.get('browserSettings');
            if (es && es.get('priority') > 0) prioritiesSet = true;
        });
        settings.set('displayPriorityField', prioritiesSet);

        settings.set('displayGlobalPlaceholderOption', settings.get('defaultPlaceholderHandling') === 'Enabled');
    },

    importWithXml: function(fileXml, callback) {
        try {
            const ts = logger.ts();
            const password = kdbxweb.ProtectedValue.fromString('');
            const credentials = new kdbxweb.Credentials(password);
            kdbxweb.Kdbx.loadXml(fileXml, credentials)
                .then(db => {
                    this.db = db;
                    this.readModel();
                    this.set({ open: true, created: true });
                    logger.info('Imported file ' + this.get('name') + ': ' + logger.ts(ts));
                    callback();
                })
                .catch(err => {
                    logger.error('Error importing file', err.code, err.message, err);
                    callback(err);
                });
        } catch (e) {
            logger.error('Error importing file', e, e.code, e.message, e);
            callback(e);
        }
    },

    importFromData: async function(fileData, password) {
        let delayWarning;
        try {
            const ts = logger.ts();
            const protectedPassword = kdbxweb.ProtectedValue.fromString(password);
            password = undefined;
            const credentials = new kdbxweb.Credentials(protectedPassword);

            delayWarning = setTimeout(() => Alerts.info({ body: Locale.slowImport, icon: 'exclamation-triangle' }), 3000);
            const importSourceDB = await kdbxweb.Kdbx.load(fileData, credentials);
            clearTimeout(delayWarning);

            // Ensure multiple imports from the same KDBX source don't result
            // in duplicate UUIDs. Only original KDBX sources need to worry
            // about this (those generated as part of an import from another
            // data source will always have new random UUIDs anyway)
            this.generateNewUUIDs(importSourceDB);

            logger.info('Opened kdbx data for importing to ' + this.get('name') + ': ' + logger.ts(ts));
            return this.importFromKdbx(importSourceDB);
        } catch (e) {
            logger.error('Error importing file', e, e.code, e.message, e);
            clearTimeout(delayWarning);
            return e;
        }
    },

    importFromKdbx: function(importSourceDB) {
        try {
            const ts = logger.ts();
            const group = this.getGroupForImport();
            group.entries = importSourceDB.groups[0].entries;
            group.groups = importSourceDB.groups[0].groups;
            this.db.createRecycleBin();
            if (importSourceDB.meta.recycleBinUuid) {
                const importedRecycleBin = this.db.getGroup(importSourceDB.meta.recycleBinUuid);
                if (importedRecycleBin) {
                    this.db.remove(importedRecycleBin);
                }
            }

            const customIcons = {};

            // TODO: Support importing binaries. Need to track binaries as independent map between index in source file and index in dest file (which in most cases will be a newly incremented index number). Otherwise, newly imported entries will end up referencing existing binaries in the destination vault.

            group.entries.forEach((en) => {
                en.history.concat(en).forEach((e) => {
                    if (e.customIcon) {
                        customIcons[e.customIcon] = e.customIcon;
                    }
                    // Object.values(e.binaries).forEach((binary) => {
                    //     if (binary.ref) {
                    //         binaries[binary.ref] = binary;
                    //     }
                    // });
                });
            });

            Object.values(customIcons).forEach(function (customIconId) {
                const customIcon = importSourceDB.meta.customIcons[customIconId];
                if (customIcon) {
                    this.db.meta.customIcons[customIconId] = customIcon;
                }
            }, this);

            // this.binaries = {};
            // Object.keys(entry.binaries).forEach(function (name) {
            //     if (entry.binaries[name] instanceof ProtectedValue) {
            //         this.binaries[name] = entry.binaries[name].clone();
            //     } else if (entry.binaries[name] && entry.binaries[name].ref) {
            //         this.binaries[name] = { ref: entry.binaries[name].ref };
            //         if (entry.binaries[name].value) {
            //             this.binaries[name].value = entry.binaries[name].value;
            //         }
            //     } else {
            //         this.binaries[name] = entry.binaries[name];
            //     }
            // }, this);

            this.set({ open: true, dirty: true, modified: true });

            if (group === this.db.getDefaultGroup()) {
                this.importKPRPCSettings(importSourceDB);
            } else {
                this.reload();
            }

            logger.info('Imported file to ' + this.get('name') + ': ' + logger.ts(ts));
            Backbone.trigger('save-all');
        } catch (e) {
            logger.error('Error importing file', e, e.code, e.message, e);
            return e;
        }
    },

    importFromDataRows: async function(dataRows, fieldMapping) {
        try {
            const ts = logger.ts();
            const protectedFields = new Set(['Password']);
            const group = this.getGroupForImport();

            dataRows.forEach(row => {
                const entry = this.db.createEntry(group);
                Object.keys(fieldMapping).forEach(kdbxField => {
                    const csvField = fieldMapping[kdbxField];
                    const value = row[csvField];
                    if (value) {
                        entry.fields[kdbxField] = protectedFields.has(kdbxField)
                            ? kdbxweb.ProtectedValue.fromString(value)
                            : value;
                    }
                });
            });

            this.set({ open: true, dirty: true, modified: true });
            this.reload();
            logger.info('Imported data rows to ' + this.get('name') + ': ' + logger.ts(ts));
            Backbone.trigger('save-all');
        } catch (e) {
            logger.error('Error importing data rows', e, e.code, e.message, e);
            return e;
        }
    },

    generateNewUUIDs: function (importSourceDB) {
        // Probably could be more efficient by storing a map of old to new and iterating
        // that map once per entry since the detection of relevant ref placeholder text
        // likely takes up a fair amount of time.
        importSourceDB.groups[0].forEach((entry, group) => {
            const newId = kdbxweb.KdbxUuid.random();
            if (entry) {
                KdbxPlaceholders.changeUUID(entry, importSourceDB.groups[0], newId);
            } else {
                if (importSourceDB.meta.recycleBinUuid && group.uuid.equals(importSourceDB.meta.recycleBinUuid)) {
                    importSourceDB.meta.recycleBinUuid = newId;
                    group.name = 'Bin imported from KeePass';
                }
                group.uuid = newId;
            }
        });
    },

    getGroupForImport: function() {
        let group = this.db.getDefaultGroup();
        if (group.entries.length > 0 ||
            group.groups.length > 1 ||
            (group.groups.length === 1 && !group.groups[0].uuid.equals(this.db.meta.recycleBinUuid))) {
            group = this.db.createGroup(group, 'Import at ' + new Date().toLocaleString());
        }
        return group;
    },

    openDemo: function(callback) {
        const password = kdbxweb.ProtectedValue.fromString('demo');
        const credentials = new kdbxweb.Credentials(password);
        const demoFile = kdbxweb.ByteUtils.arrayToBuffer(kdbxweb.ByteUtils.base64ToBytes(demoFileData));
        kdbxweb.Kdbx.load(demoFile, credentials)
            .then(db => {
                this.db = db;
                this.set('name', 'Demo');
                this.readModel();
                this.setOpenFile({passwordLength: 4, demo: true});
                callback();
            });
    },

    setOpenFile: function(props) {
        _.extend(props, {
            open: true,
            oldKeyFileName: this.get('keyFileName'),
            oldPasswordLength: props.passwordLength,
            passwordChanged: false,
            keyFileChanged: false
        });
        this.set(props);
        this._oldPasswordHash = this.db.credentials.passwordHash;
        this._oldKeyFileHash = this.db.credentials.keyFileHash;
        this._oldKeyChangeDate = this.db.meta.keyChanged;
    },

    readModel: function() {
        const groups = new GroupCollection();
        this.set({
            uuid: this.db.getDefaultGroup().uuid.toString(),
            groups: groups,
            defaultUser: this.db.meta.defaultUser,
            recycleBinEnabled: this.db.meta.recycleBinEnabled,
            historyMaxItems: this.db.meta.historyMaxItems,
            historyMaxSize: this.db.meta.historyMaxSize,
            keyEncryptionRounds: this.db.header.keyEncryptionRounds,
            keyChangeForce: this.db.meta.keyChangeForce,
            kdfParameters: this.readKdfParams(),
            browserExtensionSettings: this.readBrowserExtensionSettings(),
            keeVaultEmbeddedConfig: this.readKeeVaultEmbeddedConfig()
        }, { silent: true });
        this.db.groups.forEach(function(group) {
            let groupModel = this.getGroup(this.subId(group.uuid.id));
            if (groupModel) {
                groupModel.setGroup(group, this);
            } else {
                groupModel = GroupModel.fromGroup(group, this);
            }
            groups.add(groupModel);
        }, this);
        this.buildObjectMap();
        this.resolveFieldReferences();
    },

    readBrowserExtensionSettings: function() {
        const raw = this.db.meta.customData['KeePassRPC.Config'];
        let settings;
        try {
            settings = new DBSettingsModel(raw, {parse: true});
        } catch (e) {
            logger.info('Browser extension database settings missing or invalid. Will reset to defaults now.');
        }
        if (!settings) {
            settings = new DBSettingsModel({
                rootUUID: this.db.getDefaultGroup().uuid.toString()
            });
        }

        this.listenTo(settings, 'change', () => {
            this.db.meta.customData['KeePassRPC.Config'] = this.get('browserExtensionSettings').toJSON();
            this.db.meta.settingsChanged = new Date();
            this.setModified();
        });
        return settings;
    },

    readKeeVaultEmbeddedConfig: function() {
        if (!this.has('storage') || this.get('storage') !== 'vault') {
            // In future need to also find out if this is the primary DB but for launch we have only one
            return undefined;
        }

        const raw = this.db.meta.customData['KeeVault.Config'];
        let config;
        try {
            config = new KeeVaultEmbeddedConfigModel(raw, {parse: true});
        } catch (e) {
            logger.info('KeeVaultEmbeddedConfigModel settings missing or invalid. Will reset to defaults now.');
        }
        if (!config) {
            config = new KeeVaultEmbeddedConfigModel({version: 1});
        }

        this.listenTo(config, 'change', () => {
            // This seems to be called twice every time. I guess the set operations within setModified
            // count as a new change. Not sure how to avoid that though, nor if it matters apart from
            // saving a ms or two of performance.

            // browser add-on might not know if we need to save the change or not so we
            // sometimes are told that changes have happened when they actually haven't.
            // TODO: Probably want to be deterministic based on just property names rather than creation time
            const latestConfig = this.get('keeVaultEmbeddedConfig').toJSON();
            if (this.db.meta.customData['KeeVault.Config'] !== latestConfig) {
                this.db.meta.customData['KeeVault.Config'] = latestConfig;
                this.db.meta.settingsChanged = new Date();
                this.setModified();
            }
        });
        return config;
    },

    readKdfParams: function() {
        const kdfParameters = this.db.header.kdfParameters;
        if (!kdfParameters) {
            return undefined;
        }
        let uuid = kdfParameters.get('$UUID');
        if (!uuid) {
            return undefined;
        }
        uuid = kdbxweb.ByteUtils.bytesToBase64(uuid);
        if (uuid !== kdbxweb.Consts.KdfId.Argon2) {
            return undefined;
        }
        return {
            parallelism: kdfParameters.get('P').valueOf(),
            iterations: kdfParameters.get('I').valueOf(),
            memory: kdfParameters.get('M').valueOf()
        };
    },

    getRandomId: function() {
        const config = this.get('keeVaultEmbeddedConfig');
        if (config) {
            return config.get('randomId');
        }
    },

    getConfigLength: function() {
        const config = this.get('keeVaultEmbeddedConfig');
        if (config) {
            if (config && config.unparsedJson) {
                return config.unparsedJson.length;
            }
        }
        return 0;
    },

    subId: function(id) {
        return this.id + ':' + id;
    },

    buildObjectMap: function() {
        const entryMap = {};
        const groupMap = {};
        let entryCount = 0;
        this.forEachGroup(group => {
            groupMap[group.id] = group;
            group.forEachOwnEntry(null, entry => {
                entryMap[entry.id] = entry;
                entryCount++;
            });
        }, { includeDisabled: true });
        this.entryMap = entryMap;
        this.groupMap = groupMap;
        this.entryCountAtLoadTime = entryCount;
    },

    resolveFieldReferences: function() {
        const entryMap = this.entryMap;
        Object.keys(entryMap).forEach(e => {
            entryMap[e].resolveFieldReferences();
        });
    },

    reload: function() {
        this.buildObjectMap();
        this.readModel();
        this.trigger('reload', this);
        Backbone.trigger('refresh');
    },

    mergeOrUpdate: function(fileData, remoteKey, callback) {
        let credentials;
        let credentialsPromise = Promise.resolve();
        if (remoteKey) {
            credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(''));
            credentialsPromise = credentials.ready.then(() => {
                const promises = [];
                if (remoteKey.password) {
                    promises.push(credentials.setPassword(remoteKey.password));
                } else if (remoteKey.passwordHash) {
                    credentials.passwordHash = remoteKey.passwordHash;
                } else {
                    credentials.passwordHash = this.db.credentials.passwordHash;
                }
                if (remoteKey.keyFileName) {
                    if (remoteKey.keyFileData) {
                        promises.push(credentials.setKeyFile(remoteKey.keyFileData));
                    } else {
                        credentials.keyFileHash = this.db.credentials.keyFileHash;
                    }
                }
                return Promise.all(promises);
            });
        } else {
            credentials = this.db.credentials;
        }
        credentialsPromise.then(() => {
            kdbxweb.Kdbx.load(fileData, credentials)
                .then(remoteDb => {
                    if (this.get('modified')) {
                        try {
                            if (remoteKey && remoteDb.meta.keyChanged > this.db.meta.keyChanged) {
                                this.db.credentials = remoteDb.credentials;
                                this.set('keyFileName', remoteKey.keyFileName || '');
                                if (remoteKey.password) {
                                    this.set('passwordLength', remoteKey.password.textLength);
                                }
                                // kdbxweb db.header.merge does not merge kdfParameters. Possibly
                                // should do? Quite an edge case for the general library though so
                                // maybe not. We must, because we may change them when the key changes
                                this.db.header.kdfParameters = remoteDb.header.kdfParameters;
                                this.set('kdfParameters', this.readKdfParams());
                            }
                            this.db.merge(remoteDb);
                        } catch (e) {
                            logger.error('File merge error', e);
                            return callback(e);
                        }
                    } else {
                        this.db = remoteDb;
                    }
                    this.set('dirty', true);
                    this.reload();
                    callback();
                })
                .catch(err => {
                    logger.error('Error opening file to merge', err.code, err.message, err);
                    callback(err);
                });
        });
    },

    getLocalEditState: function() {
        return this.db.getLocalEditState();
    },

    setLocalEditState: function(editState) {
        this.db.setLocalEditState(editState);
    },

    close: function() {
        this.set({
            keyFileName: '',
            passwordLength: 0,
            modified: false,
            dirty: false,
            open: false,
            created: false,
            groups: null,
            passwordChanged: false,
            keyFileChanged: false,
            syncing: false
        });
    },

    getEntry: function(id) {
        return this.entryMap[id];
    },

    getGroup: function(id) {
        return this.groupMap[id];
    },

    forEachEntry: function(filter, callback) {
        let top = this;
        if (filter.trash) {
            top = this.getGroup(this.db.meta.recycleBinUuid ? this.subId(this.db.meta.recycleBinUuid.id) : null);
        } else if (filter.group) {
            top = this.getGroup(filter.group);
        }
        if (top) {
            if (top.forEachOwnEntry) {
                top.forEachOwnEntry(filter, callback);
            }
            if (!filter.group || filter.subGroups) {
                top.forEachGroup(group => {
                    group.forEachOwnEntry(filter, callback);
                }, filter);
            }
        }
    },

    forEachGroup: function(callback, filter) {
        this.get('groups').forEach(group => {
            if (callback(group) !== false) {
                group.forEachGroup(callback, filter);
            }
        });
    },

    getTrashGroup: function() {
        return this.db.meta.recycleBinEnabled ? this.getGroup(this.subId(this.db.meta.recycleBinUuid.id)) : null;
    },

    getEntryTemplatesGroup: function() {
        return this.db.meta.entryTemplatesGroup ? this.getGroup(this.subId(this.db.meta.entryTemplatesGroup.id)) : null;
    },

    createEntryTemplatesGroup: function() {
        const rootGroup = this.get('groups').first();
        const templatesGroup = GroupModel.newGroup(rootGroup, this);
        templatesGroup.setName('Templates');
        this.db.meta.entryTemplatesGroup = templatesGroup.group.uuid;
        this.reload();
        return templatesGroup;
    },

    setModified: function() {
        if (!this.get('demo')) {
            this.set({ modified: true, dirty: true });
        }
    },

    setNameChanged: function() {
        if (!this.get('demo')) {
            this.set({ nameChanged: true });
        }
    },

    getData: function(cb) {
        this.db.cleanup({
            historyRules: true,
            customIcons: true,
            binaries: true
        });
        this.db.cleanup({ binaries: true });
        // It appears this is the only place that the underlying kdbx file actually gets saved which is a little unintuitive (inside a "get" function!)
        this.db.save()
            .then(data => {
                cb(data);
            })
            .catch(err => {
                logger.error('Error saving file', this.get('name'), err);
                cb(undefined, err);
            });
    },

    getXml: function(cb) {
        this.db.saveXml()
            .then(xml => { cb(xml); });
    },

    getKeyFileHash: function() {
        const hash = this.db.credentials.keyFileHash;
        return hash ? kdbxweb.ByteUtils.bytesToBase64(hash.getBinary()) : null;
    },

    forEachEntryTemplate: function(callback) {
        if (!this.db.meta.entryTemplatesGroup) {
            return;
        }
        const group = this.getGroup(this.subId(this.db.meta.entryTemplatesGroup.id));
        if (!group) {
            return;
        }
        group.forEachOwnEntry({}, callback);
    },

    setSyncProgress: function() {
        this.set({ syncing: true });
        Backbone.trigger('primary-file-sync-started');
    },

    setSyncComplete: function(path, storage, error, savedToCache) {
        // TODO: savedToCache could be used to report problems
        // to the user? Not sure what useful action can be taken though.
        // Remove comment in 2020 if no use identified

        if (!error) {
            this.db.removeLocalEditState();
        }
        // only modified if there was an error and we've not been told we're unmodified yet
        const modified = this.get('modified') && !!error;
        // Only dirty if save to cache failed and we've not been told we're clean yet
        const dirty = this.get('dirty') && !savedToCache;
        this.set({
            created: false,
            path: path || this.get('path'),
            storage: storage || this.get('storage'),
            modified: modified,
            dirty: dirty,
            syncing: false,
            syncError: error
        });
        Backbone.trigger('primary-file-sync-stopped');
        if (!this.get('open')) {
            return;
        }
        this.setOpenFile({ passwordLength: this.get('passwordLength') });
        this.forEachEntry({}, entry => entry.setSaved());
    },

    setPassword: function(password, emailAddrParts) {
        this.db.credentials.setPassword(password);
        this.db.meta.keyChanged = new Date();
        this.configureArgon2ParamsAuto(password, emailAddrParts);
        this.set({ passwordLength: password.textLength, passwordChanged: true });
        this.setModified();
    },

    resetPassword: function() {
        this.db.credentials.passwordHash = this._oldPasswordHash;
        if (this.db.credentials.keyFileHash === this._oldKeyFileHash) {
            this.db.meta.keyChanged = this._oldKeyChangeDate;
        }
        this.set({ passwordLength: this.get('oldPasswordLength'), passwordChanged: false });
    },

    setKeyFile: function(keyFile, keyFileName) {
        this.db.credentials.setKeyFile(keyFile);
        this.db.meta.keyChanged = new Date();
        this.set({ keyFileName: keyFileName, keyFileChanged: true });
        this.setModified();
    },

    generateAndSetKeyFile: function() {
        const keyFile = kdbxweb.Credentials.createRandomKeyFile();
        const keyFileName = 'Generated';
        this.setKeyFile(keyFile, keyFileName);
        return keyFile;
    },

    resetKeyFile: function() {
        this.db.credentials.keyFileHash = this._oldKeyFileHash;
        if (this.db.credentials.passwordHash === this._oldPasswordHash) {
            this.db.meta.keyChanged = this._oldKeyChangeDate;
        }
        this.set({ keyFileName: this.get('oldKeyFileName'), keyFileChanged: false });
    },

    removeKeyFile: function() {
        this.db.credentials.keyFileHash = null;
        const changed = !!this._oldKeyFileHash;
        if (!changed && this.db.credentials.passwordHash === this._oldPasswordHash) {
            this.db.meta.keyChanged = this._oldKeyChangeDate;
        }
        this.set({ keyFileName: '', keyFileChanged: changed });
        this.setModified();
    },

    isKeyChangePending: function(force) {
        if (!this.db.meta.keyChanged) {
            return false;
        }
        const expiryDays = force ? this.db.meta.keyChangeForce : this.db.meta.keyChangeRec;
        if (!expiryDays || expiryDays < 0 || isNaN(expiryDays)) {
            return false;
        }
        const daysDiff = (Date.now() - this.db.meta.keyChanged) / 1000 / 3600 / 24;
        return daysDiff > expiryDays;
    },

    setKeyChange: function(force, days) {
        if (isNaN(days) || !days || days < 0) {
            days = -1;
        }
        const prop = force ? 'keyChangeForce' : 'keyChangeRec';
        this.db.meta[prop] = days;
        this.set(prop, days);
        this.setModified();
    },

    setName: function(name) {
        this.db.meta.name = name;
        this.db.meta.nameChanged = new Date();
        this.set('name', name);
        this.get('groups').first().setName(name);
        this.setModified();
        this.setNameChanged();
        this.reload();
    },

    setDefaultUser: function(defaultUser) {
        this.db.meta.defaultUser = defaultUser;
        this.db.meta.defaultUserChanged = new Date();
        this.set('defaultUser', defaultUser);
        this.setModified();
    },

    setRecycleBinEnabled: function(enabled) {
        enabled = !!enabled;
        this.db.meta.recycleBinEnabled = enabled;
        if (enabled) {
            this.db.createRecycleBin();
        }
        this.set('recycleBinEnabled', enabled);
        this.setModified();
    },

    setHistoryMaxItems: function(count) {
        this.db.meta.historyMaxItems = count;
        this.set('historyMaxItems', count);
        this.setModified();
    },

    setHistoryMaxSize: function(size) {
        this.db.meta.historyMaxSize = size;
        this.set('historyMaxSize', size);
        this.setModified();
    },

    setKeyEncryptionRounds: function(rounds) {
        this.db.header.keyEncryptionRounds = rounds;
        this.set('keyEncryptionRounds', rounds);
        this.setModified();
    },

    setKdfParameter: function(field, value) {
        const ValueType = kdbxweb.VarDictionary.ValueType;
        switch (field) {
            case 'memory':
                this.db.header.kdfParameters.set('M', ValueType.UInt64, kdbxweb.Int64.from(value));
                break;
            case 'iterations':
                this.db.header.kdfParameters.set('I', ValueType.UInt64, kdbxweb.Int64.from(value));
                break;
            case 'parallelism':
                this.db.header.kdfParameters.set('P', ValueType.UInt32, value);
                break;
            default:
                return;
        }
        this.set('kdfParameters', this.readKdfParams());
        this.setModified();
    },

    emptyTrash: function() {
        const trashGroup = this.getTrashGroup();
        if (trashGroup) {
            let modified = false;
            trashGroup.getOwnSubGroups().slice().forEach(function(group) {
                this.db.move(group, null);
                modified = true;
            }, this);
            trashGroup.group.entries.slice().forEach(function(entry) {
                this.db.move(entry, null);
                modified = true;
            }, this);
            trashGroup.get('items').reset();
            trashGroup.get('entries').reset();
            if (modified) {
                this.setModified();
            }
        }
    },

    getCustomIcons: function() {
        return _.mapObject(this.db.meta.customIcons, customIcon => IconUrl.toDataUrl(customIcon));
    },

    addCustomIcon: function(iconData) {
        const uuid = kdbxweb.KdbxUuid.random();
        this.db.meta.customIcons[uuid] = kdbxweb.ByteUtils.arrayToBuffer(kdbxweb.ByteUtils.base64ToBytes(iconData));
        return uuid.toString();
    },

    renameTag: function(from, to) {
        this.forEachEntry({}, entry => entry.renameTag(from, to));
    },

    destroy: function() {
        const existingVaultEmbeddedConf = this.get('keeVaultEmbeddedConfig');
        if (existingVaultEmbeddedConf) {
            existingVaultEmbeddedConf.destroy();
        }
    }
});

FileModel.createKeyFileWithHash = function(hash) {
    return kdbxweb.Credentials.createKeyFileWithHash(hash);
};

module.exports = FileModel;
