const Backbone = require('backbone');
const InputFx = require('../util/input-fx');
const PasswordStrength = require('../util/password-strength');
const Locale = require('../util/locale');
const Alerts = require('../comp/alerts');
const FeatureDetector = require('../util/feature-detector');
const EmailUtils = require('../util/email');
const SecureInput = require('../comp/secure-input');
const KeyHandler = require('../comp/key-handler');
const Keys = require('../const/keys');

const AccountResetConfirmView = Backbone.View.extend({
    template: require('templates/account-reset-confirm.hbs'),

    passwordInput1: null,
    passwordInput2: null,
    emailAddrParts: [],

    events: {
        'click #resetButton': 'reset',
        'keydown #newPassword1,#newPassword2': 'inputKeydown',
        'keyup #newPassword1,#newPassword2': 'inputKeyup',
        'keypress #newPassword1,#newPassword2': 'inputKeypress',
        'input #newPassword1,#newPassword2': 'passwordTyped',
        'paste #newPassword1,#newPassword2': 'passwordPasted'
    },

    initialize: async function () {
        this.passwordInput1 = new SecureInput();
        this.passwordInput2 = new SecureInput();

        this.emailAddrParts = EmailUtils.split(this.model.resetEmail);

        KeyHandler.onKey(Keys.DOM_VK_Z, this.undoKeyPress, this, KeyHandler.SHORTCUT_ACTION);
        KeyHandler.onKey(Keys.DOM_VK_TAB, this.tabKeyPress, this);
        KeyHandler.onKey(Keys.DOM_VK_ENTER, this.enterKeyPress, this);
        KeyHandler.onKey(Keys.DOM_VK_RETURN, this.enterKeyPress, this);
    },

    render: function () {
        const realMinutesRemaining = this.model.account.allegedRemainingMinutes(this.model.resetAuthToken);
        if (realMinutesRemaining <= 4) {
            this.template = require('templates/account-reset-expired.hbs');
            this.renderTemplate();
        } else {
            this.renderTemplate({
                minutesRemaining: realMinutesRemaining - 2
            });
            this.inputElPassword1 = this.$el.find('#newPassword1');
            this.passwordInput1.setElement(this.inputElPassword1);
            this.inputElPassword2 = this.$el.find('#newPassword2');
            this.passwordInput2.setElement(this.inputElPassword2);
            PasswordStrength.renderPasswordStrength(0, this.$el);
            $('#newPassword1')[0].focus();
        }
        return this;
    },

    passwordTyped: function(e) {
        $('#newPassword1').toggleClass('input--error', false);
        if (this.passwordInput1.value && this.passwordInput1.value.byteLength > 0) {
            if (this.passwordInput1.value.equals(this.passwordInput2.value)) {
                this.$el.find('#newPassword2').removeClass('input--error');
            } else {
                this.$el.find('#newPassword2').addClass('input--error');
            }
            PasswordStrength.updateAndRender(this.passwordInput1.value.getText(), this.emailAddrParts, this.$el);
        } else {
            PasswordStrength.renderPasswordStrength(0, this.$el);
        }
    },

    passwordPasted: function(e) {
        Alerts.error({ header: Locale.willYouRemember, body: Locale.pasteMasterPasswordWarning });
    },

    inputKeydown: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            this.enterKeyPress();
        } else if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeyup: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeypress: function(e) {
        const charCode = e.keyCode || e.which;
        const ch = String.fromCharCode(charCode);
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        if (lower !== upper && !e.shiftKey) {
            this.toggleCapsLockWarning(ch !== lower);
        }
    },

    toggleCapsLockWarning: function(on) {
        this.$el.find('.open__pass-warning').toggleClass('invisible', !on);
    },

    undoKeyPress(e) {
        e.preventDefault();
    },

    enterKeyPress(e) {
        this.reset();
    },

    errorOnField: function (field, noFocus) {
        if (!noFocus) field[0].focus();
        field.toggleClass('input--error', true);
        field[0].scrollIntoView();
        InputFx.shake(field);
        return null;
    },

    reset: async function() {
        $('#newPassword1').toggleClass('input--error', false);
        $('#newPassword2').toggleClass('input--error', false);
        $('#registrationAgree').toggleClass('input--error', false);

        if (!this.passwordInput1 || this.passwordInput1.length <= 0) return this.errorOnField($('#newPassword1'));
        if (!this.passwordInput2 || this.passwordInput2.length <= 0) return this.errorOnField($('#newPassword2'));
        if (!this.passwordInput1.value.equals(this.passwordInput2.value)) return this.errorOnField($('#newPassword2'));

        const agreed = $('#resetAgree')[0].checked;
        if (!agreed) return this.errorOnField($('label[for=resetAgree]'), true);

        const chosenPassword = this.passwordInput1.value.clone();

        const resetButton = $('#resetButton')[0];
        resetButton.classList.add('active');
        resetButton.setAttribute('disabled', 'disabled');

        const primaryFile = await this.model.account.createNewPrimaryFile(chosenPassword, this.emailAddrParts);
        const userSIOrError = await this.model.account.resetFinish(this.model.resetEmail, this.model.resetAuthToken, chosenPassword, primaryFile.db);
        resetButton.classList.remove('active');
        resetButton.removeAttribute('disabled');

        const user = userSIOrError.user;
        const si = userSIOrError.si;

        if (!user || !si) {
            Alerts.error({
                header: Locale.unexpectedError,
                body: Locale.commsErrorBody
            });
            return null;
        }

        this.model.addFile(primaryFile);
        primaryFile.set('path', si.id);

        if (!FeatureDetector.isMobile) {
            Backbone.trigger('show-import', { firstRun: true });
        }

        primaryFile.readModel();
        this.model.syncFile(primaryFile, {startedByUser: true, opts: {primaryFileCreation: true}});
        if (FeatureDetector.isMobile) {
            Backbone.trigger('show-entries');
        }
        this.model.resetAuthToken = null;
        this.model.resetEmail = null;
    }
});

module.exports = AccountResetConfirmView;
