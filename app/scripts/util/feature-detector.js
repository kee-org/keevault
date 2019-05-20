const Bowser = require('bowser');
const browser = Bowser.getParser(window.navigator.userAgent);
const browserInfo = browser.parse().parsedResult;

const MobileRegex = /iPhone|iPad|iPod|Android|BlackBerry|Opera Mini|IEMobile|WPDesktop|Windows Phone|webOS/i;
const MinDesktopScreenWidth = 800;

const isDesktop = !!(window.process && window.process.versions && window.process.versions.electron);

const FeatureDetector = {
    isDesktopApp: isDesktop,
    isMac: navigator.platform.indexOf('Mac') >= 0,
    isWindows: navigator.platform.indexOf('Win') >= 0,
    isiOS: /iPad|iPhone|iPod/i.test(navigator.userAgent),
    isMobile: MobileRegex.test(navigator.userAgent) || screen.width < MinDesktopScreenWidth,
    isPopup: !!((window.parent !== window.top) || window.opener),
    isStandalone: !!navigator.standalone || window.matchMedia('(display-mode: standalone)').matches,
    isFrame: window.top !== window,
    isSelfHosted: !isDesktop && !/^http(s?):\/\/((app-dev.kee.pm:8087)|((app|app-beta)\.kee\.pm))/.test(location.href),
    needFixClicks: /Edge\/14/.test(navigator.appVersion),

    actionShortcutSymbol: function(formatting) {
        return this.isMac ? '⌘' : formatting ? '<span class="thin">ctrl + </span>' : 'ctrl-';
    },
    altShortcutSymbol: function(formatting) {
        return this.isMac ? '⌥' : formatting ? '<span class="thin">alt + </span>' : 'alt-';
    },
    globalShortcutSymbol: function(formatting) {
        return this.isMac ? '⌃⌥' : formatting ? '<span class="thin">shift+alt+</span>' : 'shift-alt-';
    },
    globalShortcutIsLarge: function() {
        return !this.isMac;
    },
    screenshotToClipboardShortcut: function() {
        if (this.isiOS) { return 'Sleep+Home'; }
        if (this.isMobile) { return ''; }
        if (this.isMac) { return 'Command-Shift-Control-4'; }
        if (this.isWindows) { return 'Alt+PrintScreen'; }
        return '';
    },
    supportsTitleBarStyles: function() {
        return this.isMac;
    },
    hasUnicodeFlags: function() {
        return this.isMac;
    },
    getBrowserCssClass: function() {
        if (window.chrome && window.chrome.webstore) {
            return 'chrome';
        }
        if (window.navigator.userAgent.indexOf('Edge/') > -1) {
            return 'edge';
        }
        return '';
    },
    getBrowserExtensionType: function() {
        if (browserInfo.platform.type === 'desktop') {
            if (browserInfo.browser.name === 'Chrome' || browserInfo.browser.name === 'Chromium') {
                return 'Chrome';
            } if (browserInfo.browser.name === 'Firefox') {
                return 'Firefox';
            }
        }
        return '';
    },
    getExtensionInstallURL: function() {
        const extType = this.getBrowserExtensionType();
        if (extType === 'Firefox') {
            return 'https://addons.mozilla.org/en-US/firefox/addon/keefox/';
        }
        if (extType === 'Chrome') {
            return 'https://chrome.google.com/webstore/detail/kee/mmhlniccooihdimnnjhamobppdhaolme';
        }
        return '';
    },
    getPlatformType: function() {
        return browserInfo.platform.type;
    },
    exitsOnBack: function() {
        return this.isStandalone && browserInfo.os.name === 'Android';
    }
};

module.exports = FeatureDetector;
