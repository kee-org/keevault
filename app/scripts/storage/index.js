const BuiltInStorage = {
    cache: require('./storage-cache'),
    vault: require('./storage-vault')
};

const ThirdPartyStorage = {
    dropbox: require('./storage-dropbox'),
    webdav: require('./storage-webdav'),
    gdrive: require('./storage-gdrive'),
    onedrive: require('./storage-onedrive')
};

const storage = BuiltInStorage;
_.extend(storage, ThirdPartyStorage);

module.exports = storage;
