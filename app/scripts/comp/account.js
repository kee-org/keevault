const Backbone = require('backbone');
const KeeService = require('kee-frontend');
const KeeError = require('./kee-error');
const kdbxweb = require('kdbxweb');
const FileModel = require('../models/file-model');
const IdGenerator = require('../util/id-generator');
const FeatureDetector = require('../util/feature-detector');
const AppSettingsModel = require('../models/app-settings-model');

const Account = {
    loginStart: async function (email) {
        const user = await KeeService.User.User.fromEmail(email);
        const userId = AppSettingsModel.instance.get('userEmailHashedIdLookup.' + user.emailHashed);
        // If missing from local data due to a recent update, we fall back to old approach of userId == emailHashed
        user.setUserId(userId || user.emailHashed);
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
        AppSettingsModel.instance.set('userEmailHashedIdLookup.' + user.emailHashed, user.userId);
        return trueOrError;
    },
    register: async function (email, hashedMasterKey, introEmailStatus, marketingEmailStatus, emptyVault, code) {
        const user = await KeeService.User.User.fromEmailAndKey(email, hashedMasterKey);
        const trueOrError = await user.register(introEmailStatus, marketingEmailStatus, FeatureDetector.isMobile, code);
        if (trueOrError !== true) {
            return trueOrError;
        }
        AppSettingsModel.instance.set('userEmailHashedIdLookup.' + user.emailHashed, user.userId);

        const siOrError = await this.uploadInitialVault(user, emptyVault);
        if (!siOrError.emailHashed) {
            return siOrError;
        }

        return { user, siOrError };
    },
    applyCouponToSubscription: async function (user, code) {
        const trueOrError = await user.applyCouponToSubscription(code);
        return trueOrError;
    },

    allegedRemainingMinutes: function (resetAuthToken) {
        return KeeService.Reset.ResetManager.allegedRemainingMinutes(resetAuthToken);
    },

    createFileWithEmptyVault: function (password, emailAddrParts) {
        const chosenPassword = password;
        const primaryFile = new FileModel({ id: IdGenerator.uuid() });
        primaryFile.create('My Kee Vault', 'vault');
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

        if (!userOrFalse.tokens || !userOrFalse.tokens.storage) {
            return KeeError.MissingPrimaryDB;
        }

        const siOrError = await this.uploadInitialVault(userOrFalse, emptyVault);
        if (!siOrError.emailHashed) {
            return siOrError;
        }

        return { user: userOrFalse, si: siOrError };
    },

    restartTrial: async function (user) {
        return user.restartTrial();
    }
};

module.exports = Account;
