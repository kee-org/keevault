const Backbone = require('backbone');
const KeeService = require('kee-frontend');
const KeeError = require('./kee-error');
const kdbxweb = require('kdbxweb');

const Account = {
    loginStart: async function (email) {
        const user = await KeeService.User.User.fromEmail(email);
        const loginResult = await user.loginStart();
        if (!loginResult.kms) {
            return loginResult;
        }
        // Could add different kms support here one day
        return user;
    },
    loginFinish: async function (user, hashedMasterKey) {
        const trueOrError = await user.loginFinish(hashedMasterKey);
        if (trueOrError === KeeError.LoginFailedMITM) {
            Backbone.trigger('show-server-mitm-warning');
            return trueOrError;
        }
        if (trueOrError === KeeError.LoginFailed) {
            return trueOrError;
        }
        return trueOrError;
    },
    register: async function (email, hashedMasterKey, introEmailStatus, marketingEmailStatus, emptyVault, code) {
        const user = await KeeService.User.User.fromEmailAndKey(email, hashedMasterKey);
        const trueOrError = await user.register(introEmailStatus, marketingEmailStatus, code);
        if (trueOrError !== true) {
            return trueOrError;
        }

        const siOrError = await this.createInitialVault(user, emptyVault);
        if (!siOrError.emailHashed) {
            return siOrError;
        }

        return { user, siOrError };
    },

    createInitialVault: async function (user, emptyVault) {
        const emptyVaultArray = await emptyVault.save();
        const emptyVaultB64 = kdbxweb.ByteUtils.bytesToBase64(emptyVaultArray);
        const siOrError = await KeeService.Storage.StorageManager.create(user, 'My Kee Vault', emptyVaultB64);

        if (siOrError === KeeError.LoginRequired) {
            Backbone.trigger('show-account');
            throw new Error('Initial storage creation was rejected with request for login.');
        }
        return siOrError;
    },

    changePassword: async function (user, hashedMasterKey, onChangeStarted) {
        return user.changePassword(hashedMasterKey, onChangeStarted);
    },

    getNewAuthToken: async function (user) {
        const tokensOrError = await user.refresh();
        return tokensOrError.identity;
    }
};

module.exports = Account;
