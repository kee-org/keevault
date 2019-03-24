const Backbone = require('backbone');
const AppModel = require('./models/app-model');
const AppView = require('./views/app-view');
const AppSettingsModel = require('./models/app-settings-model');
const UpdateModel = require('./models/update-model');
const RuntimeDataModel = require('./models/runtime-data-model');
const KeyHandler = require('./comp/key-handler');
const IdleTracker = require('./comp/idle-tracker');
const PopupNotifier = require('./comp/popup-notifier');
const MultiInstanceComms = require('./comp/multi-instance-comms');
const Alerts = require('./comp/alerts');
const AuthReceiver = require('./comp/auth-receiver');
const SettingsManager = require('./comp/settings-manager');
const FeatureTester = require('./comp/feature-tester');
const FeatureDetector = require('./util/feature-detector');
const KdbxwebInit = require('./util/kdbxweb-init');
const Locale = require('./util/locale');
const KPRPCHandler = require('./comp/keepassrpc');
const RuntimeInfo = require('./comp/runtime-info');
const KeeFrontend = require('kee-frontend');
const OpenProgressReporter = require('./comp/open-progress-reporter');

const ready = $;

ready(() => {
    if (FeatureDetector.isPopup && AuthReceiver.receive() || FeatureDetector.isFrame) {
        return;
    }
    loadMixins();

    const appModel = new AppModel();

    Promise.resolve()
        .then(loadConfigs)
        .then(initModules)
        .then(loadConfig)
        .then(ensureCanRun)
        .then(prepareApp)
        .then(showApp)
        .catch(e => {
            appModel.appLogger.error('Error starting app', e);
        });

    function loadMixins() {
        require('./mixins/view');
        require('./helpers');
    }

    function ensureCanRun() {
        return FeatureTester.test()
            .catch(e => {
                Alerts.error({
                    header: Locale.appSettingsError,
                    body: Locale.appNotSupportedError + '<br/><br/>' + e,
                    buttons: [],
                    esc: false, enter: false, click: false
                });
                throw new Error('Feature testing failed: ' + e);
            });
    }

    function loadConfigs() {
        return Promise.all([
            AppSettingsModel.instance.load(),
            UpdateModel.instance.load(),
            RuntimeDataModel.instance.load()
        ]);
    }

    function initModules() {
        KeyHandler.init();
        IdleTracker.init(() => appModel.files.hasOpenFiles() && !appModel.files.hasDemoFile());
        OpenProgressReporter.init();
        PopupNotifier.init();
        KdbxwebInit.init();
        return Promise.resolve();
    }

    function loadConfig() {
        return Promise.resolve().then(() => {
            SettingsManager.setBySettings(appModel.settings);
        });
    }

    function showApp() {
        return Promise.resolve()
            .then(() => {
                const skipHttpsWarning = localStorage.skipHttpsWarning || appModel.settings.get('skipHttpsWarning');
                const protocolIsInsecure = ['https:', 'file:', 'app:'].indexOf(location.protocol) < 0;
                const hostIsInsecure = location.hostname !== 'localhost';
                if (protocolIsInsecure && hostIsInsecure && !skipHttpsWarning) {
                    return new Promise(resolve => {
                        Alerts.error({
                            header: Locale.appSecWarn, icon: 'user-secret', esc: false, enter: false, click: false,
                            body: Locale.appSecWarnBody1 + '<br/><br/>' + Locale.appSecWarnBody2,
                            buttons: [
                                {result: '', title: Locale.appSecWarnBtn, error: true}
                            ],
                            complete: () => {
                                showView();
                                resolve();
                            }
                        });
                    });
                } else {
                    showView();
                }
            });
    }

    async function prepareApp() {
        KeeFrontend.User.UserManager.init(RuntimeInfo.stage, appModel.account.tokensChanged);
        KeeFrontend.Storage.StorageManager.init(RuntimeInfo.stage);
        KeeFrontend.Messages.MessagesManager.init(RuntimeInfo.stage);
        KeeFrontend.Reset.ResetManager.init(RuntimeInfo.stage);
        appModel.prepare();
        // later: display nicer "loading" message / animation - maybe different to HTML one? or not
        await MultiInstanceComms.init(appModel.destinationFeature, cedePolitely, cedeForcefully, getRecentAuthToken);
    }

    function cedePolitely() {
        if (!appModel.files.hasOpenFiles()) {
            cede();
            return true;
        }
        return false;
    }

    function cedeForcefully() {
        // In future we could try something closer to the app-view:lockWorkspace()
        // implementation but for now its callback-heavy structure is too complex
        // to integrate here reliably so we just abort if there are any unsaved changes
        if (!appModel.files.hasUnsavedFiles()) {
            appModel.closeAllFiles();
            cede();
            return true;
        }
        return false;
    }

    function cede() {
        KPRPCHandler.shutdown();
        Alerts.error({
            icon: 'ban', esc: false, enter: false, click: false, buttons: [],
            body: Locale.disabledInThisTab
        });
    }

    async function getRecentAuthToken() {
        // In future we could try to reuse a recent token but for simplicity we always fetch a new one now
        return appModel.account.getNewAuthToken();
    }

    function showView() {
        const appView = new AppView({ model: appModel });
        appView.render();
        window.ridMatomoStartup();
        watchForUpdates();
        KPRPCHandler.init(appView);
        Backbone.trigger('app-ready');
        logStartupTime();
    }

    function watchForUpdates() {
        window.updateAvailableRenderer = function (updateAvailableElement) {
            document.body.prepend(updateAvailableElement);
        };
        if (window.updateAvailableElement) {
            window.updateAvailableRenderer(window.updateAvailableElement);
        }
    }

    function logStartupTime() {
        const time = Math.round(performance.now());
        appModel.appLogger.info(`Started in ${time}ms ¯\\_(ツ)_/¯`);
    }
});
