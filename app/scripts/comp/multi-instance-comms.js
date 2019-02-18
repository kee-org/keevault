const BroadcastChannel = require('broadcast-channel').default;
const LeaderElection = require('broadcast-channel/leader-election');
const Locale = require('../util/locale');
const Alerts = require('./alerts');
const RuntimeInfo = require('../comp/runtime-info');

const channel = new BroadcastChannel('keevaultinstances', {webWorkerSupport: false});
let elector;
let leadershipTimeout;

const MultiInstanceComms = {
    init: async function(dest, cedePolitely, cedeForcefully, getRecentAuthToken) {
        MultiInstanceComms.dest = dest;
        MultiInstanceComms.cedePolitely = cedePolitely;
        MultiInstanceComms.cedeForcefully = cedeForcefully;
        MultiInstanceComms.getRecentAuthToken = getRecentAuthToken;

        channel.onmessage = msg => MultiInstanceComms.handleMessage(msg);
        leadershipTimeout = setTimeout(MultiInstanceComms.otherLeaderExists, 1000);
        elector = LeaderElection.create(channel);
        window.addEventListener('unload', MultiInstanceComms.abdicate);
        await elector.awaitLeadership();
        clearTimeout(leadershipTimeout);
    },

    handleMessage: function(msg) {
        if (msg && msg.action && typeof msg.action === 'string') {
            switch (msg.action) {
                case 'AUTH': MultiInstanceComms.receiveAuthRequest(); break;
                case 'AUTHACK': MultiInstanceComms.receiveAuthAck(); break;
                case 'AUTHTOKEN': MultiInstanceComms.receiveAuthToken(msg.token); break;
                case 'AUTHFAIL': MultiInstanceComms.receiveAuthFail(); break;
                case 'CEDE': MultiInstanceComms.receiveCedeRequest(); break;
                case 'DEMAND': MultiInstanceComms.receiveCedeDemand(); break;
            }
        }
    },

    receiveAuthRequest: async function() {
        channel.postMessage({action: 'AUTHACK'});
        const token = await MultiInstanceComms.getRecentAuthToken();
        if (token) {
            channel.postMessage({action: 'AUTHTOKEN', token});
        }
        channel.postMessage({action: 'AUTHFAIL'});
    },

    receiveAuthAck: function() {
        clearTimeout(leadershipTimeout);
        // Other tab has promised to get us a token or tell us that it can't but it's not a cast iron guarantee
        leadershipTimeout = setTimeout(MultiInstanceComms.princeCharles, 30000);
    },

    receiveAuthToken: function(token) {
        clearTimeout(leadershipTimeout);
        if (!token) {
            MultiInstanceComms.princeCharles();
            return;
        }
        if (MultiInstanceComms.dest === 'manageAccount') {
            window.location.href = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=manageAccount,id=' + token;
        } else if (MultiInstanceComms.dest === 'managePayment') {
            window.location.href = 'https://account.kee.pm/#stage=' + RuntimeInfo.stage + ',dest=managePayment,id=' + token;
        }
    },

    receiveAuthFail: function() {
        clearTimeout(leadershipTimeout);
        MultiInstanceComms.askNicely();
    },

    receiveCedeRequest: function() {
        if (MultiInstanceComms.cedePolitely()) {
            MultiInstanceComms.abdicate();
        }
    },

    receiveCedeDemand: function() {
        if (MultiInstanceComms.cedeForcefully()) {
            MultiInstanceComms.abdicate();
        }
    },

    requestAuth: function() {
        leadershipTimeout = setTimeout(MultiInstanceComms.princeCharles, 1000);
        channel.postMessage({action: 'AUTH'});
    },

    askNicely: function() {
        leadershipTimeout = setTimeout(MultiInstanceComms.princeCharles, 1000);
        channel.postMessage({action: 'CEDE'});
    },

    demand: function() {
        channel.postMessage({action: 'DEMAND'});
    },

    otherLeaderExists: function() {
        if (MultiInstanceComms.dest === 'manageAccount' || MultiInstanceComms.dest === 'managePayment') {
            // SSO only so we don't strictly need to render the app if we
            // can get what we need from the existing instance
            MultiInstanceComms.requestAuth();
        } else {
            MultiInstanceComms.askNicely();
        }
    },

    princeCharles: function() {
        clearTimeout(leadershipTimeout);
        switch (MultiInstanceComms.dest) {
            case 'verificationSuccess': MultiInstanceComms.showAlertVerify(true); break;
            case 'verificationFailure': MultiInstanceComms.showAlertVerify(false); break;
            case 'demo': MultiInstanceComms.showAlertDemo(); break;
            case 'register': MultiInstanceComms.showAlertRegister(); break;
            case 'manageAccount': MultiInstanceComms.showAlertSSO(); break;
            case 'managePayment': MultiInstanceComms.showAlertSSO(); break;
            default: MultiInstanceComms.showAlertDefault(); break;
        }
    },

    demandIgnored: function(alertConfig) {
        clearTimeout(leadershipTimeout);
        Alerts.error(alertConfig);
    },

    showAlertVerify: function(success) {
        Alerts.error({
            header: Locale.emailVerification, icon: success ? 'check-circle' : 'exclamation-circle', esc: false, enter: false, click: false,
            body: (success ? Locale.verificationSuccess : Locale.verificationFailure) + '<br/><br/>' +
                Locale.isOpenInOtherTab + ' ' + Locale.pleaseUseOtherTab + '<br/><br/>' + Locale.disableOtherTabSecondary,
            buttons: [
                {result: '', title: Locale.disableOtherTab, error: true}
            ],
            complete: () => {
                leadershipTimeout = setTimeout(MultiInstanceComms.demandIgnored, 1000, {
                    header: Locale.appUnsavedWarn, esc: false, enter: false, click: false, buttons: [],
                    body: Locale.disableOtherTabFailure + '<br/><br/>' + Locale.pleaseUseOtherTab
                });
                MultiInstanceComms.demand();
            }
        });
    },

    showAlertDemo: function() {
        Alerts.error({
            header: Locale.appTabWarn, icon: 'clone', esc: false, enter: false, click: false,
            body: Locale.isOpenInOtherTab + ' ' + Locale.closeOtherTabDemo + '<br/><br/>' + Locale.disableOtherTabSecondary,
            buttons: [
                {result: '', title: Locale.disableOtherTab, error: true}
            ],
            complete: () => {
                leadershipTimeout = setTimeout(MultiInstanceComms.demandIgnored, 1000, {
                    header: Locale.appUnsavedWarn, esc: false, enter: false, click: false, buttons: [],
                    body: Locale.disableOtherTabFailure + '<br/><br/>' + Locale.closeOtherTabDemo
                });
                MultiInstanceComms.demand();
            }
        });
    },

    showAlertRegister: function() {
        Alerts.error({
            header: Locale.appTabWarn, icon: 'clone', esc: false, enter: false, click: false,
            body: Locale.isOpenInOtherTab + ' ' + Locale.closeOtherTabRegister + '<br/><br/>' + Locale.disableOtherTabSecondary,
            buttons: [
                {result: '', title: Locale.disableOtherTab, error: true}
            ],
            complete: () => {
                leadershipTimeout = setTimeout(MultiInstanceComms.demandIgnored, 1000, {
                    header: Locale.appUnsavedWarn, esc: false, enter: false, click: false, buttons: [],
                    body: Locale.disableOtherTabFailure + '<br/><br/>' + Locale.closeOtherTabRegister
                });
                MultiInstanceComms.demand();
            }
        });
    },

    showAlertSSO: function() {
        Alerts.error({
            header: Locale.appTabWarn, icon: 'clone', esc: false, enter: false, click: false,
            body: Locale.isOpenInOtherTab + ' ' + Locale.closeOtherTabSignIn + '<br/><br/>' + Locale.disableOtherTabPrimary,
            buttons: [
                {result: '', title: Locale.disableOtherTab, error: false}
            ],
            complete: () => {
                leadershipTimeout = setTimeout(MultiInstanceComms.demandIgnored, 1000, {
                    header: Locale.appUnsavedWarn, esc: false, enter: false, click: false, buttons: [],
                    body: Locale.disableOtherTabFailure + '<br/><br/>' + Locale.closeOtherTabSignIn
                });
                MultiInstanceComms.demand();
            }
        });
    },

    showAlertDefault: function() {
        Alerts.error({
            header: Locale.appTabWarn, icon: 'clone', esc: false, enter: false, click: false,
            body: Locale.isOpenInOtherTab + ' ' + Locale.pleaseUseOtherTab + '<br/><br/>' + Locale.disableOtherTabSecondary,
            buttons: [
                {result: '', title: Locale.disableOtherTab, error: true}
            ],
            complete: () => {
                leadershipTimeout = setTimeout(MultiInstanceComms.demandIgnored, 1000, {
                    header: Locale.appUnsavedWarn, esc: false, enter: false, click: false, buttons: [],
                    body: Locale.disableOtherTabFailure + '<br/><br/>' + Locale.pleaseUseOtherTab
                });
                MultiInstanceComms.demand();
            }
        });
    },

    abdicate: async function() {
        await elector.die();
        // eslint-disable-next-line no-console
        console.log('Kee Vault leader elector killed');
        channel.close();
    }
};

module.exports = MultiInstanceComms;
