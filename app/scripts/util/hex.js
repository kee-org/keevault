const Hex = {
    base642hex (text) {
        const array = this.base64toByteArray(text);
        return this.byteArrayToHex(array);
    },

    base64toByteArray (input) {
        const binary = atob(input);
        return this.binaryToByteArray(binary);
    },

    binaryToByteArray (binary) {
        const len = binary.length;
        const buffer = new ArrayBuffer(len);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < len; i++) {
            view[i] = binary.charCodeAt(i);
        }
        return view;
    },

    byteArrayToHex (array) {
        return Array.prototype.map.call(array, (x) => ('00' + x.toString(16)).slice(-2)).join('');
    },

    hex2base64 (text) {
        const array = this.hexStringToByteArray(text);
        return this.byteArrayToBase64(array);
    },

    byteArrayToBase64 (bytes) {
        let base64 = '';
        const encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const byteLength = bytes.byteLength;
        const byteRemainder = byteLength % 3;
        const mainLength = byteLength - byteRemainder;
        let a;
        let b;
        let c;
        let d;
        let chunk;

    // Main loop deals with bytes in chunks of 3
        for (let i = 0; i < mainLength; i = i + 3) {
        // Combine into a single integer
            chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

        // Use bitmasks to extract 6-bit segments from the triplet
            a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
            b = (chunk & 258048) >> 12; // 258048 = (2^6 - 1) << 12
            c = (chunk & 4032) >> 6; // 4032 = (2^6 - 1) << 6
            d = chunk & 63; // 63 = 2^6 - 1

        // Convert the raw binary segments to the appropriate ASCII encoding
            base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
        }

    // Deal with the remaining bytes and padding
        if (byteRemainder === 1) {
            chunk = bytes[mainLength];

            a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

        // Set the 4 least significant bits to zero
            b = (chunk & 3) << 4; // 3 = 2^2 - 1

            base64 += encodings[a] + encodings[b] + '==';
        } else if (byteRemainder === 2) {
            chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

            a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
            b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

        // Set the 2 least significant bits to zero
            c = (chunk & 15) << 2; // 15 = 2^4 - 1

            base64 += encodings[a] + encodings[b] + encodings[c] + '=';
        }

        return base64;
    },

    hexStringToByteArray (hex) {
        if (hex.length % 2 !== 0) {
            throw new Error('Must have an even number of hex digits to convert to bytes');
        }
        const numBytes = hex.length / 2;
        const byteArray = new Uint8Array(numBytes);
        for (let i = 0; i < numBytes; i++) {
            byteArray[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        return byteArray;
    }

};

module.exports = Hex;
