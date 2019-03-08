const EmailUtil = {

    validationRegex: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

    canonicalise: function(email) {
        return email.toLowerCase().trim();
    },

    validate: function(email) {
        return EmailUtil.validationRegex.test(email);
    }
};

module.exports = EmailUtil;
