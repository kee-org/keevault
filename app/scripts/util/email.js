const EmailUtil = {

    validationRegex: /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

    canonicalise: function(email) {
        return email.toLowerCase().trim();
    },

    validate: function(email) {
        return EmailUtil.validationRegex.test(email);
    },

    split: function(email) {
        if (!email || !email.length) return [];
        const parts = email.split(/[.!#$%&'*+\/=?^_`{|}~@-]/, 20);
        return parts.concat(parts.join(''), email).filter(x => x.length >= 3);
    }
};

module.exports = EmailUtil;
