const UrlUtil = {
    multiSlashRegex: /\/{2,}/g,
    lastPartRegex: /\/?[^\/\\]+$/,
    kdbxEndRegex: /\.kdbx$/i,

    getDataFileName: function(url) {
        const ix = url.lastIndexOf('/');
        if (ix >= 0) {
            url = url.substr(ix + 1);
        }
        url = url.replace(/\?.*/, '').replace(/\.kdbx/i, '');
        return url;
    },

    isKdbx: function(url) {
        return url && this.kdbxEndRegex.test(url);
    },

    fixSlashes: function(url) {
        return url.replace(this.multiSlashRegex, '/');
    },

    fileToDir: function(url) {
        return url.replace(this.lastPartRegex, '') || '/';
    },

    // TODO: Next four functions seem to be dead weight. If not, they need fixing!
    b64urlTob64: function(input) {
        return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/\./g, '=');
    },

    b64Tob64url: function(input) {
        return input.replace(/\//g, '_').replace(/\+/g, '-').replace(/\=/g, '.');
    },

    base64urlEncode: function(input) {
        return btoa(input).replace(/\+/g, '-').replace(/\//g, '_');
    },

    base64urlDecode (input) {
        return atob(input.replace(/\-/g, '+').replace(/\_/g, '/'));
    }
};

module.exports = UrlUtil;
