const Backbone = require('backbone');
const Account = require('../comp/account');
const AppSettingsModel = require('./app-settings-model');
const KPRPCHandler = require('../comp/keepassrpc');

const AccountModel = Backbone.Model.extend({
    defaults: {
        email: '',
        password: 'fake password',
        errorTimeout: false,
        user: null,
        mode: 'login'
    },

    initialize: function() {
        // this.listenTo(this, 'change', this.save);
    },

    async loginStart (email) {
        this.set('user', null);
        const loginStartResult = await Account.loginStart(email);

        // Ignore all errors (maybe we'll want to record them in future though?)
        this.set('email', email);
        this.set('user', loginStartResult.user);
        Backbone.trigger('show-account-open');
    },

    async loginRestart () {
        this.set('user', null);
        const loginStartResult = await Account.loginStart(this.get('email'));
        if (loginStartResult.kms) {
            this.set('user', loginStartResult.user);
        } else {
            // Everything triggers a fresh login attempt - even invalid email addresses should not
            // hit this branch but we reset everything to protect against a misconfigured server
            AppSettingsModel.instance.set('rememberedAccountEmail', '');
            AppSettingsModel.instance.set('directAccountEmail', '');
            Backbone.trigger('show-account');
        }
    },

    async loginFinish (hashedMasterKey) {
        const user = this.get('user');
        const trueOrError = await Account.loginFinish(user, hashedMasterKey);
        return trueOrError;
    },

    createInitialVault: async function (user, emptyVault) {
        return Account.createInitialVault(user, emptyVault);
    },

    latestTokens () {
        const user = this.get('user');
        if (!user || !user.tokens) return [];
        return Object.values(user.tokens);
    },

    async register (email, hashedMasterKey, introEmailStatus, marketingEmailStatus, emptyVault, code) {
        this.set('user', null);
        const userSIOrError = await Account.register(email, hashedMasterKey, introEmailStatus, marketingEmailStatus, emptyVault, code);
        const user = userSIOrError.user;
        const si = userSIOrError.siOrError;

        if (user && si) {
            user.initialSignin = true;
            this.set('email', email);
            this.set('user', user);
            this.set('introEmailStatus', introEmailStatus);
            this.set('marketingEmailStatus', marketingEmailStatus);
            return { user, si };
        }
        return userSIOrError;
    },

    async changePassword (hashedMasterKey, onChangeStarted) {
        const user = this.get('user');
        if (!user) throw new Error('User not set - can\'t change password');
        return Account.changePassword(user, hashedMasterKey, onChangeStarted);
    },

    logout () {
        AccountModel.instance = new AccountModel();
    },

    tokensChanged (tokens) {
        // Notify any connected browser-addon that we have new account credentials
        KPRPCHandler.sendServiceAccessTokens(tokens);

        // Maybe one day we will want to do stuff within Kee Vault but for the
        // moment it's only the addon that needs to know about this
        // Backbone.trigger('user-tokens-changed');
    },

    async getNewAuthToken () {
        const user = this.get('user');
        if (!user || !user.tokens) return;
        const tokenOrUndefined = await Account.getNewAuthToken(user);
        return tokenOrUndefined;
    },

    isUserEmailVerified () {
        const user = this.get('user');
        if (!user || !user.tokens) return false;
        return user.verificationStatus === 3;
    }
});

AccountModel.instance = new AccountModel();

module.exports = AccountModel;
