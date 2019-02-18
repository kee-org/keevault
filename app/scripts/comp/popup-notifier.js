const Backbone = require('backbone');
const Alerts = require('./alerts');
const AuthReceiver = require('./auth-receiver');
const Links = require('../const/links');
const Timeouts = require('../const/timeouts');
const Locale = require('../util/locale');
const Logger = require('../util/logger');

const PopupNotifier = {
    logger: null,

    init: function() {
        this.logger = new Logger('popup-notifier');

        const windowOpen = window.open;
        window.open = function() {
            const win = windowOpen.apply(window, arguments);
            if (win) {
                PopupNotifier.deferCheckClosed(win);
                Backbone.trigger('popup-opened', win);
            } else {
                if (!Alerts.alertDisplayed) {
                    Alerts.error({
                        header: Locale.authPopupRequired,
                        body: Locale.authPopupRequiredBody
                    });
                }
            }
            return win;
        };
    },

    isOwnUrl(url) {
        return url.lastIndexOf(Links.WebApp, 0) === 0 ||
            url.lastIndexOf(location.origin + location.pathname, 0) === 0;
    },

    processReturnToApp: function(url) {
        const returnMessage = AuthReceiver.urlArgsToMessage(url);
        if (Object.keys(returnMessage).length > 0) {
            const evt = new Event('message');
            evt.data = returnMessage;
            window.dispatchEvent(evt);
        }
    },

    deferCheckClosed: function(win) {
        setTimeout(PopupNotifier.checkClosed.bind(PopupNotifier, win), Timeouts.CheckWindowClosed);
    },

    checkClosed: function(win) {
        if (win.closed) {
            setTimeout(PopupNotifier.triggerClosed.bind(PopupNotifier, win), Timeouts.CheckWindowClosed);
        } else {
            PopupNotifier.deferCheckClosed(win);
        }
    },

    triggerClosed: function(win) {
        Backbone.trigger('popup-closed', win);
    }
};

module.exports = PopupNotifier;
