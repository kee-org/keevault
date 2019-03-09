const ModalView = require('../views/modal-view');
const Locale = require('../util/locale');
const KeeError = require('./kee-error');

const Alerts = {
    alertDisplayed: false,

    buttons: {
        ok: {result: 'yes', get title() { return Locale.alertOk; }},
        yes: {result: 'yes', get title() { return Locale.alertYes; }},
        no: {result: '', get title() { return Locale.alertNo; }},
        cancel: {result: '', get title() { return Locale.alertCancel; }}
    },

    alert: function(config) {
        if (config.skipIfAlertDisplayed && Alerts.alertDisplayed) {
            return null;
        }
        Alerts.alertDisplayed = true;
        const view = new ModalView({ model: config });
        view.render();
        view.on('result', (res, check) => {
            Alerts.alertDisplayed = false;
            if (res && config.success) {
                config.success(res, check);
            }
            if (!res && config.cancel) {
                config.cancel();
            }
            if (config.complete) {
                config.complete(res, check);
            }
        });
        view.on('asyncResult', async (res, check, callback) => {
            Alerts.alertDisplayed = false;
            if (res && config.success) {
                await config.success(res, check);
            }
            if (!res && config.cancel) {
                await config.cancel();
            }
            if (config.complete) {
                await config.complete(res, check);
            }
            if (callback) callback();
        });
        return view;
    },

    warn: function(config) {
        this.alert(_.extend({
            header: '',
            body: '',
            icon: 'exclamation-triangle',
            buttons: [this.buttons.ok],
            esc: '',
            click: '',
            enter: ''
        }, config));
    },

    notImplemented: function() {
        this.warn({
            header: Locale.notImplemented
        });
    },

    info: function(config) {
        this.alert(_.extend({
            header: '',
            body: '',
            icon: 'info',
            buttons: [this.buttons.ok],
            esc: '',
            click: '',
            enter: ''
        }, config));
    },

    error: function(config) {
        this.alert(_.extend({
            header: '',
            body: '',
            icon: 'exclamation-circle',
            buttons: [this.buttons.ok],
            esc: '',
            click: '',
            enter: ''
        }, config));
    },

    yesno: function(config) {
        this.alert(_.extend({
            header: '',
            body: '',
            icon: 'question',
            buttons: [this.buttons.yes, this.buttons.no],
            esc: '',
            click: '',
            enter: 'yes'
        }, config));
    },

    keeError: function(error) {
        const header = 'Kee Vault Error';
        let body = '';
        switch (error) {
            case KeeError.ServerFail: body = Locale.serverFailure; break;
            case KeeError.ServerTimeout: body = Locale.serverTimeout; break;
            case KeeError.ServerUnreachable: body = Locale.serverUnreachable; break;
            case KeeError.AlreadyRegistered: body = Locale.alreadyRegistered; break;

            // TODO: Remove this hack after removing registration code limit
            case KeeError.ExceededQuota: body = Locale.wrongCode; break;
            default: body = 'Error: ' + error; break;
        }

        this.alert({
            header,
            body,
            icon: 'exclamation-circle',
            buttons: [this.buttons.ok],
            esc: '',
            click: '',
            enter: ''
        });
    }
};

module.exports = Alerts;
