const Backbone = require('backbone'),
    KPRPC = require('kprpc').KPRPC,
    PasswordGenerator = require('../util/password-generator.js'),
    Logger = require('../util/logger'),
    RuntimeInfo = require('./runtime-info'),
    EntryModel = require('../models/entry-model'),
    PSL = require('../util/psl'),
    GeneratorPresets = require('../comp/generator-presets');

const logger = new Logger('kprpc');
let app;
let appView;
let kprpc;
let latestAddonConfig;
let deferModificationActions = false;

function getGroup (uuid, dbFileId) {
    const items = [];

    if (!dbFileId) {
        app.files.forEach(file => {
            const g = file.getGroup(uuid);
            if (g) items.push(g);
        });
    } else {
        const file = app.files._byId[dbFileId];
        const g = file.getGroup(file.subId(uuid));
        if (g) items.push(g);
    }
    return items;
}

function getEntry (uuid, dbFileId) {
    const items = [];

    if (!dbFileId) {
        app.files.forEach(file => {
            const e = file.getEntry(uuid);
            if (e) items.push(e);
        });
    } else {
        const file = app.files._byId[dbFileId];
        const e = file.getEntry(file.subId(uuid));
        if (e) items.push(e);
    }
    return items;
}

function requestHostBrowserFocus () {
    if (window.messageToKeeAddon) window.messageToKeeAddon({ focusRequired: true });
}

function ping () {
    if (window.messageToKeeAddon) window.messageToKeeAddon({ ping: true });
}

function messageToKeeAddonProxy (msg) {
    if (window.messageToKeeAddon) window.messageToKeeAddon(msg);
}

function editGroup (item) {
    appView.editGroup(item);
    requestHostBrowserFocus();
}

function editEntry (item) {
    let groupEl = document.querySelector('.menu__section .menu__item--active');
    let itemEl = document.getElementById(item.id);
    while (!itemEl) {
        groupEl = groupEl.parentElement;
        if (groupEl.classList.contains('menu')) {
            Backbone.trigger('show-file', { fileId: item.file.id });
        } else {
            groupEl.click();
        }
        itemEl = document.getElementById(item.id);
    }

    appView.views.list.selectItem(item);
    appView.showEntries();
    requestHostBrowserFocus();
}

function getFileInfos () {
    return app.fileInfos;
}

function getFiles () {
    return app.files;
}

function generatePassword (profileDisplayName, url) {
    const presets = GeneratorPresets.enabled;
    const opts = profileDisplayName ? presets.find(p => p.title === profileDisplayName) : presets.find(p => p.default);
    return PasswordGenerator.generate(opts);
    // TODO: (probably in caller function) store in database as backup? ... at which point we probably need to defer this when syncing
}

function getPasswordProfiles () {
    return GeneratorPresets.enabled.map(p => p.title);
}

function openOrUnlockOrFocusFile (dbFileId) {
    let fileInfo, file;

    try {
        fileInfo = app.fileInfos.get(dbFileId);
    } catch (e) {}

    if (!fileInfo) {
        // We don't know about this file so can't open it or establish if it's already open.
        // The best we can do is launch the open file feature so the user can find it themselves.
        appView.showOpenFile();
        requestHostBrowserFocus();
        return;
    }

    try {
        file = app.files._byId[dbFileId];
    } catch (e) {}

    if (!file || !file.open) {
        // We know of this file but it's not open, so let's change that.
        // app.openFile({name:fileInfo.name,id:fileInfo.id})
        appView.showOpenFile();
        appView.views.open.showOpenFileInfo(fileInfo);
        requestHostBrowserFocus();
    }
}

function addEntry (parentGroup, chosenFile, login, modelConverter) {
    const newLoginModel = EntryModel.newEntry(parentGroup, chosenFile);
    let newLogin = newLoginModel.entry;
    newLogin = modelConverter(chosenFile.db, login, newLogin, PSL.getDomain);
    newLoginModel.setEntry(newLogin, parentGroup, chosenFile);

    chosenFile.reload();

    if (getSetting('autosave')) {
        app.syncFile(chosenFile, { skipValidation: true, startedByUser: false });
    }

    return newLogin;
}

function getSetting (name) {
    // immediately edit
    // save generated passwords
    // autosave
    // TODO: Implement settings system if/when they become relevant to the new UX
    return 'true';
}

function sendServiceAccessTokens (tokens) {
    messageToKeeAddonProxy({tokens});
}

function onKeeAddonEnabled () {
    Backbone.trigger('kee-addon-enabled');
}

function onKeeAddonActivated () {
    Backbone.trigger('kee-addon-activated');
}

function updateAddonSettings (settings, version) {
    // Store addon settings in the Vault - NB: Reading these settings from the
    // Vault is done along with the main Database enumeration command
    Backbone.trigger('update-addon-settings', {settings, version});
}

function applyAddonConfig (config) {
    latestAddonConfig = config;
}

function readAddonSettings () {
    return latestAddonConfig;
}

const deferPromiseResolvers = [];

async function delayUntilIntegrationReady () {
    if (!deferModificationActions) return;
    const deferPromise = new Promise((resolve, reject) => {
        deferPromiseResolvers.push(resolve);
    });
    await deferPromise;
}

function launchBuiltInPasswordGenerator () {
    Backbone.trigger('show-password-generator');
}

function syncFile (file, options) {
    app.syncFile(file, options);
}

const integration = {
    getGroup,
    getEntry,
    requestHostBrowserFocus,
    ping,
    getDomain: PSL.getDomain,
    editGroup,
    editEntry,
    getFiles,
    getFileInfos,
    messageToKeeAddonProxy: messageToKeeAddonProxy,
    generatePassword,
    getPasswordProfiles,
    openOrUnlockOrFocusFile,
    addEntry,
    getSetting,
    onKeeAddonEnabled,
    onKeeAddonActivated,
    updateAddonSettings,
    readAddonSettings,
    delayUntilIntegrationReady,
    launchBuiltInPasswordGenerator,
    syncFile
};

const KPRPCHandler = {
    tempimp: null,

    init: function (appV) {
        app = appV.model;
        appView = appV;
        kprpc = new KPRPC();

        kprpc.init(integration, logger, 'Kee Vault ' + RuntimeInfo.version);
        appV.model.setKPRPCActions({
            onOpened: function() {
                kprpc.notify(KPRPC.SIGNAL_OPENED);
            },
            onClosed: function() {
                kprpc.notify(KPRPC.SIGNAL_CLOSED);
            },
            onSaved: function() {
                kprpc.notify(KPRPC.SIGNAL_SAVED);
            }
        });
        Backbone.listenTo(Backbone, 'primary-file-sync-started', () => {
            deferModificationActions = true;
        });
        Backbone.listenTo(Backbone, 'primary-file-sync-stopped', () => {
            deferModificationActions = false;
            let deferPromiseResolver;
            while ((deferPromiseResolver = deferPromiseResolvers.shift()) !== undefined) {
                deferPromiseResolver();
            }
        });
    },
    shutdown: function () {
        kprpc.shutdown();
    },
    sendServiceAccessTokens,
    applyAddonConfig,
    getModelMasher: function () {
        return kprpc.getModelMasher();
    }
};

module.exports = KPRPCHandler;
