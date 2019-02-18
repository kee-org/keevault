const Logger = require('../util/logger');
const KeeFrontend = require('kee-frontend');
const AccountModel = require('../models/account-model');

const logger = new Logger('messages');

const MessagesService = {
    create: async function (supportUser, message) {
        try {
            const trueOrError = await KeeFrontend.Messages.MessagesManager.create(AccountModel.instance.get('user'), supportUser, message);
            if (trueOrError !== true) {
                logger.error('Failed to create: ' + JSON.stringify(trueOrError));
            } else {
                return true;
            }
        } catch (e) {
            logger.error('Failed to create: ' + e);
        }
    },

    add: async function (supportUser, message) {
        try {
            const trueOrError = await KeeFrontend.Messages.MessagesManager.add(AccountModel.instance.get('user'), supportUser, message);
            if (trueOrError !== true) {
                logger.error('Failed to add: ' + JSON.stringify(trueOrError));
            } else {
                return true;
            }
        } catch (e) {
            logger.error('Failed to add: ' + e);
        }
    },

    list: async function () {
        try {
            const responseOrError = await KeeFrontend.Messages.MessagesManager.list(AccountModel.instance.get('user'));
            if (!responseOrError || !responseOrError.user) {
                logger.error('Failed to list: ' + JSON.stringify(responseOrError));
            }
            return responseOrError;
        } catch (e) {
            logger.error('Failed to list: ' + e);
        }
    }
};

module.exports = MessagesService;
