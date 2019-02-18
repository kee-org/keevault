const zxcvbn = require('zxcvbn');
const badWords = require('../const/badWords');

const PasswordStrength = {
    fuzzyStrength: function(password) {
        const userInputs = badWords; // TODO: .concat([emailAddrParts])
        const strength = Math.round(zxcvbn(password, userInputs).guesses_log10);
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

    exactStrength: function(password) {
        const userInputs = badWords; // TODO: .concat([emailAddrParts])
        const strength = Math.round(zxcvbn(password, userInputs).guesses_log10);
        if (strength >= 21) {
            return 5;
        } else if (strength >= 18) {
            return 4;
        } else if (strength >= 15) {
            return 3;
        } else if (strength >= 12) {
            return 2;
        } else {
            return 1;
        }
    }
};

module.exports = PasswordStrength;
