const Backbone = require('backbone');
const VaultModalView = require('../views/vault-modal-view');
const Locale = require('../util/locale');
const FeatureDetector = require('../util/feature-detector');

const VaultIntro = {

    buttons: {
        continue: {result: 'continue', get title() { return Locale.continue; }},
        demoWithoutExtension: {result: 'demo', get title() { return Locale.demoWithoutExtension; }},
        installTheExtension: {result: 'install', get title() { return Locale.installTheExtension; }},
        launchTutorial: {result: 'continue', get title() { return Locale.launchTutorial; }},
        launchTutorialDisabled: {result: 'continue', get title() { return Locale.launchTutorial; }, get keeAddonRequired() { return true; }},
        ok: {result: 'yes', get title() { return Locale.alertOk; }},
        yes: {result: 'yes', get title() { return Locale.alertYes; }},
        no: {result: '', get title() { return Locale.alertNo; }},
        cancel: {result: '', get title() { return Locale.alertCancel; }}
    },

    latestView: null,

    warningTimer: 0,

    display: function(config) {
        let newMaskContainers;
        let newTransparentMaskContainer;
        const masks = document.querySelectorAll('div.vault_mask,div.vault_mask_transparent');

        if (config.masked) {
            newMaskContainers = document.querySelectorAll(config.masked.join());
        }
        if (config.target) {
            newTransparentMaskContainer = document.querySelector(config.target);
        }

        function maskInNewConfig(maskContainer) {
            if (maskContainer === newTransparentMaskContainer) return true;
            if (newMaskContainers) {
                for (const v of newMaskContainers.values()) {
                    if (maskContainer === v) return true;
                }
            }
            return false;
        }

        function createOrUpdateMask (maskContainer, maskClass) {
            let newMask = maskContainer.querySelector('div.vault_mask,div.vault_mask_transparent');
            if (!newMask) {
                newMask = document.createElement('div');
                maskContainer.appendChild(newMask);
            }
            newMask.classList.remove('vault_mask');
            newMask.classList.remove('vault_mask_transparent');
            newMask.classList.add(maskClass);
        }

        // all masks should be removed unless they are also in the new config
        for (const m of masks) {
            const parent = m.parentNode;
            if (parent && !maskInNewConfig(parent)) {
                parent.removeChild(m);
            }
        }

        if (newTransparentMaskContainer) {
            createOrUpdateMask(newTransparentMaskContainer, 'vault_mask_transparent');
        }
        if (newMaskContainers && newMaskContainers.length > 0) {
            for (const m of newMaskContainers) {
                createOrUpdateMask(m, 'vault_mask');
            }
        }

        this.latestView = new VaultModalView({ model: config });
        this.latestView.render();
        this.latestView.on('result', (res, check) => {
            if (config.complete && res !== 'abort') {
                config.complete(res);
            }
        });
    },

    removeAllMasks: function() {
        const masks = document.querySelectorAll('div.vault_mask,div.vault_mask_transparent');
        for (const m of masks) {
            const parent = m.parentNode;
            if (parent) parent.removeChild(m);
        }
    },

    abort: function() {
        this.removeAllMasks();
        if (!this.latestView) return;
        this.latestView.abort();
    },

    onKeeAddonEnabledButNotActivated: function() {
        if (!this.latestView) return;
        // We can't re-render because backbone messes with even the bits of DOM that have not
        // changed and hence will re-trigger initial animations
        const pNode = this.latestView.$el.find('#pendingKeeExtensionMessage');
        if (pNode && pNode.length) {
            pNode[0].textContent = Locale.closeKeePassDetails;
        }
    },

    onKeeAddonActivated: function() {
        if (!this.latestView) return;
        if (this.warningTimer) clearTimeout(this.warningTimer);

        // We can't re-render because backbone messes with even the bits of DOM that have not
        // changed and hence will re-trigger initial animations
        const contentToEnable = this.latestView.$el[0].querySelectorAll('.keeAddonRequired');
        $(contentToEnable).removeAttr('disabled');
        const contentToRemove = this.latestView.$el[0].querySelector('button[data-result=demo]');
        if (contentToRemove) contentToRemove.remove();
        const pNode = this.latestView.$el.find('#pendingKeeExtensionMessage');
        if (pNode && pNode.length) {
            pNode[0].textContent = Locale.keeExtensionInstalled;
        }
    },

    mobileMessage: function() {
        // Display just a single intro message for mobile users and let them work it out themselves.

        this.display({
            bodyUnescaped: `<p>${Locale.introPutSecretsHere}</p>
            <p>${Locale.introExploreMobile}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '',
            position: '',
            masked: ['.app__details', '.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                VaultIntro.abort();
            }
        });
    },

    start: function() {
        // start a chain reaction of modals for training/intro/etc.

        this.display({
            bodyUnescaped: `<p>${Locale.introPutSecretsHere}</p>
            <p>${Locale.introEnterMasterPasswordLater}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '',
            position: '',
            masked: ['.app__details', '.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                VaultIntro.layout1();
            }
        });
    },

    layout1: function() {
        this.display({
            bodyUnescaped: `<p>${Locale.introEntry}</p>
            <p>${Locale.introEntryDetail}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '.app__details',
            position: 'left',
            masked: ['.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                VaultIntro.layout2();
            }
        });
    },

    layout2: function() {
        this.display({
            bodyUnescaped: `<p>${Locale.introList}</p>
            <p>${Locale.introListDetail}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '.app__list > .list',
            position: 'right',
            masked: ['.app__details', '.app__menu', '.app__footer'],
            complete: res => {
                VaultIntro.layout3();
            }
        });
    },

    layout3: function() {
        this.display({
            bodyUnescaped: `<p>${Locale.introMenuDetail}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '.app__menu',
            position: 'right',
            masked: ['.app__details', '.app__list > .list', '.app__footer'],
            complete: res => {
                VaultIntro.layout4();
            }
        });
    },

    layout4: function() {
        this.display({
            bodyUnescaped: `<p>${Locale.introFooter}</p>
            <p>${Locale.introFooterDetail}</p>`,
            buttons: [this.buttons.continue],
            esc: '',
            enter: 'continue',
            target: '.app__footer',
            position: 'top',
            masked: ['.app__details', '.app__list > .list', '.app__menu'],
            complete: res => {
                document.getElementById('initialPageBannerStrapline').classList.add('hide');
                document.getElementById('keeAddonBannerStrapline').classList.remove('hide');

                if (!window.keeAddonEnabled) {
                    const installURL = FeatureDetector.getExtensionInstallURL();
                    if (installURL) {
                        VaultIntro.layout5(installURL);
                    } else {
                        VaultIntro.removeAllMasks();
                        Backbone.trigger('show-demo-blurb');
                    }
                } else if (!window.keeAddonActive) {
                    // Warn user if not activated within 2 seconds.
                    // Could just go straight to the warning but this delay catches
                    // the edge case of add-on activation being in progress exactly
                    // when user reaches this point in the intro sequence
                    if (!VaultIntro.warningTimer) {
                        VaultIntro.warningTimer = setTimeout(() => {
                            VaultIntro.onKeeAddonEnabledButNotActivated();
                        }, 2000);
                    }
                    VaultIntro.layout6b();
                } else {
                    VaultIntro.layout6a();
                }
            }
        });
    },

    layout5: function(installURL) {
        this.display({
            bodyUnescaped: `<p id="pendingKeeExtensionMessage">${Locale.introInstallExtension}<br/><br/>${Locale.introInstallExtensionRequiresV3}</p>`,
            buttons: [Object.assign(this.buttons.demoWithoutExtension, {silent: true}), this.buttons.installTheExtension],
            esc: false,
            enter: false,
            click: false,
            masked: ['.app__details', '.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                if (res === 'install') {
                    // In case user installed extension in the mean time without
                    // pressing the install button we don't want to confuse them
                    // with another new tab
                    if (!window.keeAddonEnabled) {
                        const otherWindow = window.open();
                        otherWindow.opener = null;
                        otherWindow.location = installURL;
                        VaultIntro.layout6b();
                    } else {
                        VaultIntro.layout6a();
                    }
                } else {
                    VaultIntro.removeAllMasks();
                    Backbone.trigger('show-demo-blurb');
                }
            }
        });
    },

    layout6a: function() {
        this.display({
            bodyUnescaped: `<p id="pendingKeeExtensionMessage">${Locale.introExtensionStartExisting}</p>`,
            buttons: [this.buttons.launchTutorial],
            esc: false,
            enter: false,
            click: false,
            masked: ['.app__details', '.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                const otherWindow = window.open();
                otherWindow.opener = null;
                otherWindow.location = 'https://tutorial-addon.kee.pm';
                VaultIntro.removeAllMasks();
                Backbone.trigger('show-demo-blurb');
            }
        });
    },

    layout6b: function() {
        this.display({
            bodyUnescaped: `<p id="pendingKeeExtensionMessage">${Locale.introExtensionStartNew}<br/><br/>${Locale.introExtensionMaybeOldVersion}</p>`,
            buttons: [Object.assign(this.buttons.demoWithoutExtension, {silent: true}), this.buttons.launchTutorialDisabled],
            esc: 'demo',
            enter: false,
            masked: ['.app__details', '.app__list > .list', '.app__menu', '.app__footer'],
            complete: res => {
                if (res === 'continue') {
                    const otherWindow = window.open();
                    otherWindow.opener = null;
                    otherWindow.location = 'https://tutorial-addon.kee.pm';
                }
                VaultIntro.removeAllMasks();
                Backbone.trigger('show-demo-blurb');
            }
        });
    }
};

module.exports = VaultIntro;
