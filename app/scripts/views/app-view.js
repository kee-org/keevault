const Backbone = require('backbone');
const DragView = require('../views/drag-view');
const MenuView = require('../views/menu/menu-view');
const FooterView = require('../views/footer-view');
const ListView = require('../views/list-view');
const ListWrapView = require('../views/list-wrap-view');
const DetailsView = require('../views/details/details-view');
const GrpView = require('../views/grp-view');
const TagView = require('../views/tag-view');
const GeneratorPresetsView = require('../views/generator-presets-view');
const SettingsView = require('../views/settings/settings-view');
const KeyChangeView = require('../views/key-change-view');
const AccountView = require('../views/account-view');
const AccountOpenView = require('../views/account-open-view');
const AccountMobileWarningView = require('../views/account-mobile-view');
const AccountResetView = require('../views/account-reset-view');
const AccountResetConfirmView = require('../views/account-reset-confirm-view');
const VaultOverlayView = require('../views/vault-overlay');
const ImportView = require('../views/import/import-view');
const DropdownView = require('../views/dropdown-view');
const Alerts = require('../comp/alerts');
const Keys = require('../const/keys');
const Timeouts = require('../const/timeouts');
const KeyHandler = require('../comp/key-handler');
const IdleTracker = require('../comp/idle-tracker');
const SettingsManager = require('../comp/settings-manager');
const Locale = require('../util/locale');
const FeatureDetector = require('../util/feature-detector');
const UpdateModel = require('../models/update-model');
const KPRPCHandler = require('../comp/keepassrpc');

