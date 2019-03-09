const Backbone = require('backbone');
const KeeService = require('kee-frontend');
const KeeError = require('./kee-error');
const kdbxweb = require('kdbxweb');
const FileModel = require('../models/file-model');
const IdGenerator = require('../util/id-generator');
const FeatureDetector = require('../util/feature-detector');

const Account = {
    loginStart: async function (email) {
        const user = await KeeService.User.User.fromEmail(email);
        const loginResult = await user.loginStart();
        const result = { user };
        if (!loginResult.kms) {
            result.error = loginResult;
        } else {
            result.kms = loginResult.kms;
        }
        return result;
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
        const trueOrError = await user.register(introEmailStatus, marketingEmailStatus, FeatureDetector.isMobile, code);
        if (trueOrError !== true) {
            return trueOrError;
        }

        const siOrError = await this.uploadInitialVault(user, emptyVault);
        if (!siOrError.emailHashed) {
            return siOrError;
        }

        return { user, siOrError };
    },

    allegedRemainingMinutes: function (resetAuthToken) {
        return KeeService.Reset.ResetManager.allegedRemainingMinutes(resetAuthToken);
    },

    createFileWithEmptyVault: function (password, emailAddrParts) {
        const chosenPassword = password;
        const primaryFile = new FileModel({ id: IdGenerator.uuid() });
        primaryFile.create('My Kee Vault', 'vault');
        primaryFile.db.upgrade();
        primaryFile.db.header.keyEncryptionRounds = undefined; // This should be part of kdbx upgrade really?
        primaryFile.configureArgon2ParamsAuto(chosenPassword, emailAddrParts);
        primaryFile.setPassword(chosenPassword, emailAddrParts);
        return primaryFile;
    },

    uploadInitialVault: async function (user, emptyVault) {
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
        return tokensOrError.sso;
    },

    resetStart: async function (email) {
        const user = await KeeService.User.User.fromEmail(email);
        return user.resetStart();
    },

    resetFinish: async function (email, jwt, password, emptyVault) {
        const userOrFalse = await KeeService.Reset.ResetManager.resetUser(email, jwt, await password.getHash());

        if (userOrFalse === false) {
            return false;
        }

        const siOrError = await this.uploadInitialVault(userOrFalse, emptyVault);
        if (!siOrError.emailHashed) {
            return siOrError;
        }

        return { user: userOrFalse, si: siOrError };
    }
};

module.exports = Account;
