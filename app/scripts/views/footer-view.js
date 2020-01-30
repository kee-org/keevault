const Backbone = require('backbone');
const Keys = require('../const/keys');
const KeyHandler = require('../comp/key-handler');
const GeneratorView = require('./generator-view');
const UpdateModel = require('../models/update-model');
const Alerts = require('../comp/alerts');
const Locale = require('../util/locale');
const InputFx = require('../util/input-fx');
const AppSettingsModel = require('../models/app-settings-model');

const FooterView = Backbone.View.extend({
    template: require('templates/footer.hbs'),
    templateFiles: require('templates/footer-files.hbs'),

    events: {
        'click .footer__db-item': 'showFile',
        'click .footer__btn-help': 'toggleHelp',
        'click .footer__btn-settings': 'toggleSettings',
        'click .footer__btn-account': 'toggleAccountSettings',
        'click .footer__btn-generate': 'genPass',
        'click .footer__btn-lock': 'lockWorkspace',
        'click .footer__btn-menu': 'toggleMenu',
        'click #footerSaveButton': 'saveAll'
    },

    initialize: function () {
        this.views = {};

        KeyHandler.onKey(Keys.DOM_VK_L, this.lockWorkspace, this, KeyHandler.SHORTCUT_ACTION, false, true);
        KeyHandler.onKey(Keys.DOM_VK_G, this.genPass, this, KeyHandler.SHORTCUT_ACTION);
        KeyHandler.onKey(Keys.DOM_VK_S, this.saveAll, this, KeyHandler.SHORTCUT_ACTION);
        KeyHandler.onKey(Keys.DOM_VK_COMMA, this.toggleSettings, this, KeyHandler.SHORTCUT_ACTION);

        this.listenTo(this, 'hide', this.viewHidden);
        this.listenTo(this.model.files, 'update reset change', this.render);
        this.listenTo(Backbone, 'set-locale', this.render);
        this.listenTo(UpdateModel.instance, 'change:updateStatus', this.render);
    },

    render: function () {
        if (this.$el[0].childElementCount === 0) {
            this.renderTemplate({}, { plain: true });
        }

        const syncing = this.model.files.hasSyncingFiles();
        const errors = this.model.files.hasErrorFiles();
        const modified = !syncing && !errors && this.model.files.hasUnsavedFiles();

        this.$el.find('.footer__db-item').remove();
        const filesNodes = this.templateFiles({
            syncWarning: errors && !this.model.files.hasDirtyFiles(),
            files: this.model.files
        }, { plain: true });
        this.$el.find('.footer').prepend(filesNodes);

        const fsb = $('#footerSaveButton');
        if (syncing) {
            setImmediate(() => {
                fsb[0].setAttribute('disabled', 'disabled');
                fsb[0].classList.remove('minified');
                fsb[0].classList.add('active');
            });
        } else if (errors) {
            setImmediate(() => {
                fsb[0].removeAttribute('disabled');
                fsb[0].classList.remove('active');
                InputFx.shake(fsb);
            });
        } else if (modified) {
            if (this.model.get('readOnly')) {
                setImmediate(() => {
                    fsb[0].setAttribute('disabled', 'disabled');
                    fsb[0].classList.remove('minified');
                    fsb[0].classList.remove('active');
                });
            } else {
                setImmediate(() => {
                    fsb[0].removeAttribute('disabled');
                    fsb[0].classList.remove('minified');
                    fsb[0].classList.remove('active');
                });
            }
        } else {
            setImmediate(() => {
                fsb[0].removeAttribute('disabled');
                fsb[0].classList.add('minified');
            });
        }
        return this;
    },

    viewHidden: function() {
        if (this.views.gen) {
            this.views.gen.remove();
            delete this.views.gen;
        }
    },

    lockWorkspace: function(e) {
        if (this.model.files.hasOpenFiles()) {
            e.preventDefault();
            if (!this.model.files.hasDemoFile()) {
                Backbone.trigger('lock-workspace');
            } else {
                Alerts.info({
                    header: Locale.registerNow,
                    body: Locale.willCloseDemo,
                    buttons: [
                        { result: 'cancel', title: Locale.alertCancel, error: true },
                        { result: 'register', title: Locale.registerNow }
                    ],
                    success: (result) => {
                        if (result === 'register') {
                            Backbone.trigger('show-registration');
                        }
                    }
                });
            }
        }
    },

    genPass: function(e) {
        if (e) e.stopPropagation();
        if (this.views.gen) {
            this.views.gen.remove();
            return;
        }
        const el1 = this.$el.find('.footer > .footer__btn-generate');
        const rect1 = el1[0].getBoundingClientRect();
        const el2 = this.$el.find('.footer > .footer__btn-menu');
        const rect2 = el2[0].getBoundingClientRect();
        const rect = rect1.width > 0 ? rect1 : rect2;
        const bodyRect = document.body.getBoundingClientRect();
        const right = bodyRect.right - rect.right;
        const bottom = bodyRect.bottom - rect.top;
        const generator = new GeneratorView({ model: { copy: true, pos: { right: right, bottom: bottom } } }).render();
        generator.once('remove', () => { delete this.views.gen; });
        this.views.gen = generator;
    },

    showFile: function(e) {
        const cid = $(e.target).closest('.footer__db-item').data('file-id');
        if (cid) {
            Backbone.trigger('show-file-settings', { cid: cid });
        }
    },

    openFile: function() {
        Backbone.trigger('open-file');
    },

    saveAll: function() {
        if (!AppSettingsModel.instance.get('saveAdviceAlertDismissed')) {
            Alerts.info({
                header: Locale.saveExplainerAlertTitle,
                icon: 'save',
                esc: false,
                enter: false,
                click: false,
                body: `${Locale.saveExplainerAlert1}<br/><br/>
                ${Locale.saveExplainerAlert2}<br/><br/>
                ${Locale.saveExplainerAlert3}<br/><br/>
                ${Locale.saveExplainerAlert4}`,
                checkbox: Locale.dontShowAgainOnDevice,
                success: (result, checked) => {
                    if (checked) {
                        AppSettingsModel.instance.set('saveAdviceAlertDismissed', true);
                    }
                }
            });
        }
        Backbone.trigger('save-all');
    },

    toggleHelp: function() {
        Backbone.trigger('toggle-settings', 'help');
    },

    toggleSettings: function() {
        Backbone.trigger('toggle-settings', 'general');
    },

    toggleAccountSettings: function() {
        Backbone.trigger('toggle-settings', 'account');
    },

    toggleMenu: function() {
        document.getElementById('narrowMenuPopup').classList.toggle('minified');
    }
});

module.exports = FooterView;
