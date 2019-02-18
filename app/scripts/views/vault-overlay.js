const Backbone = require('backbone');
const VaultIntro = require('../comp/vault-intro');
const FeatureDetector = require('../util/feature-detector');

const VaultOverlayView = Backbone.View.extend({
    template: require('templates/vault-overlay.hbs'),

    events: {
        'click .vault_primary_action': 'ctaClick',
        'click .vault_existing_user_login': 'login',
        'click #demoSignUpCTA': 'register'
    },

    render: function () {
        const installURL = FeatureDetector.getExtensionInstallURL();
        this.renderTemplate({extensionLink: installURL, isMobile: FeatureDetector.isMobile});
        return this;
    },

    showTopDemoBlurb: function() {
        this.$el[0].querySelector('#demoBlurb').classList.remove('hide');
    },

    ctaClick: function() {
        if (FeatureDetector.isMobile) {
            Backbone.trigger('show-account-mobile-warning');
        } else {
            this.shrink();
        }
    },

    shrink: function() {
        this.model.createDemoFile();
        this.smoothScroll(document.body.scrollLeft, document.body.scrollTop, 0, 0);
    },

    login: function() {
        const loginEmail = this.canonicaliseEmail($('#loginEmail').val());
        if (loginEmail) {
            this.model.settings.set('directAccountEmail', loginEmail);
        }
        this.model.closeAllFiles();
        VaultIntro.abort();
        $('body')[0].classList.remove('enable_native_scroll');
        Backbone.trigger('show-account');
    },

    register: function() {
        this.model.closeAllFiles();
        VaultIntro.abort();
        $('body')[0].classList.remove('enable_native_scroll');
        Backbone.trigger('show-registration');
    },

    onKeeAddonEnabledButNotActivated: function() {
        VaultIntro.onKeeAddonEnabledButNotActivated();
    },

    onKeeAddonActivated: function() {
        // We can't re-render because backbone messes with even the bits of DOM that have not changed and hence will re-trigger initial animations
        // this.$el.remove('.keeAddonMissing');
        const contentToRemove = this.$el[0].querySelectorAll('.keeAddonMissing');
        $(contentToRemove).remove();
        VaultIntro.onKeeAddonActivated();
    },

    canonicaliseEmail: function(email) {
        return email.toLowerCase();
    },

    smoothScroll: function (startX, startY, endX, endY) {
        const overlay = this;
        let timeElapsed = 0;
        let start;

        const wipeDown = function () {
            overlay.$el.parent().removeClass('vault_landing').addClass('vault_start');
            overlay.$el[0].addEventListener('animationend', ev => {
                VaultIntro.start();
                $('body')[0].classList.remove('enable_native_scroll');
            }, false);
        };

        const distanceX = endX - startX;
        const distanceY = endY - startY;
        const change = Math.max(
            Math.abs(distanceX),
            Math.abs(distanceY)
        );
        if (!change) {
            wipeDown();
            return;
        }
        const timeRequired = 50000 * (change / 2000);

        requestAnimationFrame(function animate (timestamp) {
            if (start == null) {
                start = timestamp;
            }
            timeElapsed += timestamp - start;
            const percentage = Math.max(0, Math.min(1, timeElapsed / timeRequired));
            const positionX = Math.floor(startX + (distanceX * percentage));
            const positionY = Math.floor(startY + (distanceY * percentage));

            document.body.scrollTo(positionX, positionY);

            if (positionX !== endX || positionY !== endY) {
                requestAnimationFrame(animate);
            } else {
                wipeDown();
            }
        });
    }
});

module.exports = VaultOverlayView;
