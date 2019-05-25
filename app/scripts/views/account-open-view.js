const Backbone = require('backbone');
const kdbxweb = require('kdbxweb');
const OpenConfigView = require('./open-config-view');
const Keys = require('../const/keys');
const Alerts = require('../comp/alerts');
const SecureInput = require('../comp/secure-input');
const DropboxChooser = require('../comp/dropbox-chooser');
const KeyHandler = require('../comp/key-handler');
const StorageFileListView = require('../views/storage-file-list-view');
const Logger = require('../util/logger');
const Locale = require('../util/locale');
const UrlUtil = require('../util/url-util');
const EmailUtils = require('../util/email');
const InputFx = require('../util/input-fx');
const Comparators = require('../util/comparators');
const Storage = require('../storage');
const KPRPCHandler = require('../comp/keepassrpc');
const KeeError = require('../comp/kee-error');
const FileInfoCollection = require('../collections/file-info-collection');
const AppSettingsModel = require('../models/app-settings-model');
const KeeFrontend = require('kee-frontend');
const RuntimeInfo = require('../comp/runtime-info');

const logger = new Logger('account-open-view');

const OpenView = Backbone.View.extend({
    template: require('templates/account-open.hbs'),

    events: {
        'input .open__pass-input': 'inputInput',
        'keydown .open__pass-input': 'inputKeydown',
        'keyup .open__pass-input': 'inputKeyup',
        'keypress .open__pass-input': 'inputKeypress',
        'click #openButton': 'openDb',
        'click #accountChangeUser': 'changeUser',
        'click #resetAccount': 'resetAccount'
    },

    views: null,
    params: null,
    passwordInput: null,
    busy: false,

    initialize: function () {
        this.views = {};
        this.params = {
            id: null,
            name: '',
            storage: null,
            path: null,
            keyFileName: null,
            keyFileData: null,
            keyFilePath: null,
            fileData: null,
            rev: null
        };
        this.passwordInput = new SecureInput();
        KeyHandler.onKey(Keys.DOM_VK_Z, this.undoKeyPress, this, KeyHandler.SHORTCUT_ACTION);
        KeyHandler.onKey(Keys.DOM_VK_TAB, this.tabKeyPress, this);
        KeyHandler.onKey(Keys.DOM_VK_ENTER, this.enterKeyPress, this);
        KeyHandler.onKey(Keys.DOM_VK_RETURN, this.enterKeyPress, this);
    },

    render: function () {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        const storageProviders = [];
        Object.keys(Storage).forEach(name => {
            const prv = Storage[name];
            if (!prv.system && prv.enabled) {
                storageProviders.push(prv);
            }
        });
        storageProviders.sort((x, y) => (x.uipos || Infinity) - (y.uipos || Infinity));
        this.renderTemplate({
            accountFiles: this.getAccountFiles(),
            canOpenKeyFromDropbox: Storage.dropbox.enabled,
            accountEmail: this.model.account.get('email'),
            verificationSuccess: this.model.destinationFeature === 'verificationSuccess',
            verificationFailure: this.model.destinationFeature === 'verificationFailure',
            manageAccount: this.model.destinationFeature === 'manageAccount',
            managePayment: this.model.destinationFeature === 'managePayment'
        });
        this.inputEl = this.$el.find('.open__pass-input');
        this.passwordInput.setElement(this.inputEl);
        this.focusInput();
        return this;
    },

    focusInput: function() {
        this.inputEl.focus();
    },

    getAccountFiles: function() {
        return this.model.fileInfos.map(f => {
            let icon = 'file-text';
            const storage = Storage[f.get('storage')];
            if (storage && storage.icon) {
                icon = storage.icon;
            }
            if (storage && storage.iconSvg) {
                icon = null;
            }
            return {
                id: f.get('id'),
                name: f.get('name'),
                path: this.getDisplayedPath(f),
                icon: icon,
                iconSvg: storage ? storage.iconSvg : undefined
            };
        });
    },

    getDisplayedPath: function(fileInfo) {
        const storage = fileInfo.get('storage');
        if (storage === 'file' || storage === 'webdav') {
            return fileInfo.get('path');
        }
        return null;
    },

    remove: function() {
        this.passwordInput.reset();
        KeyHandler.offKey(Keys.DOM_VK_Z, this.undoKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_TAB, this.tabKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_ENTER, this.enterKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_RETURN, this.enterKeyPress, this);
        Backbone.View.prototype.remove.apply(this, arguments);
    },

    processFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = e => {
            let success = false;
            switch (this.reading) {
                case 'fileData':
                    if (!this.checkOpenFileFormat(e.target.result)) {
                        break;
                    }
                    this.params.id = null;
                    this.params.fileData = e.target.result;
                    this.params.name = file.name.replace(/(.+)\.\w+$/i, '$1');
                    this.params.path = file.path || null;
                    this.params.storage = file.path ? 'file' : null;
                    this.params.rev = null;
                    if (!this.params.keyFileData) {
                        this.params.keyFileName = null;
                    }
                    this.displayOpenFile();
                    this.displayOpenKeyFile();
                    success = true;
                    break;
                case 'keyFileData':
                    this.params.keyFileData = e.target.result;
                    this.params.keyFileName = file.name;
                    if (this.model.settings.get('rememberKeyFiles') === 'path') {
                        this.params.keyFilePath = file.path;
                    }
                    this.displayOpenKeyFile();
                    success = true;
                    break;
            }
            if (complete) {
                complete(success);
            }
        };
        reader.onerror = () => {
            Alerts.error({ header: Locale.openFailedRead });
            if (complete) {
                complete(false);
            }
        };
        if (this.reading === 'fileXml') {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    },

    checkOpenFileFormat: function(fileData) {
        const fileSig = fileData.byteLength < 8 ? null : new Uint32Array(fileData, 0, 2);
        if (!fileSig || fileSig[0] !== kdbxweb.Consts.Signatures.FileMagic) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileBody });
            return false;
        }
        if (fileSig[1] === kdbxweb.Consts.Signatures.Sig2Kdb) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openKdbFileBody });
            return false;
        }
        if (fileSig[1] !== kdbxweb.Consts.Signatures.Sig2Kdbx) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileBody });
            return false;
        }
        return true;
    },

    displayOpenFile: function() {
        this.$el.addClass('open--file');
        this.$el.find('.open__settings-key-file').removeClass('hide');
        this.inputEl[0].removeAttribute('readonly');
        this.inputEl[0].setAttribute('placeholder', Locale.openPassFor + ' ' + this.params.name);
        this.focusInput();
    },

    displayOpenKeyFile: function() {
        this.$el.toggleClass('open--key-file', !!this.params.keyFileName);
        this.$el.find('.open__settings-key-file-name').text(this.params.keyFileName || this.params.keyFilePath || Locale.openKeyFile);
        this.focusInput();
    },

    setFile: function(file, keyFile, fileReadyCallback) {
        this.reading = 'fileData';
        this.processFile(file, success => {
            if (success && keyFile) {
                this.reading = 'keyFileData';
                this.processFile(keyFile);
            }
            if (success && typeof fileReadyCallback === 'function') {
                fileReadyCallback();
            }
        });
    },

    openFile: function() {
        if (this.model.settings.get('canOpen') === false) {
            return;
        }
        if (!this.busy) {
            this.closeConfig();
            this.openAny('fileData');
        }
    },

    importFromXml: function() {
        if (!this.busy) {
            this.closeConfig();
            this.openAny('fileXml', 'xml');
        }
    },

    openKeyFile: function(e) {
        if ($(e.target).hasClass('open__settings-key-file-dropbox')) {
            this.openKeyFileFromDropbox();
        } else if (!this.busy && this.params.name) {
            if (this.params.keyFileName) {
                this.params.keyFileData = null;
                this.params.keyFilePath = null;
                this.params.keyFileName = '';
                this.$el.removeClass('open--key-file');
                this.$el.find('.open__settings-key-file-name').text(Locale.openKeyFile);
            } else {
                this.openAny('keyFileData');
            }
        }
    },

    openKeyFileFromDropbox: function() {
        if (!this.busy) {
            new DropboxChooser((err, res) => {
                if (err) {
                    return;
                }
                this.params.keyFileData = res.data;
                this.params.keyFileName = res.name;
                this.displayOpenKeyFile();
            }).choose();
        }
    },

    openAny: function(reading, ext) {
        this.reading = reading;
        this.params[reading] = null;

        const fileInput = this.$el.find('.open__file-ctrl').attr('accept', ext || '').val(null);

        fileInput.click();
    },

    openLast: function(e) {
        if (this.busy) {
            return;
        }
        const id = $(e.target).closest('.open__last-item').data('id').toString();
        if ($(e.target).is('.open__last-item-icon-del')) {
            const fileInfo = this.model.fileInfos.get(id);
            if (!fileInfo.get('storage') || fileInfo.get('modified')) {
                Alerts.yesno({
                    header: Locale.openRemoveLastQuestion,
                    body: fileInfo.get('modified') ? Locale.openRemoveLastQuestionModBody : Locale.openRemoveLastQuestionBody,
                    buttons: [
                        {result: 'yes', title: Locale.alertYes},
                        {result: '', title: Locale.alertNo}
                    ],
                    success: () => {
                        this.removeFile(id);
                    }
                });
                return;
            }
            this.removeFile(id);
            return;
        }

        const fileInfo = this.model.fileInfos.get(id);
        this.showOpenFileInfo(fileInfo);
    },

    removeFile: function(id) {
        this.model.removeFileInfo(id);
        this.$el.find('.open__last-item[data-id="' + id + '"]').remove();
        this.initialize();
        this.render();
    },

    inputKeydown: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeyup: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeypress: function(e) {
        const charCode = e.keyCode || e.which;
        if (charCode === Keys.DOM_VK_RETURN) {
            this.openDb();
            return;
        }
        const ch = String.fromCharCode(charCode);
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        if (lower !== upper && !e.shiftKey) {
            this.toggleCapsLockWarning(ch !== lower);
        }
    },

    toggleCapsLockWarning: function(on) {
        this.$el.find('.open__pass-warning').toggleClass('invisible', !on);
    },

    undoKeyPress(e) {
        e.preventDefault();
    },

    tabKeyPress() {
        this.$el.addClass('open--show-focus');
    },

    enterKeyPress(e) {
        const el = this.$el.find('[tabindex]:focus');
        if (el.length) {
            el.trigger('click', e);
        }
    },

    changeUser() {
        this.model.settings.set('rememberedAccountEmail', null);
        Backbone.trigger('show-account');
    },

    resetAccount() {
        window.location.hash = '#dest=resetPassword';
        window.location.reload();
    },

    showOpenFileInfo: function(fileInfo) {
        if (this.busy || !fileInfo) {
            return;
        }
        this.params.id = fileInfo.id;
        this.params.storage = fileInfo.get('storage');
        this.params.path = fileInfo.get('path');
        this.params.name = fileInfo.get('name');
        this.params.fileData = null;
        this.params.rev = null;
        this.params.keyFileName = fileInfo.get('keyFileName');
        this.params.keyFilePath = fileInfo.get('keyFilePath');
        this.params.keyFileData = null;
        this.displayOpenFile();
        this.displayOpenKeyFile();
    },

    createDemo: function() {
        if (!this.busy) {
            this.closeConfig();
            if (!this.model.createDemoFile()) {
                this.trigger('close');
            }
            if (!this.model.settings.get('demoOpened')) {
                this.model.settings.set('demoOpened', true);
            }
        }
    },

    createNew: function() {
        if (!this.busy) {
            this.model.createNewFile();
        }
    },

    showOfflineAccessIfAvailable: async function() {
        // We store the latest client token locally so that existing users with a local
        // copy of their vault can get some level of access when offline
        // At this point we don't care whether the user is currently logged in or this
        // token is from a previous session
        let latestClientToken;
        let localCacheFileInfo = false;
        const jwts = AppSettingsModel.instance.get('recentClientTokens');
        const jwt = jwts[this.model.account.get('email')];
        if (jwt) {
            const {audience, claim} = await KeeFrontend.User.UserManager.verifyJWT(jwt);
            if (audience === 'client' && claim !== undefined) {
                // We allow up to a month grace period for the JWT - abuse of this may enable
                // short-term unpaid access to some features, though the details of individual
                // feature checks will also affect how that business risk plays out
                if (claim.exp + 2628000000 > Date.now()) {
                    latestClientToken = claim;

                    // We can safely load the cached Vault because:
                    // a) claimed email hash was at least recently correct
                    // b) user supplied master password is still required to open
                    const emailHashed = latestClientToken.sub;
                    await this.model.fileInfos.load(emailHashed);
                    localCacheFileInfo = this.model.fileInfos.models[0];
                }
            }
        }

        if (!latestClientToken || !localCacheFileInfo) {
            // We want to show this when any login connection error is hit, even if the user has
            // yet to have cached a local copy of their vault
            Alerts.error({
                header: Locale.connectionRequired,
                body: Locale.connectionRequiredLine1 + '<br/><br/>' +
                    Locale.connectionRequiredLine2 + '<br/><br/>' +
                    Locale.connectionRequiredLine3,
                esc: false, enter: false, click: false,
                success: () => {
                    this.model.settings.set('rememberedAccountEmail', null);
                    this.model.prefillEmail = this.model.account.get('email');
                    Backbone.trigger('show-account');
                    this.model.prefillEmail = null;
                }
            });
        } else {
            if (latestClientToken.features.indexOf('storage-kee') < 0 ||
                latestClientToken.featureExpiry + 604800000 < Date.now()) { // one week grace period
                setTimeout(() => Backbone.trigger('lock-workspace'), 180000);
                Alerts.error({
                    header: Locale.subscriptionRequired,
                    body: Locale.subscriptionRequiredLine1 + '<br/><br/>' +
                        Locale.subscriptionRequiredLine2 + '<br/><br/>' +
                        Locale.subscriptionRequiredLine3.replace('{}', localCacheFileInfo.get('syncDate')),
                    buttons: [
                        { result: 'reload', title: Locale.reloadApp },
                        { result: 'continue', title: Locale.continueReadOnly, error: true }
                    ],
                    success: (result) => {
                        if (result === 'reload') {
                            window.location.reload();
                        }
                        if (result === 'continue') {
                            this.model.set('readOnly', true);
                            this.openDbOffline(localCacheFileInfo);
                        }
                    },
                    icon: 'question',
                    esc: false, enter: false, click: false
                });
            } else {
                this.startOpenDbOffline(localCacheFileInfo);
            }
        }
    },

    openDbOffline: async function (localCacheFileInfo) {
        const storage = Storage['vault'];
        if (!storage) {
            throw new Error('Missing storage provider');
        }
        this.params.id = null;
        this.params.storage = storage.name;
        this.params.path = localCacheFileInfo.get('path');
        this.params.name = localCacheFileInfo.get('name');
        this.params.rev = localCacheFileInfo.get('rev');
        this.params.fileData = null;
        const promise = new Promise((resolve, reject) => {
            const openFileFunc = this.model.openFile.bind(this.model, this.params, (err) => {
                // Close Alert before processing success/error from file operation
                resolve();
                setTimeout(this.openDbComplete(err), 1);
            });
            openFileFunc();
        });
        await promise;
    },

    startOpenDbOffline: function(localCacheFileInfo) {
        Alerts.alert({
            header: Locale.offlineConfirmation,
            body: Locale.offlineConfirmationBody.replace('{}', localCacheFileInfo.get('syncDate')),
            buttons: [
                { asyncresult: 'open', title: Locale.accessOffline }
            ],
            success: async (asyncResult) => {
                if (asyncResult === 'open') {
                    await this.openDbOffline(localCacheFileInfo);
                }
            },
            icon: 'question',
            esc: false, enter: 'open', click: false
        });
    },

    openDb: function() {
        if (this.params.id && this.model.files.get(this.params.id)) {
            // already open
            this.trigger('close');
            return;
        }
        if (this.busy) {
            return;
        }
        Backbone.trigger('progress-open-start');
        const openButton = $('#openButton')[0];
        openButton.classList.add('active');
        openButton.setAttribute('disabled', 'disabled');

        this.$el.toggleClass('open--opening', true);
        this.inputEl.attr('disabled', 'disabled');
        this.busy = true;
        this.params.password = this.passwordInput.value; // a kdbxweb.ProtectedValue
        this.afterPaint(this.loginAndUnlock.bind(this));
    },

    login: async function() {
        const trueOrError = await this.model.account.loginFinish(await this.params.password.getHash());
        if (trueOrError === true && this.model.couponCode && this.model.couponCode.startsWith('PRODHUNT')) {
            try {
                const couponResult = await this.model.account.applyCouponToSubscription(this.model.couponCode);
                logger.info('Result of applying coupon to subscription account: ' + couponResult);
            } catch (e) {
                logger.error('Error applying coupon to subscription account: ' + e);
            }
        }
        return trueOrError;
    },

    tryLogin: async function() {
        Backbone.trigger('progress-open-loginFinishStart');
        const trueOrError = await this.login();
        Backbone.trigger('progress-open-loginFinishFinish');

        if (trueOrError !== true) {
            if (trueOrError === KeeError.LoginFailed) {
                logger.error('Login failed');
                // We need to restart the login because SRP only allows us one attempt at a time
                await this.model.account.loginRestart();
                this.busy = false;
                const openButton = $('#openButton')[0];
                openButton.classList.remove('active');
                openButton.removeAttribute('disabled');
                this.inputEl.removeAttr('disabled').toggleClass('input--error', true);
                this.focusInput();
                this.inputEl[0].selectionStart = 0;
                this.inputEl[0].selectionEnd = this.inputEl.val().length;
                InputFx.shake(this.inputEl);
            } else {
                logger.error('Login error');
                this.busy = false;
                const openButton = $('#openButton')[0];
                openButton.classList.remove('active');
                openButton.removeAttribute('disabled');
                this.inputEl.removeAttr('disabled');
                this.focusInput();
                this.showOfflineAccessIfAvailable();
            }
            return false;
        }

        // Record the client tokens to help us decide on the best action to
        // take if the next time the user loads the app it is in offline
        // mode or they're not logged in yet
        const clientToken = this.model.account.get('user').tokens.client;
        AppSettingsModel.instance.set('latestClientToken', clientToken);
        const jwts = AppSettingsModel.instance.get('recentClientTokens') || {};
        jwts[this.model.account.get('email')] = clientToken;
        // Have to unset first because Backbone
        AppSettingsModel.instance.unset('recentClientTokens', { silent: true });
        AppSettingsModel.instance.set('recentClientTokens', jwts);

        // Notify any connected browser-addon that we have new account credentials
        KPRPCHandler.sendServiceAccessTokens(this.model.account.latestTokens());

        this.model.prefillEmail = null;
        this.model.couponCode = null;

        return true;
    },

    loginAndUnlock: async function() {
        // just in case that opens any unexpected risk here
        if (this.model.account.latestTokens().length <= 0) {
            const loggedIn = await this.tryLogin();
            if (!loggedIn) {
                Backbone.trigger('progress-open-end');
                return;
            }
        }
        // else we have previously logged in so can just attempt to open the DB directly
        // The JWTs may have expired but the storage sync and other services will
        // quickly establish if that's the case and use the current password to
        // re-login seamlessly
        // TODO: Maybe track likely session expiry? Might result in better performance / cost?

        const user = this.model.account.get('user');
        const tokens = user.tokens;
        if (!tokens || !tokens.identity || !tokens.sso) {
            Alerts.error({
                header: Locale.unexpectedError,
                body: Locale.unexpectedServerResponse
            });
            return;
        }

        if (this.model.destinationFeature === 'manageAccount') {
            Backbone.trigger('progress-open-end');
            window.location = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=manageAccount,id=' + tokens.sso;
            return;
        } else if (this.model.destinationFeature === 'managePayment') {
            Backbone.trigger('progress-open-end');
            window.location = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=managePayment,id=' + tokens.sso;
            return;
        }
        this.model.destinationFeature = null;

        if (!tokens.storage || !tokens.client || !user.features ||
            !user.features.enabled || user.features.enabled.indexOf('storage-kee') < 0) {
            // User's subscription has expired
            Alerts.error({
                header: Locale.subscriptionRequired,
                body: Locale.subscriptionExpired,
                buttons: [
                    { result: 'manage', title: Locale.manageMySubscription }
                ],
                esc: false, enter: false, click: false,
                success: (result) => {
                    if (result === 'manage') {
                        const otherWindow = window.open();
                        otherWindow.opener = null;
                        otherWindow.location = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=manageAccount,id=' + tokens.sso;
                        Alerts.info({
                            header: Locale.keeAccount,
                            icon: 'redo',
                            body: Locale.reloadPageWhenReady,
                            buttons: [
                                { result: 'reload', title: Locale.reloadApp }
                            ],
                            esc: false, enter: false, click: false,
                            success: (result) => {
                                if (result === 'reload') {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                }
            });
            return;
        }
        if (!user.initialSignin && user.verificationStatus !== 3) {
            Alerts.error({
                header: Locale.emailVerification,
                body: Locale.verificationRequest,
                icon: 'envelope',
                buttons: [{asyncresult: 'resend', title: Locale.resendVerification}],
                esc: false, enter: false, click: false,
                success: async (asyncResult) => {
                    if (asyncResult === 'resend') {
                        const trueOrError = await user.resendVerificationEmail();
                        if (trueOrError !== true) {
                            logger.error('Did not receive valid response from attempt to resend email verification. Unsure if it worked or not.', trueOrError);
                            Alerts.error({
                                header: Locale.unexpectedError,
                                body: Locale.unexpectedServerResponse,
                                buttons: [],
                                esc: false, enter: false, click: false
                            });
                        } else {
                            Alerts.info({
                                header: Locale.emailVerification,
                                icon: 'envelope',
                                body: Locale.checkYourEmail,
                                buttons: [],
                                esc: false, enter: false, click: false
                            });
                        }
                    }
                }
            });
            return;
        }
        await FileInfoCollection.instance.load(user.emailHashed);

        this.model.settings.set('vaultIntroCompleted', true);

        const storage = Storage['vault'];
        if (!storage) {
            throw new Error('Missing storage provider');
        }
        Backbone.trigger('progress-open-findDBStart');
        storage.list(false, async (err, files) => {
            Backbone.trigger('progress-open-findDBEnd');
            this.busy = false;
            if (err || !files) {
                let abortUnlock = false;
                if (err === 'probably offline') {
                    logger.warn('File list error. Probably gone offline.');
                    this.showOfflineAccessIfAvailable();
                    abortUnlock = true;
                } else if (err === 'storage item not found') {
                    logger.error('No files were found. Probably something went wrong with the initial signup');
                    try {
                        const emailAddrParts = EmailUtils.split(this.model.account.get('email'));
                        const siOrError = await this.model.account.uploadInitialVault(user, this.params.password, emailAddrParts);
                        if (!siOrError.emailHashed) {
                            return siOrError;
                        }
                        files = [{
                            name: siOrError.name,
                            path: siOrError.id,
                            rev: undefined,
                            dir: false
                        }];
                        Alerts.info({
                            header: Locale.resetHeader,
                            body: Locale.resetBody
                        });
                    } catch (e) {
                        Alerts.error({
                            header: Locale.openNothingFound,
                            body: Locale.openNothingFoundBody
                        });
                        logger.error(e);
                        abortUnlock = true;
                    }
                } else if (err === 'unknown list error') {
                    logger.warn('File list error. Turning off and on again might help.');
                    Alerts.error({
                        header: Locale.fileListError,
                        body: Locale.fileListErrorBody
                    });
                    abortUnlock = true;
                }
                this.busy = false;
                const openButton = $('#openButton')[0];
                openButton.classList.remove('active');
                openButton.removeAttribute('disabled');
                this.inputEl.removeAttr('disabled');
                if (abortUnlock) {
                    this.focusInput();
                    return;
                }
            }

            Backbone.trigger('progress-open-downloadDBStart');
            // Primary file
            const file = files[0];

            this.params.id = null;
            this.params.storage = storage.name;
            this.params.path = file.path;
            this.params.name = UrlUtil.getDataFileName(file.name);
            this.params.rev = file.rev;
            this.params.fileData = null;
            const openFileFunc = this.model.openFile.bind(this.model, this.params, this.openDbComplete.bind(this));
            openFileFunc();
        });
    },

    openDbComplete: function(err) {
        this.busy = false;
        const tempRemoteSyncPassword = this.params.tempRemoteSyncPassword;
        this.params.tempRemoteSyncPassword = null;

        const openButton = $('#openButton')[0];
        if (openButton) {
            openButton.classList.remove('active');
            openButton.removeAttribute('disabled');
        }
        if (this.inputEl) {
            this.inputEl.removeAttr('disabled').toggleClass('input--error', !!err);
        }
        if (err) {
            logger.error('Error opening file', err);
            this.focusInput();
            this.inputEl[0].selectionStart = 0;
            this.inputEl[0].selectionEnd = this.inputEl.val().length;
            if (err.code === 'InvalidKey') {
                // If user logged in within past minute, chances are this is due to a cached
                // version of the file having an outdated master key. NB: existing auth tokens
                // are invalidated and expired token refresh operations always check for revocation.
                if (!tempRemoteSyncPassword && this.model.account.get('lastSuccessfulLogin') > (Date.now() - 60000)) {
                    Alerts.info({
                        header: Locale.keyChangeTitleRemote,
                        body: Locale.recentPasswordChangeOld
                    });
                    this.params.tempRemoteSyncPassword = this.params.password;
                } else {
                    if (tempRemoteSyncPassword) {
                        // User got the old password wrong so this lets them retry
                        this.params.tempRemoteSyncPassword = tempRemoteSyncPassword;
                    }
                    InputFx.shake(this.inputEl);
                }
            } else {
                if (err.notFound) {
                    err = Locale.openErrorFileNotFound;
                }
                Alerts.error({
                    header: Locale.openError,
                    body: Locale.openErrorDescription + '<pre class="modal__pre">' + _.escape(err.toString()) + '</pre>'
                });
            }
        } else {
            this.trigger('close');
        }
        Backbone.trigger('progress-open-end');
    },

    toggleMore: function() {
        if (this.busy) {
            return;
        }
        this.closeConfig();
        this.$el.find('.open__icons--lower').toggleClass('hide');
    },

    openSettings: function() {
        Backbone.trigger('toggle-settings');
    },

    openStorage: function(e) {
        if (this.busy) {
            return;
        }
        const storage = Storage[$(e.target).closest('.open__icon').data('storage')];
        if (!storage) {
            return;
        }
        if (storage.needShowOpenConfig && storage.needShowOpenConfig()) {
            this.showConfig(storage);
        } else if (storage.list) {
            this.listStorage(storage);
        } else {
            Alerts.notImplemented();
        }
    },

    listStorage: function(storage, config) {
        if (this.busy) {
            return;
        }
        this.closeConfig();
        this.busy = true;
        storage.list(config && config.dir, (err, files) => {
            this.busy = false;
            if (err || !files) {
                err = err ? err.toString() : '';
                if (err.lastIndexOf('OAuth', 0) !== 0 && !Alerts.alertDisplayed) {
                    Alerts.error({
                        header: Locale.openError,
                        body: Locale.openListErrorBody + '<pre class="modal__pre">' + _.escape(err.toString()) + '</pre>'
                    });
                }
                return;
            }
            if (!files.length) {
                Alerts.error({
                    header: Locale.openNothingFound,
                    body: Locale.openNothingFoundBody
                });
                return;
            }

            const fileNameComparator = Comparators.stringComparator('path', true);
            files.sort((x, y) => {
                if (x.dir !== y.dir) {
                    return !!y.dir - !!x.dir;
                }
                return fileNameComparator(x, y);
            });
            if (config && config.dir) {
                files.unshift({
                    path: config.prevDir,
                    name: '..',
                    dir: true
                });
            }
            const listView = new StorageFileListView({
                model: {
                    files,
                    showHiddenFiles: config && config.showHiddenFiles
                }
            });
            listView.on('selected', file => {
                if (file.dir) {
                    this.listStorage(storage, {
                        dir: file.path,
                        prevDir: config && config.dir || '',
                        showHiddenFiles: true
                    });
                } else {
                    this.openStorageFile(storage, file);
                }
            });
            Alerts.alert({
                header: Locale.openSelectFile,
                body: Locale.openSelectFileBody,
                icon: storage.icon || 'files-o',
                buttons: [{result: '', title: Locale.alertCancel}],
                esc: '',
                click: '',
                view: listView
            });
        });
    },

    openStorageFile: function(storage, file) {
        if (this.busy) {
            return;
        }
        this.params.id = null;
        this.params.storage = storage.name;
        this.params.path = file.path;
        this.params.name = UrlUtil.getDataFileName(file.name);
        this.params.rev = file.rev;
        this.params.fileData = null;
        this.displayOpenFile();
    },

    showConfig: function(storage) {
        if (this.busy) {
            return;
        }
        if (this.views.openConfig) {
            this.views.openConfig.remove();
        }
        const config = _.extend({
            id: storage.name,
            name: Locale[storage.name] || storage.name,
            icon: storage.icon,
            buttons: true
        }, storage.getOpenConfig());
        this.views.openConfig = new OpenConfigView({ el: this.$el.find('.open__config-wrap'), model: config }).render();
        this.views.openConfig.on('cancel', this.closeConfig.bind(this));
        this.views.openConfig.on('apply', this.applyConfig.bind(this));
        this.$el.find('.open__pass-area').addClass('hide');
        this.$el.find('.open__icons--lower').addClass('hide');
    },

    closeConfig: function() {
        if (this.busy) {
            this.storageWaitId = null;
            this.busy = false;
        }
        if (this.views.openConfig) {
            this.views.openConfig.remove();
            delete this.views.openConfig;
        }
        this.$el.find('.open__pass-area').removeClass('hide');
        this.$el.find('.open__config').addClass('hide');
        this.focusInput();
    },

    applyConfig: function(config) {
        if (this.busy || !config) {
            return;
        }
        this.busy = true;
        this.views.openConfig.setDisabled(true);
        const storage = Storage[config.storage];
        this.storageWaitId = Math.random();
        const path = config.path;
        const opts = _.omit(config, ['path', 'storage']);
        const req = {
            waitId: this.storageWaitId,
            storage: config.storage,
            path: path,
            opts: opts
        };
        if (storage.applyConfig) {
            storage.applyConfig(opts, this.storageApplyConfigComplete.bind(this, req));
        } else {
            storage.stat(path, opts, this.storageStatComplete.bind(this, req));
        }
    },

    storageApplyConfigComplete: function(req, err) {
        if (this.storageWaitId !== req.waitId) {
            return;
        }
        this.storageWaitId = null;
        this.busy = false;
        if (err) {
            this.views.openConfig.setDisabled(false);
            this.views.openConfig.setError(err);
        } else {
            this.closeConfig();
        }
    },

    storageStatComplete: function(req, err, stat) {
        if (this.storageWaitId !== req.waitId) {
            return;
        }
        this.storageWaitId = null;
        this.busy = false;
        if (err) {
            this.views.openConfig.setDisabled(false);
            this.views.openConfig.setError(err);
        } else {
            this.closeConfig();
            this.params.id = null;
            this.params.storage = req.storage;
            this.params.path = req.path;
            this.params.opts = req.opts;
            this.params.name = UrlUtil.getDataFileName(req.path);
            this.params.rev = stat.rev;
            this.params.fileData = null;
            this.displayOpenFile();
        }
    }
});

module.exports = OpenView;
