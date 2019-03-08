const Backbone = require('backbone');
const InputFx = require('../util/input-fx');
const EmailUtils = require('../util/email');
const Alerts = require('../comp/alerts');
const Account = require('../comp/account');
const Locale = require('../util/locale');

const AccountResetView = Backbone.View.extend({
    template: require('templates/account-reset.hbs'),

    events: {
        'click #resetButton': 'reset'
    },

    render: function () {
        this.renderTemplate();
        return this;
    },

    errorOnField: function (field, noFocus) {
        if (!noFocus) field[0].focus();
        field.toggleClass('input--error', true);
        field[0].scrollIntoView();
        InputFx.shake(field);
        return null;
    },

    reset: async function() {
        $('#accountEmail').toggleClass('input--error', false);
        $('#resetAgree').toggleClass('input--error', false);
        const emailField = $('#accountEmail');
        const email = EmailUtils.canonicalise(emailField[0].value);
        if (!email) return this.errorOnField(emailField);
        if (!EmailUtils.validate(email)) return this.errorOnField(emailField);

        const agreed = $('#resetAgree')[0].checked;
        if (!agreed) return this.errorOnField($('label[for=resetAgree]'), true);

        const resetButton = $('#resetButton')[0];
        resetButton.classList.add('active');
        resetButton.setAttribute('disabled', 'disabled');
        const success = await Account.resetStart(email);
        resetButton.classList.remove('active');
        resetButton.removeAttribute('disabled');

        if (success) {
            Alerts.info({
                header: Locale.accResetStarted,
                body: Locale.accResetCheckEmails,
                buttons: [],
                esc: false, enter: false, click: false
            });
        } else {
            Alerts.error({
                header: Locale.unexpectedError,
                body: Locale.commsErrorBody
            });
        }
    }
});

module.exports = AccountResetView;
