const Backbone = require('backbone');

const AccountMobileView = Backbone.View.extend({
    template: require('templates/account-mobile.hbs'),

    events: {
        'click #emailMeALink': 'emailForLater',
        'click #registerAnyway': 'register'
    },

    render: function () {
        this.renderTemplate();
        return this;
    },

    emailForLater: function() {
        // TODO: email later
        // const loginEmail = this.canonicaliseEmail($('#loginEmail').val());
        // this.model.closeAllFiles();
        // $('body')[0].classList.remove('enable_native_scroll');
    },

    register: function() {
        $('body')[0].classList.remove('enable_native_scroll');
        Backbone.trigger('show-registration');
    },

    canonicaliseEmail: function(email) {
        return email.toLowerCase();
    }
});

module.exports = AccountMobileView;
