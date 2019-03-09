const Backbone = require('backbone');
const SecureInput = require('../comp/secure-input');
const KeyHandler = require('../comp/key-handler');
const Keys = require('../const/keys');
const Alerts = require('../comp/alerts');
const AppSettingsModel = require('../models/app-settings-model');
const Scrollable = require('../mixins/scrollable');
const FeatureDetector = require('../util/feature-detector');
const PasswordStrength = require('../util/password-strength');
const Locale = require('../util/locale');
const InputFx = require('../util/input-fx');
const EmailUtils = require('../util/email');

const AccountView = Backbone.View.extend({
    template: require('templates/account.hbs'),

    events: {
        'click #registerNowLink': 'changeModeRegister',
        'click #loginLink': 'changeModeLogin',
        'keydown #accountEmail,#newPassword1,#newPassword2': 'inputKeydown',
        'keyup #accountEmail,#newPassword1,#newPassword2': 'inputKeyup',
        'keypress #accountEmail,#newPassword1,#newPassword2': 'inputKeypress',
        'click #signinButton': 'loginStart',
        'click #codeNextButton': 'next',
        'click #registerButton': 'register',
        'input #newPassword1,#newPassword2': 'passwordTyped',
        'paste #newPassword1,#newPassword2': 'passwordPasted'
    },

    mode: 'login',
    passwordInput1: null,
    passwordInput2: null,
    inputElPassword1: null,
    inputElPassword2: null,
    emailAddress: null,

    initialize: async function () {
        this.initScroll();
        this.passwordInput1 = new SecureInput();
        this.passwordInput2 = new SecureInput();

        const rememberedAccountEmail = AppSettingsModel.instance.get('rememberedAccountEmail');
        const directAccountEmail = AppSettingsModel.instance.get('directAccountEmail');
        if (rememberedAccountEmail || directAccountEmail) {
            this.model.account.set('mode', 'loading');
            await this.model.account.loginStart(rememberedAccountEmail || directAccountEmail);
            this.model.account.set('mode', 'login');
            Backbone.trigger('open-file');
            if (directAccountEmail) {
                AppSettingsModel.instance.set('directAccountEmail', '');
                AppSettingsModel.instance.set('idleMinutes', 15);
            }
        } else {
            KeyHandler.onKey(Keys.DOM_VK_Z, this.undoKeyPress, this, KeyHandler.SHORTCUT_ACTION);
            KeyHandler.onKey(Keys.DOM_VK_TAB, this.tabKeyPress, this);
            KeyHandler.onKey(Keys.DOM_VK_ENTER, this.enterKeyPress, this);
            KeyHandler.onKey(Keys.DOM_VK_RETURN, this.enterKeyPress, this);
        }
    },

    render: function () {
        this.renderTemplate({
            mode: this.model.account.get('mode'),
            emailAddress: this.emailAddress || this.model.prefillEmail,
            code: this.model.prefillCode || '',
            verificationSuccess: this.model.destinationFeature === 'verificationSuccess',
            verificationFailure: this.model.destinationFeature === 'verificationFailure',
            manageAccount: this.model.destinationFeature === 'manageAccount',
            managePayment: this.model.destinationFeature === 'managePayment'
        });
        this.inputElPassword1 = this.$el.find('#newPassword1');
        this.passwordInput1.setElement(this.inputElPassword1);
        this.inputElPassword2 = this.$el.find('#newPassword2');
        this.passwordInput2.setElement(this.inputElPassword2);
        PasswordStrength.renderPasswordStrength(0, this.$el);
        this.focusInput();
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
            PasswordStrength.updateAndRender(this.passwordInput1.value.getText(), $('#accountEmail')[0].value, this.$el);
        } else {
            PasswordStrength.renderPasswordStrength(0, this.$el);
        }
    },

    passwordPasted: function(e) {
        Alerts.error({ header: Locale.willYouRemember, body: Locale.pasteMasterPasswordWarning });
    },

    remove: function() {
        this.passwordInput1.reset();
        this.passwordInput2.reset();
        KeyHandler.offKey(Keys.DOM_VK_Z, this.undoKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_TAB, this.tabKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_ENTER, this.enterKeyPress, this);
        KeyHandler.offKey(Keys.DOM_VK_RETURN, this.enterKeyPress, this);
        this.viewRemoved = true;
        Backbone.View.prototype.remove.apply(this, arguments);
    },

    loginStart: async function() {
        const email = EmailUtils.canonicalise($('#accountEmail')[0].value);
        if (!email) return null;
        if (!EmailUtils.validate(email)) return null;

        const signinButton = $('#signinButton')[0];
        signinButton.classList.add('active');
        signinButton.setAttribute('disabled', 'disabled');

        this.$el.find('#accountEmail').attr('disabled', 'disabled');

        const userPromise = this.model.account.loginStart(email);
        const rememberEmail = $('#accountRememberEmail')[0].checked;
        if (rememberEmail) {
            AppSettingsModel.instance.set('rememberedAccountEmail', email);
        }
        await userPromise;
        this.$el.find('#accountEmail')[0].removeAttribute('disabled');
        signinButton.classList.remove('active');
        signinButton.removeAttribute('disabled');
    },

    next: function (field) {
        const codeField = $('#accountCode');
        codeField.toggleClass('input--error', false);
        const code = codeField[0].value;
        if (!code) return this.errorOnField(codeField);
        document.getElementById('accountStartContainer').classList.add('registrationStage1Disabled');
        document.getElementById('accountStartContainer').classList.remove('registrationStage2Disabled');
        const stage2 = document.getElementById('registrationStage2Start');
        stage2.scrollIntoView();
        $('#accountEmail')[0].focus();
    },

    errorOnField: function (field, noFocus) {
        if (!noFocus) field[0].focus();
        field.toggleClass('input--error', true);
        field[0].scrollIntoView();
        InputFx.shake(field);
        return null;
    },

    register: async function() {
        $('#accountCode').toggleClass('input--error', false);
        $('#accountEmail').toggleClass('input--error', false);
        $('#newPassword1').toggleClass('input--error', false);
        $('#newPassword2').toggleClass('input--error', false);
        $('#registrationAgree').toggleClass('input--error', false);
        const emailField = $('#accountEmail');
        const email = EmailUtils.canonicalise(emailField[0].value);
        if (!email) return this.errorOnField(emailField);
        if (!EmailUtils.validate(email)) return this.errorOnField(emailField);
        const code = $('#accountCode')[0].value;
        if (!code) return this.errorOnField($('#accountCode'));
        if (!this.passwordInput1 || this.passwordInput1.length <= 0) return this.errorOnField($('#newPassword1'));
        if (!this.passwordInput2 || this.passwordInput2.length <= 0) return this.errorOnField($('#newPassword2'));
        if (!this.passwordInput1.value.equals(this.passwordInput2.value)) return this.errorOnField($('#newPassword2'));

        const optinIntro = $('#accountEmailOptinIntro')[0].checked ? 1 : 0;
        const optinMarketing = $('#accountEmailOptinMarketing')[0].checked ? 1 : 0;
        const agreed = $('#registrationAgree')[0].checked;
        if (!agreed) return this.errorOnField($('label[for=registrationAgree]'), true);

        const emailAddrParts = EmailUtils.split(email);
        const chosenPassword = this.passwordInput1.value.clone();

        const registerButton = $('#registerButton')[0];
        registerButton.classList.add('active');
        registerButton.setAttribute('disabled', 'disabled');
        const primaryFile = await this.model.account.createNewPrimaryFile(chosenPassword, emailAddrParts);
        const userSIOrError = await this.model.account.register(email, chosenPassword, optinIntro, optinMarketing, primaryFile.db, code);
        registerButton.classList.remove('active');
        registerButton.removeAttribute('disabled');

        const user = userSIOrError.user;
        const si = userSIOrError.si;

        if (!user || !si) {
            Alerts.keeError(userSIOrError);
            return null;
        }

        // Make sure any demo is closed now
        // This also has a side-effect of switching the view back to the default open DB view which is less than ideal
        this.model.closeAllFiles();

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
        this.model.prefillEmail = null;
        this.model.prefillCode = null;
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

    tabKeyPress() {
        this.$el.addClass('open--show-focus');
    },

    enterKeyPress(e) {
        // const el = this.$el.find('[tabindex]:focus');
        // if (el.length) {
        //     el.trigger('click', e);
        // }
        if (this.model.account.get('mode') === 'register') {
            if (document.getElementById('accountStartContainer').classList.contains('registrationStage2Disabled')) {
                this.next();
            } else {
                this.register();
            }
        } else {
            this.loginStart();
        }
    },

    focusInput: function() {
        if (this.model.account.get('mode') === 'login') {
            $('#accountEmail')[0].focus();
        } else if (this.model.account.get('mode') === 'register') {
            $('#accountCode')[0].focus();
            // const emailField = $('#accountEmail')[0];
            // if (emailField.value.length > 0) {
            //     $('#newPassword1')[0].focus();
            // } else {
            //     emailField.focus();
            // }
        }
    },

    changeModeRegister: function() {
        const email = this.model.prefillEmail || $('#accountEmail')[0].value;
        const code = this.model.prefillCode;
        let link = '#dest=register';
        if (email) link += `,pfEmail=${email}`;
        if (code) link += `,pfRegCode=${code}`;
        window.location.hash = link;
        window.location.reload();
    },

    changeModeLogin: function() {
        const currentMode = this.model.account.get('mode');
        if (currentMode === 'login' || currentMode === 'register') {
            this.emailAddress = $('#accountEmail')[0].value;
        }
        this.model.account.set('mode', 'login');
        this.render();
    }
});

_.extend(AccountView.prototype, Scrollable);

module.exports = AccountView;
