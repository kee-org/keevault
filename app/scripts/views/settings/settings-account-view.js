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
        this.renderTemplate({
            accountEmail: this.appModel.account.get('email'),
            possiblyLoggedIn,
            emailVerified,
            appInfo: _.escape(appInfo),
            uniqueUserId: user ? user.emailHashed : 'not signed in'
        });
        this.renderPasswordStrength(0);
        if (possiblyLoggedIn && emailVerified) this.loadSupportAccountData();
        return this;
    },

    renderPasswordStrength: function(strength) {
        const div = this.$el.find('#settings__account-master-pass-strength')[0];
        if (!div) return;

        div.title = Locale.strength + ': ' + (strength || '-');
        while (div.firstChild) div.removeChild(div.firstChild);

        for (let i = strength; i >= 1; i--) {
            const star = document.createElement('i');
            star.className = 'fa fa-star';
            div.appendChild(star);
        }
        for (let i = 5 - strength; i >= 1; i--) {
            const star = document.createElement('i');
            star.className = 'far fa-star';
            div.appendChild(star);
        }
    },

    passwordTyped: function(e) {
        const newValue = this.$el.find('#settings__account-master-pass').val();
        if (newValue) {
            const strength = PasswordStrength.exactStrength(newValue);
            this.renderPasswordStrength(strength);
            const confirmValue = this.$el.find('#settings__account-master-pass-confirm').val();
            if (confirmValue === newValue) {
                this.$el.find('#changeAccountPasswordButton').removeAttr('disabled');
                this.$el.find('#settings__account-master-pass-confirm').removeClass('input--error');
            } else {
                this.$el.find('#changeAccountPasswordButton').attr('disabled', 'disabled');
                this.$el.find('#settings__account-master-pass-confirm').addClass('input--error');
            }
            return;
        } else {
            this.renderPasswordStrength(0);
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
        const p = kdbxweb.ProtectedValue.fromString(this.$el.find('#settings__account-master-pass').val());
        const trueOrError = await this.appModel.updateMasterPassword(p);

        if (trueOrError === true) {
            this.$el.find('#settings__account-master-pass').val('');
            this.$el.find('#settings__account-master-pass-confirm').val('');
            this.renderPasswordStrength(0);
            this.$el.find('#settings__account-master-pass-result')[0].innerText = Locale.detHistorySaved;
            changeButton.classList.remove('active');
        } else {
            this.$el.find('#settings__account-master-pass-result')[0].innerText = Locale.appSaveError;
            logger.error('Error changing account password', trueOrError);
            changeButton.classList.remove('active');
            changeButton.removeAttribute('disabled');
        }
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
        this.appModel.account.logout();
        this.appModel.account = AccountModel.instance;
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
