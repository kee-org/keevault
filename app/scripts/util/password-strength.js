const zxcvbn = require('zxcvbn');
const badWords = require('../const/badWords');
const Locale = require('./locale');
const EmailUtils = require('./email');

const PasswordStrength = {
    fuzzyStrength: function(password, emailAddrParts) {
        const userInputs = badWords.concat(emailAddrParts);
        const strength = Math.round(zxcvbn(password.substring(0, 80), userInputs).guesses_log10);
        const randomFactor = Math.random();
        let fuzzyStrength = 1;
        if (strength >= 21) {
            if (randomFactor > 0.4) fuzzyStrength = 5;
            else fuzzyStrength = 4;
        } else if (strength >= 18) {
            if (randomFactor > 0.8) fuzzyStrength = 5;
            else if (randomFactor > 0.2) fuzzyStrength = 4;
            else fuzzyStrength = 3;
        } else if (strength >= 15) {
            if (randomFactor > 0.8) fuzzyStrength = 4;
            else if (randomFactor > 0.2) fuzzyStrength = 3;
            else fuzzyStrength = 2;
        } else if (strength >= 12) {
            if (randomFactor > 0.8) fuzzyStrength = 3;
            else if (randomFactor > 0.2) fuzzyStrength = 2;
            else fuzzyStrength = 1;
        } else {
            if (randomFactor > 0.6) fuzzyStrength = 2;
            else fuzzyStrength = 1;
        }
        return fuzzyStrength;
    },

    exactStrength: function(password, emailAddrParts) {
        const userInputs = badWords.concat(emailAddrParts);
        const strength = Math.round(zxcvbn(password.substring(0, 80), userInputs).guesses_log10);
        if (strength >= 21) {
            return 5;
        } else if (strength >= 19) {
            return 4.5;
        } else if (strength >= 18) {
            return 4;
        } else if (strength >= 16) {
            return 3.5;
        } else if (strength >= 14) {
            return 3;
        } else if (strength >= 13) {
            return 2.5;
        } else if (strength >= 12) {
            return 2;
        } else if (strength >= 11) {
            return 1.5;
        } else if (strength >= 9) {
            return 1;
        } else {
            return 0.5;
        }
    },

    renderPasswordStrength: function(strength, rootJQueryEl, selectorOverride) {
        const div = rootJQueryEl.find(selectorOverride || '#settings__account-master-pass-strength')[0];
        if (!div) return;

        div.title = Locale.strength + ': ' + (strength || '-');
        while (div.firstChild) div.removeChild(div.firstChild);

        for (let i = strength; i >= 1; i--) {
            const star = document.createElement('i');
            star.className = 'fa fa-star fa-fw';
            div.appendChild(star);
        }
        if (strength % 1 === 0.5) {
            strength = strength + 0.5;
            const star = document.createElement('i');
            star.className = 'fa fa-star-half-alt fa-fw';
            div.appendChild(star);
        }
        for (let i = 5 - strength; i >= 1; i--) {
            const star = document.createElement('i');
            star.className = 'far fa-star fa-fw';
            div.appendChild(star);
        }
    },

    updateAndRender: function(password, emailOrParts, target) {
        setImmediate(() => {
            const emailAddrParts = Array.isArray(emailOrParts) ? emailOrParts : EmailUtils.split(EmailUtils.canonicalise(emailOrParts));
            const strength = PasswordStrength.exactStrength(password, emailAddrParts);
            PasswordStrength.renderPasswordStrength(strength, target);
        });
    }
};

module.exports = PasswordStrength;
