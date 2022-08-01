const Backbone = require('backbone');
const AttachmentModel = require('./attachment-model');
const IconMap = require('../const/icon-map');
const Color = require('../util/color');
const IconUrl = require('../util/icon-url');
const Logger = require('../util/logger');
const Otp = require('../util/otp');
const kdbxweb = require('kdbxweb');
const EntrySettingsModel = require('./browser-addon/entry-settings-model');

const logger = new Logger('entry');

const EntryModel = Backbone.Model.extend({
    defaults: {},

    urlRegex: /^https?:\/\//i,
    fieldRefRegex: /^\{REF:([TNPAU])@I:(\w{32})}$/,

    builtInFields: ['Title', 'Password', 'UserName', 'URL', 'Notes', 'TOTP Seed', 'TOTP Settings', '_etm_template_uuid', 'KPRPC JSON'],
    fieldRefFields: ['title', 'password', 'user', 'url', 'notes'],
    fieldRefIds: { T: 'Title', U: 'UserName', P: 'Password', A: 'URL', N: 'Notes' },

    initialize: function () {
    },

    setEntry: function (entry, group, file) {
        this.entry = entry;
        this.group = group;
        this.file = file;
        if (this.get('uuid') === entry.uuid.id) {
            this._checkUpdatedEntry();
        }
        // we cannot calculate field references now because database index has not yet been built
        this.hasFieldRefs = false;
        this._fillByEntry();
        this.hasFieldRefs = true;

        this.set('browserSettings', this._readBrowserExtensionSettings());
    },

    _fillByEntry: function () {
        const entry = this.entry;
        this.set({ id: this.file.subId(entry.uuid.id), uuid: entry.uuid.id }, { silent: true });
        this.fileName = this.file.get('name');
        this.groupName = this.group.get('title');
        this.title = this._getFieldString('Title');
        this.password = entry.fields.Password
            ? ((entry.fields.Password instanceof kdbxweb.ProtectedValue)
                ? entry.fields.Password
                : kdbxweb.ProtectedValue.fromString(entry.fields.Password))
            : kdbxweb.ProtectedValue.fromString('');
        this.notes = this._getFieldString('Notes');
        this.url = this._getFieldString('URL');
        this.displayUrl = this._getDisplayUrl(this._getFieldString('URL'));
        this.user = this._getFieldString('UserName');
        this.iconId = entry.icon;
        this.icon = this._iconFromId(entry.icon);
        this.tags = entry.tags;
        this.color = this._colorToModel(entry.bgColor) || this._colorToModel(entry.fgColor);
        this.fields = this._fieldsToModel(entry.fields);
        this.attachments = this._attachmentsToModel(entry.binaries);
        this.created = entry.times.creationTime;
        this.updated = entry.times.lastModTime;
        this.expires = entry.times.expires ? entry.times.expiryTime : undefined;
        this.expired = entry.times.expires && entry.times.expiryTime <= new Date();
        this.historyLength = entry.history.length;
        this._buildCustomIcon();
        this._buildSearchText();
        this._buildSearchTags();
        this._buildSearchColor();
        if (this.hasFieldRefs) {
            this.resolveFieldReferences();
        }
    },

    _getFieldString: function (field) {
        const val = this.entry.fields[field];
        if (!val) {
            return '';
        }
        if (val.isProtected) {
            return val.getText();
        }
        return val.toString();
    },

    _checkUpdatedEntry: function () {
        if (this.isJustCreated) {
            this.isJustCreated = false;
        }
        if (this.canBeDeleted) {
            this.canBeDeleted = false;
        }
        if (this.unsaved && +this.updated !== +this.entry.times.lastModTime) {
            this.unsaved = false;
        }
    },

    _buildSearchText: function () {
        let text = '';
        _.forEach(this.entry.fields, value => {
            if (typeof value === 'string') {
                text += value.toLowerCase() + '\n';
            }
        });
        this.entry.tags.forEach(tag => {
            text += tag.toLowerCase() + '\n';
        });
        this.attachments.forEach(att => {
            text += att.title.toLowerCase() + '\n';
        });
        this.searchText = text;
    },

    _buildCustomIcon: function () {
        this.customIcon = null;
        this.customIconId = null;
        if (this.entry.customIcon) {
            this.customIcon = IconUrl.toDataUrl(this.file.db.meta.customIcons[this.entry.customIcon]);
            this.customIconId = this.entry.customIcon.toString();
        }
    },

    _buildSearchTags: function () {
        this.searchTags = this.entry.tags.map(tag => tag.toLowerCase());
    },

    _buildSearchColor: function () {
        this.searchColor = this.color;
    },

    _iconFromId: function (id) {
        return IconMap[id];
    },

    _getDisplayUrl: function (url) {
        if (!url) {
            return '';
        }
        return url.replace(this.urlRegex, '');
    },

    _colorToModel: function (color) {
        return color ? Color.getNearest(color) : null;
    },

    _readBrowserExtensionSettings: function () {
        let settings;
        try {
            const protectedVal = this.entry.fields['KPRPC JSON'];
            const raw = protectedVal && protectedVal.getText();
            if (raw) {
                settings = new EntrySettingsModel(raw, { parse: true });
            }
        } catch (e) {
            logger.info('Browser extension entry settings missing or invalid. Will reset to defaults now.');
        }
        if (!settings) {
            settings = new EntrySettingsModel({});
            settings.set('mam', this.file.get('browserExtensionSettings').get('defaultMatchAccuracy'));
        }

        this.listenTo(settings, 'change', () => {
            this._entryModified();
            this.entry.fields['KPRPC JSON'] = kdbxweb.ProtectedValue.fromString(this.get('browserSettings').toJSON());
        });
        return settings;
    },

    _fieldsToModel: function (fields) {
        return _.omit(fields, this.builtInFields);
    },

    _attachmentsToModel: function (binaries) {
        const att = [];
        _.forEach(binaries, (data, title) => {
            if (data && data.ref) {
                data = data.value;
            }
            if (data) {
                att.push(AttachmentModel.fromAttachment({ data: data, title: title }));
            }
        }, this);
        return att;
    },

    _entryModified: function () {
        if (!this.unsaved) {
            this.unsaved = true;
            this.entry.pushHistory();
            this.file.setModified();
        }
        if (this.isJustCreated) {
            this.isJustCreated = false;
        }
        this.entry.times.update();
    },

    setSaved: function () {
        if (this.unsaved) {
            this.unsaved = false;
        }
        if (this.canBeDeleted) {
            this.canBeDeleted = false;
        }
    },

    matches: function (filter) {
        return !filter ||
            (!filter.tagLower || this.searchTags.indexOf(filter.tagLower) >= 0) &&
            (!filter.textLower || (filter.advanced ? this.matchesAdv(filter) : this.searchText.indexOf(filter.textLower) >= 0)) &&
            (!filter.color || filter.color === true && this.searchColor || this.searchColor === filter.color);
    },

    matchesAdv: function (filter) {
        const adv = filter.advanced;
        let search,
            comparer;
        if (adv.regex) {
            try {
                search = new RegExp(filter.text, adv.cs ? '' : 'i');
            } catch (e) { return false; }
            comparer = this.matchRegex;
        } else if (adv.cs) {
            search = filter.text;
            comparer = this.matchString;
        } else {
            search = filter.textLower;
            comparer = this.matchStringLower;
        }
        if (this.matchEntry(this.entry, adv, comparer, search)) {
            return true;
        }
        if (adv.history) {
            for (let i = 0, len = this.entry.history.length; i < len; i++) {
                if (this.matchEntry(this.entry.history[0], adv, comparer, search)) {
                    return true;
                }
            }
        }
        return false;
    },

    matchString: function (str, find) {
        if (str.isProtected) {
            return str.includes(find);
        }
        return str.indexOf(find) >= 0;
    },

    matchStringLower: function (str, findLower) {
        if (str.isProtected) {
            return str.includesLower(findLower);
        }
        return str.toLowerCase().indexOf(findLower) >= 0;
    },

    matchRegex: function (str, regex) {
        if (str.isProtected) {
            str = str.getText();
        }
        return regex.test(str);
    },

    matchEntry: function (entry, adv, compare, search) {
        const matchField = this.matchField;
        if (adv.user && matchField(entry, 'UserName', compare, search)) {
            return true;
        }
        if (adv.url && matchField(entry, 'URL', compare, search)) {
            return true;
        }
        if (adv.notes && matchField(entry, 'Notes', compare, search)) {
            return true;
        }
        if (adv.pass && matchField(entry, 'Password', compare, search)) {
            return true;
        }
        if (adv.title && matchField(entry, 'Title', compare, search)) {
            return true;
        }
        let matches = false;
        if (adv.other || adv.protect) {
            const builtInFields = this.builtInFields;
            const fieldNames = Object.keys(entry.fields);
            matches = fieldNames.some(field => {
                if (builtInFields.indexOf(field) >= 0) {
                    return false;
                }
                if (typeof entry.fields[field] === 'string') {
                    return adv.other && matchField(entry, field, compare, search);
                } else {
                    return adv.protect && matchField(entry, field, compare, search);
                }
            });
        }
        return matches;
    },

    matchField: function (entry, field, compare, search) {
        const val = entry.fields[field];
        return val ? compare(val, search) : false;
    },

    resolveFieldReferences: function () {
        this.hasFieldRefs = false;
        this.fieldRefFields.forEach(field => {
            const fieldValue = this[field];
            const refValue = this._resolveFieldReference(fieldValue);
            if (refValue !== undefined) {
                this[field] = refValue;
                this.hasFieldRefs = true;
            }
        });
    },

    getFieldValue: function (field) {
        field = field.toLowerCase();
        let resolvedField;
        Object.keys(this.entry.fields).some(entryField => {
            if (entryField.toLowerCase() === field) {
                resolvedField = entryField;
                return true;
            }
            return false;
        });
        if (resolvedField) {
            let fieldValue = this.entry.fields[resolvedField];
            const refValue = this._resolveFieldReference(fieldValue);
            if (refValue !== undefined) {
                fieldValue = refValue;
            }
            return fieldValue;
        }
    },

    _resolveFieldReference: function (fieldValue) {
        if (!fieldValue) {
            return;
        }
        if (fieldValue.isProtected && fieldValue.isFieldReference()) {
            fieldValue = fieldValue.getText();
        }
        if (typeof fieldValue !== 'string') {
            return;
        }
        const match = fieldValue.match(this.fieldRefRegex);
        if (!match) {
            return;
        }
        return this._getReferenceValue(match[1], match[2]);
    },

    _getReferenceValue: function (fieldRefId, idStr) {
        const id = new Uint8Array(16);
        for (let i = 0; i < 16; i++) {
            id[i] = parseInt(idStr.substr(i * 2, 2), 16);
        }
        const uuid = new kdbxweb.KdbxUuid(id);
        const entry = this.file.getEntry(this.file.subId(uuid.id));
        if (!entry) {
            return;
        }
        return entry.entry.fields[this.fieldRefIds[fieldRefId]];
    },

    setColor: function (color) {
        this._entryModified();
        this.entry.bgColor = Color.getKnownBgColor(color);
        this._fillByEntry();
    },

    setIcon: function (iconId) {
        this._entryModified();
        this.entry.icon = iconId;
        this.entry.customIcon = undefined;
        this._fillByEntry();
    },

    setCustomIcon: function (customIconId) {
        this._entryModified();
        this.entry.customIcon = new kdbxweb.KdbxUuid(customIconId);
        this._fillByEntry();
    },

    setExpires: function (dt) {
        this._entryModified();
        this.entry.times.expiryTime = dt instanceof Date ? dt : undefined;
        this.entry.times.expires = !!dt;
        this._fillByEntry();
    },

    setTags: function (tags) {
        this._entryModified();
        this.entry.tags = tags;
        this._fillByEntry();
    },

    renameTag: function (from, to) {
        const ix = _.findIndex(this.entry.tags, tag => tag.toLowerCase() === from.toLowerCase());
        if (ix < 0) {
            return;
        }
        this._entryModified();
        this.entry.tags.splice(ix, 1);
        if (to) {
            this.entry.tags.push(to);
        }
        this._fillByEntry();
    },

    setField: function (field, val, allowEmpty) {
        const hasValue = val && (typeof val === 'string' || val.isProtected && val.byteLength);
        if (hasValue || allowEmpty || this.builtInFields.indexOf(field) >= 0) {
            this._entryModified();
            val = this.sanitizeFieldValue(val);
            this.entry.fields[field] = val;
        } else if (this.entry.fields.hasOwnProperty(field)) {
            this._entryModified();
            delete this.entry.fields[field];
        }
        this._fillByEntry();
    },

    sanitizeFieldValue: function (val) {
        if (val && !val.isProtected && val.indexOf('\x1A') >= 0) {
            // eslint-disable-next-line no-control-regex
            const invalidCharsRegex = /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;
            // https://github.com/keeweb/keeweb/issues/910
            val = val.replace(invalidCharsRegex, '');
        }
        return val;
    },

    hasField: function (field) {
        return this.entry.fields.hasOwnProperty(field);
    },

    addAttachment: function (name, data) {
        this._entryModified();
        return this.file.db.createBinary(data).then(binaryRef => {
            this.entry.binaries[name] = binaryRef;
            this._fillByEntry();
        });
    },

    removeAttachment: function (name) {
        this._entryModified();
        delete this.entry.binaries[name];
        this._fillByEntry();
    },

    getHistory: function () {
        const history = this.entry.history.map(function (rec) {
            return EntryModel.fromEntry(rec, this.group, this.file);
        }, this);
        history.push(this);
        history.sort((x, y) => x.updated - y.updated);
        return history;
    },

    deleteHistory: function (historyEntry) {
        const ix = this.entry.history.indexOf(historyEntry);
        if (ix >= 0) {
            this.entry.removeHistory(ix);
            this.file.setModified();
        }
        this._fillByEntry();
    },

    revertToHistoryState: function (historyEntry) {
        const ix = this.entry.history.indexOf(historyEntry);
        if (ix < 0) {
            return;
        }
        this.entry.pushHistory();
        this.unsaved = true;
        this.file.setModified();
        this.entry.fields = {};
        this.entry.binaries = {};
        this.entry.copyFrom(historyEntry);
        this._entryModified();
        this._fillByEntry();
        this.set('browserSettings', this._readBrowserExtensionSettings());
    },

    discardUnsaved: function () {
        if (this.unsaved && this.entry.history.length) {
            this.unsaved = false;
            const historyEntry = this.entry.history[this.entry.history.length - 1];
            this.entry.removeHistory(this.entry.history.length - 1);
            this.entry.fields = {};
            this.entry.binaries = {};
            this.entry.copyFrom(historyEntry);
            this._fillByEntry();
        }
    },

    moveToTrash: function () {
        this.file.setModified();
        if (this.isJustCreated) {
            this.isJustCreated = false;
        }
        this.file.db.remove(this.entry);
        this.file.reload();
    },

    deleteFromTrash: function () {
        this.file.setModified();
        this.file.db.move(this.entry, null);
        this.file.reload();
    },

    removeWithoutHistory: function () {
        if (this.canBeDeleted) {
            const ix = this.group.group.entries.indexOf(this.entry);
            if (ix >= 0) {
                this.group.group.entries.splice(ix, 1);
            }
            this.file.reload();
        }
    },

    moveToFile: function (file) {
        if (this.canBeDeleted) {
            this.removeWithoutHistory();
            this.group = file.get('groups').first();
            this.file = file;
            this._fillByEntry();
            this.entry.times.update();
            this.group.group.entries.push(this.entry);
            this.group.addEntry(this);
            this.isJustCreated = true;
            this.unsaved = true;
            this.file.setModified();
        }
    },

    initOtpGenerator: function () {
        let otpUrl;
        if (this.fields.otp) {
            otpUrl = this.fields.otp;
            if (otpUrl.isProtected) {
                otpUrl = otpUrl.getText();
            }
            if (Otp.isSecret(otpUrl.replace(/\s/g, ''))) {
                otpUrl = Otp.makeUrl(otpUrl.replace(/\s/g, '').toUpperCase());
            } else if (otpUrl.toLowerCase().lastIndexOf('otpauth:', 0) !== 0) {
                // KeeOTP plugin format
                const args = {};
                otpUrl.split('&').forEach(part => {
                    const parts = part.split('=', 2);
                    args[parts[0]] = decodeURIComponent(parts[1]).replace(/=/g, '');
                });
                if (args.key) {
                    otpUrl = Otp.makeUrl(args.key, args.step, args.size);
                }
            }
        } else if (this.entry.fields['TOTP Seed']) {
            // TrayTOTP plugin format
            let secret = this.entry.fields['TOTP Seed'];
            if (secret.isProtected) {
                secret = secret.getText();
            }
            if (secret) {
                let settings = this.entry.fields['TOTP Settings'];
                if (settings && settings.isProtected) {
                    settings = settings.getText();
                }
                let period,
                    digits;
                if (settings) {
                    settings = settings.split(';');
                    if (settings.length > 0 && settings[0] > 0) {
                        period = settings[0];
                    }
                    if (settings.length > 1 && settings[1] > 0) {
                        digits = settings[1];
                    }
                }
                otpUrl = Otp.makeUrl(secret, period, digits);
                this.fields.otp = kdbxweb.ProtectedValue.fromString(otpUrl);
            }
        }
        if (otpUrl) {
            if (this.otpGenerator && this.otpGenerator.url === otpUrl) {
                return;
            }
            try {
                this.otpGenerator = Otp.parseUrl(otpUrl);
            } catch (e) {
                this.otpGenerator = null;
            }
        } else {
            this.otpGenerator = null;
        }
    },

    setOtp: function (otp) {
        this.otpGenerator = otp;
        this.setOtpUrl(otp.url);
    },

    setOtpUrl: function (url) {
        this.setField('otp', url ? kdbxweb.ProtectedValue.fromString(url) : undefined);
        delete this.entry.fields['TOTP Seed'];
        delete this.entry.fields['TOTP Settings'];
    },

    getGroupPath: function () {
        let group = this.group;
        const groupPath = [];
        while (group) {
            groupPath.unshift(group.get('title'));
            group = group.parentGroup;
        }
        return groupPath;
    },

    cloneEntry: function (nameSuffix) {
        const newEntry = EntryModel.newEntry(this.group, this.file);
        const uuid = newEntry.entry.uuid;
        newEntry.entry.copyFrom(this.entry);
        newEntry.entry.uuid = uuid;
        newEntry.entry.times.update();
        newEntry.entry.times.creationTime = newEntry.entry.times.lastModTime;
        newEntry.entry.fields.Title = this.title + nameSuffix;
        newEntry._fillByEntry();
        this.file.reload();
        return newEntry;
    },

    copyFromTemplate: function (templateEntry) {
        const uuid = this.entry.uuid;
        this.entry.copyFrom(templateEntry.entry);
        this.entry.uuid = uuid;
        this.entry.times.update();
        this.entry.times.creationTime = this.entry.times.lastModTime;
        this.entry.fields.Title = '';
        this._fillByEntry();
    },

    browserFieldAt: function (index) {
        const collection = this.get('browserSettings').get('formFieldList');
        const ffModel = collection.at(index);
        return ffModel;
    }
});

EntryModel.fromEntry = function (entry, group, file) {
    const model = new EntryModel();
    model.setEntry(entry, group, file);
    return model;
};

EntryModel.newEntry = function (group, file, opts) {
    const model = new EntryModel();
    const entry = file.db.createEntry(group.group);
    if (opts && opts.tag) {
        entry.tags = [opts.tag];
    }
    model.setEntry(entry, group, file);
    model.entry.times.update();
    model.unsaved = true;
    model.isJustCreated = true;
    model.canBeDeleted = true;
    group.addEntry(model);
    file.setModified();

    // KeeWeb doesn't do this. May be an upstream bug or I've just not understood
    // all the entry mapping stuff. By omitting this the entryMap does not get
    // updated, which can lead to entries not being found and placeholders not
    // being correctly resolved. We then have to set the justCreated flag to
    // ensure that the title field is focussed upon creation as before.
    // Potentially could remove the earlier similar line but I don't know what
    // Backbone magic happens in between so won't risk it.
    file.reload();
    model.isJustCreated = true;

    return model;
};

module.exports = EntryModel;
