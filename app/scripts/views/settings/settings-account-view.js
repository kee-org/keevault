const Backbone = require('backbone');
const kdbxweb = require('kdbxweb');
const Keys = require('../../const/keys');
const PasswordStrength = require('../../util/password-strength');
const Locale = require('../../util/locale');
const Logger = require('../../util/logger');
const AccountModel = require('../../models/account-model');
const Alerts = require('../../comp/alerts');
const AppSettingsModel = require('../../models/app-settings-model');
const RuntimeInfo = require('../../comp/runtime-info');
const SettingsCommsView = require('./settings-comms-view');
const MessagesService = require('../../comp/messages-service');
const EmailUtils = require('../../util/email');

const logger = new Logger('settings-account-view');

const SettingsAccountView = Backbone.View.extend({
    template: require('templates/settings/settings-account.hbs'),

    events: {
        'input #settings__account-master-pass,#settings__account-master-pass-confirm': 'passwordTyped',
        'paste #settings__account-master-pass,#settings__account-master-pass-confirm': 'passwordPasted',
        'keydown #settings__account-master-pass,#settings__account-master-pass-confirm': 'inputKeydown',
        'keyup #settings__account-master-pass,#settings__account-master-pass-confirm': 'inputKeyup',
        'keypress #settings__account-master-pass,#settings__account-master-pass-confirm': 'inputKeypress',
        'click #changeAccountPasswordButton': 'changePassword',
        'click #accountSettingsSignin': 'login',
        'click #accountSettingsSignout': 'logout',
        'click #manageAccountButton': 'manageAccount',
        'click .settings__account-show-support-info': 'showSupportInfo'
    },

    views: null,
    emailAddrParts: [],

    initialize: function() {
        this.views = {};
        this.listenTo(Backbone, 'reloadCustomerSupportView', this.loadSupportAccountData);
    },

    render: function() {
        const appInfo = 'Kee Vault v' + RuntimeInfo.version + ' (' + RuntimeInfo.commit + ', ' + RuntimeInfo.buildDate + ')\n' +
            'Environment: web\n' +
            'User-Agent: ' + RuntimeInfo.userAgent;
        const user = AccountModel.instance.get('user');
        const possiblyLoggedIn = this.appModel.account.latestTokens().length > 0;
        const emailVerified = this.appModel.account.isUserEmailVerified();
        this.emailAddrParts = EmailUtils.split(this.appModel.account.get('email'));
        this.renderTemplate({
            accountEmail: this.appModel.account.get('email'),
            possiblyLoggedIn,
            emailVerified,
            appInfo: _.escape(appInfo),
            uniqueUserId: user ? user.emailHashed : 'not signed in'
        });
        PasswordStrength.renderPasswordStrength(0, this.$el);
        if (possiblyLoggedIn && emailVerified) this.loadSupportAccountData();
        return this;
    },

    passwordTyped: function(e) {
        const newValue = this.$el.find('#settings__account-master-pass').val();
        if (newValue) {
            const confirmValue = this.$el.find('#settings__account-master-pass-confirm').val();
            if (confirmValue === newValue) {
                this.$el.find('#changeAccountPasswordButton').removeAttr('disabled');
                this.$el.find('#settings__account-master-pass-confirm').removeClass('input--error');
            } else {
                this.$el.find('#changeAccountPasswordButton').attr('disabled', 'disabled');
                this.$el.find('#settings__account-master-pass-confirm').addClass('input--error');
            }
            PasswordStrength.updateAndRender(newValue, this.emailAddrParts, this.$el);
            return;
        } else {
            PasswordStrength.renderPasswordStrength(0, this.$el);
        }
        this.$el.find('#changeAccountPasswordButton').attr('disabled', 'disabled');
    },

    passwordPasted: function(e) {
        Alerts.error({ header: Locale.willYouRemember, body: Locale.pasteMasterPasswordWarning });
    },

    changePassword: async function() {
        if (this.appModel.files.length <= 0) return;

        this.$el.find('#settings__account-master-pass-result')[0].innerText = '';
        const changeButton = this.$el.find('#changeAccountPasswordButton')[0];
        changeButton.classList.add('active');
        changeButton.setAttribute('disabled', 'disabled');
        let newPassword = this.$el.find('#settings__account-master-pass').val();
        if (!newPassword || newPassword.length <= 0) return;
        const p = kdbxweb.ProtectedValue.fromString(newPassword);
        newPassword = '';

        Alerts.warn({
            body: Locale.savedOnAllDevicesQuestion + '<br><br>' +
                Locale.unsavedChangesOnOtherDevicesMayBeLost + '<br><br>' +
                Locale.readyToChangePassword,
            buttons: [
                { result: 'cancel', title: Locale.alertCancel, error: true },
                { asyncresult: 'change', title: Locale.changePassword }
            ],
            esc: false, enter: false, click: false,
            success: async (asyncResult) => {
                let clearForm = false;
                if (asyncResult === 'change') {
                    const trueOrError = await this.appModel.updateMasterPassword(p);

                    if (trueOrError === true) {
                        Alerts.info({
                            body: Locale.passwordChanged
                        });
                        clearForm = true;
                    } else {
                        this.$el.find('#settings__account-master-pass-result')[0].innerText = Locale.appSaveError;
                        logger.error('Error changing account password', trueOrError);
                    }
                }
                if (clearForm) {
                    this.$el.find('#settings__account-master-pass').val('');
                    this.$el.find('#settings__account-master-pass-confirm').val('');
                    PasswordStrength.renderPasswordStrength(0, this.$el);
                } else {
                    changeButton.removeAttribute('disabled');
                }
                changeButton.classList.remove('active');
            }
        });
    },

    inputKeydown: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            const enabled = !this.$el.find('#changeAccountPasswordButton').attr('disabled');
            if (enabled) this.changePassword();
        } else if (code === Keys.DOM_VK_CAPS_LOCK) {
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

    login: function(e) {
        if (!this.appModel.files.hasDemoFile()) {
            this.appModel.closeAllFiles();
            Backbone.trigger('show-account');
        } else {
            Alerts.info({
                header: Locale.registerNow,
                body: Locale.willCloseDemo,
                buttons: [
                    { result: 'cancel', title: Locale.alertCancel, error: true },
                    { result: 'register', title: Locale.registerNow }
                ],
                success: (result) => {
                    if (result === 'register') {
                        this.appModel.closeAllFiles();
                        Backbone.trigger('show-registration');
                    }
                }
            });
        }
    },

    logout: function(e) {
        this.appModel.logout();
        AppSettingsModel.instance.set('rememberedAccountEmail', '');
        AppSettingsModel.instance.set('directAccountEmail', '');
        this.appModel.closeAllFiles();
        Backbone.trigger('show-account');
    },

    manageAccount: async function(e) {
        const manageButton = this.$el.find('#manageAccountButton')[0];
        manageButton.classList.add('active');
        manageButton.setAttribute('disabled', 'disabled');
        const otherWindow = window.open();
        otherWindow.opener = null;
        const token = await this.appModel.account.getNewAuthToken();
        if (token) {
            otherWindow.location = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=manageAccount,id=' + token;
            manageButton.classList.remove('active');
            manageButton.removeAttribute('disabled');
        } else {
            otherWindow.close();
            this.logout();
        }
    },

    loadSupportAccountData: async function() {
        if (this.appModel.account.latestTokens().length > 0) {
            try {
                const data = await MessagesService.list();
                this.showComms(data);
            } catch (e) {
                logger.error('Failed to load support account data: ' + e);
                this.$el.find('#settings__messages-comms-placeholder')[0].innerHtml =
                    'Sorry! An error occurred. Please try again later or use the <a href="https://forum.kee.pm" rel="noopener" target="_blank">public support forum</a>';
            }
        }
    },

    showComms: function(data) {
        if (this.views.commsView) {
            this.views.commsView.remove();
        }
        const placeholder = this.$el.find('#settings__messages-comms-placeholder');
        placeholder[0].innerText = '';
        this.views.commsView = new SettingsCommsView({ el: placeholder, model: data }).render();
    },

    showSupportInfo: function(data) {
        this.$el.find('.settings__account-show-support-info, .settings__account-support-info').toggleClass('hide');
    }
});

module.exports = SettingsAccountView;