const AppView = Backbone.View.extend({
    el: 'body',

    template: require('templates/app.hbs'),

    events: {
        'contextmenu': 'contextMenu',
        'drop': 'drop',
        'dragenter': 'dragover',
        'dragover': 'dragover',
        'mousedown': 'bodyClick'
    },

    views: null,

    titlebarStyle: 'default',

    initialize: function () {
        this.views = {};
        this.views.vaultOverlay = new VaultOverlayView({ model: this.model });
        this.views.menu = new MenuView({ model: this.model.menu });
        this.views.menuDrag = new DragView('x');
        this.views.footer = new FooterView({ model: this.model });
        this.views.listWrap = new ListWrapView({ model: this.model });
        this.views.list = new ListView({ model: this.model });
        this.views.listDrag = new DragView('x');
        this.views.list.dragView = this.views.listDrag;
        this.views.details = new DetailsView();
        this.views.details.appModel = this.model;

        this.views.menu.listenDrag(this.views.menuDrag);
        this.views.list.listenDrag(this.views.listDrag);

        this.titlebarStyle = this.model.settings.get('titlebarStyle');

        this.listenTo(this.model.settings, 'change:theme', this.setTheme);
        this.listenTo(this.model.settings, 'change:locale', this.setLocale);
        this.listenTo(this.model.settings, 'change:fontSize', this.setFontSize);
        this.listenTo(this.model.files, 'update reset', this.fileListUpdated);

        this.listenTo(Backbone, 'select-all', this.selectAll);
        this.listenTo(Backbone, 'menu-select', this.menuSelect);
        this.listenTo(Backbone, 'lock-workspace', this.lockWorkspace);
        this.listenTo(Backbone, 'show-file-settings', this.showFileSettings);
        this.listenTo(Backbone, 'show-file', this.showFile);
        this.listenTo(Backbone, 'show-account-settings', this.showAccountSettings);
        this.listenTo(Backbone, 'show-relevant-interface', this.showRelevantInterface);
        this.listenTo(Backbone, 'open-file', this.toggleOpenFile);
        this.listenTo(Backbone, 'save-all', this.saveAll);
        this.listenTo(Backbone, 'remote-key-changed', this.remoteKeyChanged);
        this.listenTo(Backbone, 'toggle-settings', this.toggleSettings);
        this.listenTo(Backbone, 'toggle-menu', this.toggleMenu);
        this.listenTo(Backbone, 'toggle-details', this.toggleDetails);
        this.listenTo(Backbone, 'edit-group', this.editGroup);
        this.listenTo(Backbone, 'edit-tag', this.editTag);
        this.listenTo(Backbone, 'edit-generator-presets', this.editGeneratorPresets);
        this.listenTo(Backbone, 'user-idle', this.userIdle);
        this.listenTo(Backbone, 'os-lock', this.osLocked);
        this.listenTo(Backbone, 'power-monitor-suspend', this.osLocked);
        this.listenTo(Backbone, 'app-minimized', this.appMinimized);
        this.listenTo(Backbone, 'show-context-menu', this.showContextMenu);

        this.listenTo(UpdateModel.instance, 'change:updateReady', this.updateApp);

        this.listenTo(Backbone, 'enter-full-screen', this.enterFullScreen);
        this.listenTo(Backbone, 'leave-full-screen', this.leaveFullScreen);

        this.listenTo(Backbone, 'show-account', this.showAccountStart);
        this.listenTo(Backbone, 'show-account-open', this.showAccountOpenFile);
        this.listenTo(Backbone, 'show-registration', this.showRegistration);
        this.listenTo(Backbone, 'show-import', this.showImport);
        this.listenTo(Backbone, 'show-account-mobile-warning', this.showAccountMobileWarning);
        this.listenTo(Backbone, 'show-entries', this.showEntries);
        this.listenTo(Backbone, 'show-server-mitm-warning', this.showServerMITMWarning);
        this.listenTo(Backbone, 'show-demo-blurb', this.showTopDemoBlurb);

        this.listenTo(Backbone, 'kee-addon-enabled', this.onKeeAddonEnabled);
        this.listenTo(Backbone, 'kee-addon-activated', this.onKeeAddonActivated);
        this.listenTo(Backbone, 'show-password-generator', this.showPasswordGenerator);

        window.onbeforeunload = this.beforeUnload.bind(this);
        window.onresize = this.windowResize.bind(this);
        window.onblur = this.windowBlur.bind(this);

        KeyHandler.onKey(Keys.DOM_VK_ESCAPE, this.escPressed, this);
        KeyHandler.onKey(Keys.DOM_VK_BACK_SPACE, this.backspacePressed, this);

        setInterval(this.syncAllByTimer.bind(this), Timeouts.AutoSync);

        this.setWindowClass();
        this.fixClicksInEdge();
    },

    setWindowClass: function() {
        const getBrowserCssClass = FeatureDetector.getBrowserCssClass();
        if (getBrowserCssClass) {
            this.$el.addClass(getBrowserCssClass);
        }
        if (this.titlebarStyle !== 'default') {
            this.$el.addClass('titlebar-' + this.titlebarStyle);
        }
    },

    fixClicksInEdge: function() {
        // MS Edge doesn't want to handle clicks by default
        // TODO: remove once Edge 14 share drops enough
        // https://github.com/keeweb/keeweb/issues/636#issuecomment-304225634
        // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/5782378/
        if (FeatureDetector.needFixClicks) {
            const msEdgeScrewer = $('<input/>').appendTo(this.$el).focus();
            setTimeout(() => msEdgeScrewer.remove(), 0);
        }
    },

    render: function () {
        this.$el.html(this.template({
            beta: this.model.isBeta,
            titlebarStyle: this.titlebarStyle
        }));
        this.panelEl = this.$el.find('.app__panel:first');
        this.views.listWrap.setElement(this.$el.find('.app__list-wrap')).render();
        this.views.menu.setElement(this.$el.find('.app__menu')).render();
        this.views.menuDrag.setElement(this.$el.find('.app__menu-drag')).render();
        this.views.footer.setElement(this.$el.find('.app__footer')).render();
        this.views.list.setElement(this.$el.find('.app__list')).render();
        this.views.listDrag.setElement(this.$el.find('.app__list-drag')).render();
        this.views.details.setElement(this.$el.find('.app__details')).render();

        if (this.model.destinationFeature === 'intro' ||
            (!this.model.destinationFeature && !this.model.settings.get('vaultIntroCompleted'))) {
            this.model.settings.set('rememberedAccountEmail', '');
            this.model.settings.set('directAccountEmail', '');
            this.showInitialVisitView();
        } else if (this.model.destinationFeature === 'demo') {
            this.showInitialVisitView();
            this.showDemo();
        } else if (this.model.destinationFeature === 'register') {
            this.showInitialVisitView(() => this.views.vaultOverlay.ctaClick());
        } else {
            $('#app__body_intro')[0].classList.add('hide');
            $('#app__body_main')[0].classList.remove('hide');
            if (this.model.destinationFeature === 'registerWithoutWalkthrough') {
                this.showRegistration();
            } else if (this.model.destinationFeature === 'resetPassword') {
                this.showResetPassword();
            } else if (this.model.destinationFeature === 'resetPasswordConfirm') {
                this.showResetPasswordConfirm();
            } else {
                this.showAccountStart();
            }
        }
        return this;
    },

    showInitialVisitView: function(viewReady) {
        $('.app__footer')[0].classList.add('hide');
        this.views.vaultOverlay.setElement(this.$el.find('.vault_overlay')).render();
        const mainIntroSection = this.$el.find('.vault_overlay .vault_intro_full_content_body')[0];
        const headerIntroSection = this.$el.find('.vault_overlay .vault_intro_full_content_header')[0];
        const introLoadingContainer = $('#app__body_intro .vault_intro_loading_container')[0];
        $('#app__body_main')[0].classList.add('hide');

        // We never remove this. User doesn't really need to know about new versions
        // until the next page refresh and the banner complicates a lot of layout issues.
        $('body')[0].classList.add('intro_active');

        $('#app__body_intro')[0].classList.add('intro_active');
        $('#app__body_intro .vault_intro_loading_container .account-loading')[0]
            .addEventListener('transitionend', () => {
                headerIntroSection.classList.add('invisible');
                headerIntroSection.classList.remove('hide');
                mainIntroSection.classList.add('loaded');
                $('body')[0].classList.add('enable_native_scroll');
            }, true);
        introLoadingContainer.addEventListener('transitionend', (e) => {
            if (e.originalTarget !== e.currentTarget) return;
            headerIntroSection.classList.remove('invisible');
            $('#app__body_intro')[0].classList.remove('intro_active');
            $('body')[0].classList.add('enable_native_scroll');
        }, true);
        mainIntroSection.addEventListener('transitionend', () => {
            $('.vault_intro_top')[0].classList.remove('hide');
            $('#app__body_main')[0].classList.remove('hide');
            $('.app__footer')[0].classList.remove('hide');
            $('#app__body_intro')[0].classList.add('hide');
            // Make sure we're in the correct final state even if weird transition timing occurred
            headerIntroSection.classList.remove('invisible');
            $('#app__body_intro')[0].classList.remove('intro_active');
            $('body')[0].classList.add('enable_native_scroll');
            if (viewReady) viewReady();
        }, true);

        // HACK!!!
        // For some reason, we must query the current dimensions in order for some
        // browsers (mobile only?) to actually render our earlier work to the screen.
        // Without this entirely not understood hack, the application of the loaded
        // class does not trigger the transitions we require (because the element is hidden)
        introLoadingContainer.getBoundingClientRect();
        introLoadingContainer.classList.add('loaded');
    },

    prepareForNewView: function(forceHiddenFooter) {
        this.views.vaultOverlay.hide();
        this.hideContextMenu();
        this.views.menu.hide();
        this.views.menuDrag.hide();
        this.views.listWrap.hide();
        this.views.list.hide();
        this.views.listDrag.hide();
        this.views.details.hide();
        this.views.footer.toggle(!forceHiddenFooter && this.model.files.hasOpenFiles());
        this.hidePanelView();
        this.hideSettings();
        this.hideAccountStart();
        this.hideAccountOpenFile();
        this.hideImport();
        this.hideKeyChange();
    },

    showTopDemoBlurb: function() {
        this.views.vaultOverlay.showTopDemoBlurb();
    },

    showDemo: function() {
        if (FeatureDetector.isMobile) {
            Backbone.trigger('show-account-mobile-warning');
        } else {
            this.views.vaultOverlay.model.createDemoFile();
            this.views.vaultOverlay.$el.parent().removeClass('vault_landing').addClass('vault_start');
            this.views.vaultOverlay.showTopDemoBlurb();
            this.views.vaultOverlay.$el[0].addEventListener('animationend', ev => {
                $('body')[0].classList.remove('enable_native_scroll');
            }, false);
        }
    },

    showAccountMobileWarning: function() {
        this.prepareForNewView(true);
        this.views.account = new AccountMobileWarningView();
        this.views.account.setElement(this.$el.find('#app__body_main')).render();
        this.views.account.on('close', this.showEntries, this);
    },

    showResetPassword: function() {
        this.prepareForNewView(true);
        this.views.account = new AccountResetView();
        this.views.account.setElement(this.$el.find('#app__body_main')).render();
        this.views.account.on('close', this.showEntries, this);
    },

    showResetPasswordConfirm: function() {
        this.prepareForNewView(true);
        this.views.account = new AccountResetConfirmView({ model: this.model });
        this.views.account.setElement(this.$el.find('#app__body_main')).render();
        this.views.account.on('close', this.showEntries, this);
    },

    showAccountStart: function() {
        this.prepareForNewView(true);
        this.views.account = new AccountView({ model: this.model });
        this.views.account.setElement(this.$el.find('#app__body_main')).render();
        this.views.account.on('close', this.showEntries, this);
    },

    showRegistration: function() {
        this.model.account.set('mode', 'register');
        this.model.settings.set('vaultIntroCompleted', true);
        this.showAccountStart();
    },

    showImport: function(ev) {
        this.prepareForNewView(true);
        this.views.import = new ImportView({ model: Object.assign(this.model, {firstRun: ev ? ev.firstRun : false}) });
        this.views.import.setElement(this.$el.find('#app__body_main')).render();
        this.views.import.on('close', this.showEntries, this);
    },

    showPasswordGenerator: function(ev) {
        if (this.views.footer.isVisible() && (this.views.vaultOverlay.isHidden() ||
            (this.model.files.hasDemoFile() &&
                document.querySelectorAll('div.vault_mask,div.vault_mask_transparent').length === 0))) {
            this.views.footer.genPass();
        } else {
            Alerts.info({
                icon: 'bolt',
                header: Locale.unlock,
                body: Locale.unlockToGenerate
            });
        }
    },

    showServerMITMWarning: function() {
        Alerts.error({ body: Locale.serverMITMWarning,
            esc: false, enter: false, click: false
        });
    },

    showApplicableOpenFileView: function() {
        if (this.model.account && this.model.account.has('user')) this.showAccountOpenFile();
        else this.showAccountStart();
    },

    showAccountOpenFile: function() {
        this.prepareForNewView(true);
        this.views.accountOpen = new AccountOpenView({ model: this.model });
        this.views.accountOpen.setElement(this.$el.find('#app__body_main')).render();
        this.views.accountOpen.on('close', this.showEntries, this);
    },

    updateApp: function() {
        if (UpdateModel.instance.get('updateStatus') === 'ready' && !this.model.files.hasOpenFiles()) {
            window.location.reload();
        }
    },

    showEntries: function() {
        this.views.menu.show();
        this.views.menuDrag.show();
        this.views.listWrap.show();
        this.views.list.show();
        this.views.listDrag.show();
        this.views.details.show();
        this.views.footer.show();
        this.hidePanelView();
        this.hideAccountStart();
        this.hideAccountOpenFile();
        this.hideImport();
        this.hideSettings();
        this.hideKeyChange();
    },

    hideAccountStart: function() {
        if (this.views.account) {
            this.views.account.remove();
            this.views.account = null;
        }
    },

    hideImport: function() {
        if (this.views.import) {
            this.views.import.remove();
            this.views.import = null;
        }
    },

    hideAccountOpenFile: function() {
        if (this.views.accountOpen) {
            this.views.accountOpen.remove();
            this.views.accountOpen = null;
        }
    },

    hidePanelView: function() {
        if (this.views.panel) {
            this.views.panel.remove();
            this.views.panel = null;
            this.panelEl.addClass('hide');
        }
    },

    showPanelView: function(view) {
        this.views.listWrap.hide();
        this.views.list.hide();
        this.views.listDrag.hide();
        this.views.details.hide();
        this.hidePanelView();
        this.views.panel = view.setElement(this.panelEl).render();
        this.panelEl.removeClass('hide');
    },

    hideSettings: function() {
        if (this.views.settings) {
            this.model.menu.setMenu('app');
            this.views.settings.remove();
            this.views.settings = null;
        }
    },

    hideKeyChange: function() {
        if (this.views.keyChange) {
            this.views.keyChange.hide();
            this.views.keyChange = null;
        }
    },

    showSettings: function(selectedMenuItem) {
        this.model.menu.setMenu('settings');
        this.views.menu.show();
        this.views.menuDrag.show();
        this.views.listWrap.hide();
        this.views.list.hide();
        this.views.listDrag.hide();
        this.views.details.hide();
        this.hideContextMenu();
        this.hideAccountStart();
        this.hideAccountOpenFile();
        this.hideImport();
        this.hidePanelView();
        this.hideKeyChange();
        this.views.settings = new SettingsView({ model: this.model });
        this.views.settings.setElement(this.$el.find('#app__body_main')).render();
        if (!selectedMenuItem) {
            selectedMenuItem = this.model.menu.generalSection.get('items').first();
        }
        this.model.menu.select({ item: selectedMenuItem });
        this.views.menu.switchVisibility(false);
    },

    showEditGroup: function() {
        this.showPanelView(new GrpView());
    },

    showEditTag: function() {
        this.showPanelView(new TagView({ model: this.model }));
    },

    showKeyChange: function(file, viewConfig) {
        if (Alerts.alertDisplayed) {
            return;
        }
        if (this.views.keyChange && this.views.keyChange.model.remote) {
            return;
        }
        this.hideSettings();
        this.hidePanelView();
        this.views.menu.hide();
        this.views.listWrap.hide();
        this.views.list.hide();
        this.views.listDrag.hide();
        this.views.details.hide();
        this.views.keyChange = new KeyChangeView({
            model: { file: file, expired: viewConfig.expired, remote: viewConfig.remote }
        });
        this.views.keyChange.setElement(this.$el.find('#app__body_main')).render();
        this.views.keyChange.on('accept', this.keyChangeAccept.bind(this));
        this.views.keyChange.on('cancel', this.showEntries.bind(this));
    },

    fileListUpdated: function() {
        if (this.model.files.hasOpenFiles()) {
            this.showEntries();
        } else {
            this.showApplicableOpenFileView();
        }
        this.fixClicksInEdge();
    },

    showRelevantInterface: function() {
        this.fileListUpdated();
    },

    showFileSettings: function(e) {
        const menuItem = this.model.menu.filesSection.get('items').find(item => item.get('file').cid === e.cid);
        if (this.views.settings) {
            if (this.views.settings.file === menuItem.get('file')) {
                this.showEntries();
            } else {
                this.model.menu.select({ item: menuItem });
            }
        } else {
            this.showSettings(menuItem);
        }
    },

    showFile: function(e) {
        this.showEntries();
        const menuItem = this.model.menu.groupsSection.get('items').find(item => item.file.id === e.fileId);
        this.model.menu.select({ item: menuItem });
    },

    showAccountSettings: function(e) {
        this.toggleSettings('account');
    },

    toggleOpenFile: function() {
        if (this.views.open || this.views.accountOpen) {
            if (this.model.files.hasOpenFiles()) {
                this.showEntries();
            }
        } else {
            this.showApplicableOpenFileView();
        }
    },

    beforeUnload: function(e) {
        const exitEvent = { preventDefault() { this.prevented = true; } };
        Backbone.trigger('main-window-will-close', exitEvent);
        if (exitEvent.prevented) {
            return;
        }
        // I can't understand the difference between modified and dirty states so
        // adding a modified check here too for defence against that complexity
        if (this.model.files.hasDirtyFiles() || this.model.files.hasUnsavedFiles()) {
            return Locale.appUnsavedWarnBody;
        }
    },

    windowResize: function() {
        Backbone.trigger('page-geometry', { source: 'window' });
    },

    windowBlur: function(e) {
        if (e.target === window) {
            Backbone.trigger('page-blur');
        }
    },

    enterFullScreen: function () {
        this.$el.addClass('fullscreen');
    },

    leaveFullScreen: function () {
        this.$el.removeClass('fullscreen');
    },

    escPressed: function() {
        if (this.views.open && this.model.files.hasOpenFiles()) {
            this.showEntries();
        }
    },

    backspacePressed: function(e) {
        if (e.target === document.body) {
            e.preventDefault();
        }
    },

    selectAll: function() {
        this.menuSelect({ item: this.model.menu.allItemsSection.get('items').first() });
    },

    menuSelect: function(opt) {
        this.model.menu.select(opt);
        if (this.views.panel && !this.views.panel.isHidden()) {
            this.showEntries();
        }
    },

    userIdle: function() {
        this.lockWorkspace(true);
    },

    osLocked: function() {
        if (this.model.settings.get('lockOnOsLock')) {
            this.lockWorkspace(true);
        }
    },

    appMinimized: function() {
        if (this.model.settings.get('lockOnMinimize')) {
            this.lockWorkspace(true);
        }
    },

    lockWorkspace: function(autoInit) {
        if (Alerts.alertDisplayed) {
            return;
        }
        if (this.model.files.hasUnsavedFiles()) {
            if (this.model.settings.get('autoSave')) {
                this.saveAndLock();
            } else {
                const message = autoInit ? Locale.appCannotLockAutoInit : Locale.appCannotLock;
                Alerts.alert({
                    icon: 'lock',
                    header: Locale.footerTitleLock,
                    body: message,
                    buttons: [
                        { result: 'save', title: Locale.saveChanges },
                        { result: 'discard', title: Locale.discardChanges, error: true },
                        { result: '', title: Locale.alertCancel }
                    ],
                    checkbox: Locale.setGenAutoSync,
                    success: (result, autoSaveChecked) => {
                        if (result === 'save') {
                            if (autoSaveChecked) {
                                this.model.settings.set('autoSave', autoSaveChecked);
                            }
                            this.saveAndLock();
                        } else if (result === 'discard') {
                            this.model.closeAllFiles();
                        }
                    }
                });
            }
        } else {
            this.closeAllFiles();
        }
    },

    saveAndLock: function(complete) {
        let pendingCallbacks = 0;
        const errorFiles = [];
        const that = this;
        this.model.files.forEach(function(file) {
            if (!file.get('dirty')) {
                return;
            }
            this.model.syncFile(file, null, fileSaved.bind(this, file));
            pendingCallbacks++;
        }, this);
        if (!pendingCallbacks) {
            this.closeAllFiles();
        }
        function fileSaved(file, err) {
            if (err) {
                errorFiles.push(file.get('name'));
            }
            if (--pendingCallbacks === 0) {
                if (errorFiles.length && that.model.files.hasDirtyFiles()) {
                    if (!Alerts.alertDisplayed) {
                        const alertBody = errorFiles.length > 1 ? Locale.appSaveErrorBodyMul : Locale.appSaveErrorBody;
                        Alerts.error({
                            header: Locale.appSaveError,
                            body: alertBody + ' ' + errorFiles.join(', ')
                        });
                    }
                    if (complete) { complete(true); }
                } else {
                    that.closeAllFiles();
                    if (complete) { complete(true); }
                }
            }
        }
    },

    closeAllFiles: function() {
        this.model.closeAllFiles();
    },

    saveAll: function() {
        this.model.files.forEach(function(file) {
            this.model.syncFile(file);
        }, this);
    },

    syncAllByTimer: function() {
        if (this.model.settings.get('autoSave')) {
            this.saveAll();
        }
    },

    remoteKeyChanged: function(e) {
        this.showKeyChange(e.file, { remote: true });
    },

    keyChangeAccept: function(e) {
        this.showEntries();
        this.model.syncFile(e.file, {
            remoteKey: {
                password: e.password,
                keyFileName: e.keyFileName,
                keyFileData: e.keyFileData
            }
        });
    },

    toggleSettings: function(page) {
        let menuItem = page ? this.model.menu[page + 'Section'] : null;
        if (menuItem) {
            menuItem = menuItem.get('items').first();
        }
        if (this.views.settings) {
            if (this.views.settings.page === page || !menuItem) {
                if (this.model.files.hasOpenFiles()) {
                    this.showEntries();
                } else {
                    this.showRelevantInterface();
                }
            } else {
                if (menuItem) {
                    this.model.menu.select({item: menuItem});
                }
            }
        } else {
            this.showSettings();
            if (menuItem) {
                this.model.menu.select({item: menuItem});
            }
        }
    },

    toggleMenu: function() {
        this.views.menu.switchVisibility();
    },

    toggleDetails: function(visible) {
        this.$el.find('.app').toggleClass('app--details-visible', visible);
        this.views.menu.switchVisibility(false);
    },

    editGroup: function(group) {
        if (group && !(this.views.panel instanceof GrpView)) {
            this.showEditGroup();
            this.views.panel.showGroup(group);
        } else {
            this.showEntries();
        }
    },

    editTag: function(tag) {
        if (tag && !(this.views.panel instanceof TagView)) {
            this.showEditTag();
            this.views.panel.showTag(tag);
        } else {
            this.showEntries();
        }
    },

    editGeneratorPresets: function() {
        if (!(this.views.panel instanceof GeneratorPresetsView)) {
            if (this.views.settings) {
                this.showEntries();
            }
            this.showPanelView(new GeneratorPresetsView({ model: this.model }));
        } else {
            this.showEntries();
        }
    },

    isContextMenuAllowed(e) {
        return ['input', 'textarea'].indexOf(e.target.tagName.toLowerCase()) < 0;
    },

    contextMenu: function(e) {
        if (this.isContextMenuAllowed(e)) {
            e.preventDefault();
        }
    },

    showContextMenu: function(e) {
        if (e.options && this.isContextMenuAllowed(e)) {
            e.stopImmediatePropagation();
            e.preventDefault();
            if (this.views.contextMenu) {
                this.views.contextMenu.remove();
            }
            const menu = new DropdownView({ model: e });
            menu.render({
                position: { left: e.pageX, top: e.pageY },
                options: e.options
            });
            menu.on('cancel', e => this.hideContextMenu());
            menu.on('select', e => this.contextMenuSelect(e));
            this.views.contextMenu = menu;
        }
    },

    hideContextMenu: function() {
        if (this.views.contextMenu) {
            this.views.contextMenu.remove();
            delete this.views.contextMenu;
        }
    },

    contextMenuSelect: function(e) {
        this.hideContextMenu();
        Backbone.trigger('context-menu-select', e);
    },

    dragover: function(e) {
        e.preventDefault();
        e.originalEvent.dataTransfer.dropEffect = 'none';
    },

    drop: function(e) {
        e.preventDefault();
    },

    setTheme: function() {
        SettingsManager.setTheme(this.model.settings.get('theme'));
    },

    setFontSize: function() {
        SettingsManager.setFontSize(this.model.settings.get('fontSize'));
    },

    setLocale: function() {
        SettingsManager.setLocale(this.model.settings.get('locale'));
        if (this.views.settings.isVisible()) {
            this.hideSettings();
            this.showSettings();
        }
        this.$el.find('.app__beta:first').text(Locale.appBeta);
    },

    bodyClick: function(e) {
        IdleTracker.regUserAction();
        Backbone.trigger('click', e);
    },

    KeeAddonActivationTimeout: 0,

    onKeeAddonEnabled: function() {
        window.keeAddonEnabled = true;

        // Message the add-on outside of the KPRPC protocol in order
        // to establish basic account details that the protocol requires for init
        const latestClientToken = this.model.settings.get('latestClientToken');
        if (latestClientToken) KPRPCHandler.sendServiceAccessTokens({client: latestClientToken});

        this.KeeAddonActivationTimeout = setTimeout(() => {
            this.views.vaultOverlay.onKeeAddonEnabledButNotActivated();
        }, 3000);
    },

    onKeeAddonActivated: function() {
        window.keeAddonActive = true;
        if (this.KeeAddonActivationTimeout) clearTimeout(this.KeeAddonActivationTimeout);
        this.views.vaultOverlay.onKeeAddonActivated();
    }
});

module.exports = AppView;
