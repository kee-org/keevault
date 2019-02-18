const Backbone = require('backbone');
const Locale = require('../../util/locale');
const Logger = require('../../util/logger');
const Alerts = require('../../comp/alerts');
const MessagesService = require('../../comp/messages-service');

const logger = new Logger('settings-comms-view');

const SettingsCommsView = Backbone.View.extend({
    template: require('templates/settings/settings-comms.hbs'),

    events: {
        'click #changeAccountPasswordButton': 'changePassword',
        'click #settings__messages-privacyAlert': 'privacyAlert',
        'click #settings__messages-sendMessage': 'sendMessage',
        'click #settings__messages-updateAccount': 'updateAccount'
    },

    render: function() {
        this.originalUser = !!this.model.user && Object.keys(this.model.user).length > 0 ? this.model.user : undefined;
        this.renderTemplate({
            messages: this.model.messages.map((msg) => {
                let v = msg.body.replace(/(<div>)|(<\/div>)/g, '');
                v = v.replace(/(<br>)|(<br\/>)/g, '\n');
                // We expect only br and div tags from our support platform and
                // don't allow anything that might be a tag now or coerced to become one
                msg.body = (v.indexOf('<') >= 0 || v.indexOf('>') >= 0)
                    ? "There's a message here but we can't display it right now. Please use the support forum for assistance."
                    : v.replace(/\n/g, '<br>');
                if (msg.from !== 'me') {
                    const space = msg.from.indexOf(' ');
                    msg.from = (space > 0 ? msg.from.substring(0, space) : msg.from) + ' (Kee Vault)';
                } else {
                    msg.from = Locale.me;
                }
                return msg;
            }),
            hasSupportAccount: !!this.model.user && Object.keys(this.model.user).length > 0,
            firstname: this.model.user ? this.model.user.firstname : '',
            lastname: this.model.user ? this.model.user.lastname : '',
            useEmail: this.model.user ? this.model.user.useEmail : false
        });
        return this;
    },

    privacyAlert: function(e) {
        Alerts.info({
            header: Locale.privacy,
            body: Locale.supportPrivacy1 + '<br/><br/>' + Locale.supportPrivacy2
        });
    },

    updateAccount: async function(e) {
        const but = this.$el.find('#settings__messages-updateAccount')[0];
        but.classList.add('active');
        but.setAttribute('disabled', 'disabled');

        const changedUser = this.getUserDiff();
        try {
            let success = false;
            if (changedUser) {
                success = await MessagesService.add(changedUser, null);
            }
            if (success) {
                // Seems there may be some async update in Zammad?
                // Elasticsearch indexing? This hacks around it... ish.
                setTimeout(() => Backbone.trigger('reloadCustomerSupportView'), 250);
                return;
            } else {
                Alerts.error({
                    header: Locale.openError,
                    body: Locale.commsErrorBody
                });
            }
        } catch (e) {
            logger.error('Failed to update account: ' + e);
            Alerts.error({
                header: Locale.openError,
                body: Locale.commsErrorBody
            });
        }

        but.classList.remove('active');
        but.removeAttribute('disabled');
    },

    sendMessage: async function(e) {
        const messageBody = this.$el.find('#settings__messages-newmessage').val();
        if (!messageBody || messageBody.length <= 0) return;

        const but = this.$el.find('#settings__messages-sendMessage')[0];
        but.classList.add('active');
        but.setAttribute('disabled', 'disabled');

        try {
            let success = false;
            if (!this.originalUser) {
                const changedUser = this.getUserDiff();
                success = await MessagesService.create(changedUser, { body: messageBody.substring(0, 102400) });
                // Seems there may be some async update in Zammad?
                // Elasticsearch indexing? This hacks around it... ish.
                // Seems much worse (only?) on initial ticket creation so we send the user away for a bit
                if (success) {
                    setTimeout(() => Alerts.info({
                        header: Locale.customerSupportAccount, icon: 'check-circle', esc: false, enter: false, click: false,
                        body: Locale.customerSupportAccountCreated,
                        buttons: [
                            {result: '', title: Locale.retToApp, error: false}
                        ],
                        complete: () => {
                            Backbone.trigger('show-entries');
                        }
                    }), 1000);
                }
            } else {
                success = await MessagesService.add(null, { body: messageBody.substring(0, 102400) });
                // Seems there may be some async update in Zammad?
                // Elasticsearch indexing? This hacks around it... ish.
                if (success) {
                    setTimeout(() => Backbone.trigger('reloadCustomerSupportView'), 250);
                }
            }
            if (!success) {
                Alerts.error({
                    header: Locale.openError,
                    body: Locale.commsErrorBody
                });
            }
        } catch (e) {
            logger.error('Failed to send message: ' + e);
            Alerts.error({
                header: Locale.openError,
                body: Locale.commsErrorBody
            });
        }

        but.classList.remove('active');
        but.removeAttribute('disabled');
    },

    getUserDiff: function() {
        let user;
        const firstname = this.$el.find('#settings__messages-firstname').val() || 'Anonymous';
        const lastname = this.$el.find('#settings__messages-lastname').val() || 'Anonymous';
        const useEmail = this.$el.find('#settings__messages-useEmail')[0].checked;

        if (!this.originalUser) {
            return {
                firstname,
                lastname,
                useEmail
            };
        } else {
            if (this.originalUser.firstname !== firstname) {
                user = user || {};
                user.firstname = firstname;
            }
            if (this.originalUser.lastname !== lastname) {
                user = user || {};
                user.lastname = lastname;
            }
            if (this.originalUser.useEmail !== useEmail) {
                user = user || {};
                user.useEmail = useEmail;
            }
            return user;
        }
    }
});

module.exports = SettingsCommsView;
