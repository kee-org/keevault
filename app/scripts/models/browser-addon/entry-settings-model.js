const Backbone = require('backbone');
const URLMatchCollection = require('../../collections/browser-addon/url-match-collection');
const FormFieldCollection = require('../../collections/browser-addon/form-field-collection');

const EntrySettingsModel = Backbone.Model.extend({

    defaults: function() {
        return {
            version: 1,
            behaviour: 'Default',
            priority: 0,
            hide: false,
            wl: new URLMatchCollection(null),
            bl: new URLMatchCollection(null),
            formFieldList: new FormFieldCollection(null)
        };
    },

    initialize: function(model, options) {
        this.listenTo(this.get('wl'), 'change', this.triggerChange);
        this.listenTo(this.get('wl'), 'backgrid:edited', this.triggerChange);
        this.listenTo(this.get('wl'), 'remove', this.triggerChange);
        this.listenTo(this.get('wl'), 'add', this.triggerChange);
        this.listenTo(this.get('bl'), 'change', this.triggerChange);
        this.listenTo(this.get('bl'), 'backgrid:edited', this.triggerChange);
        this.listenTo(this.get('bl'), 'remove', this.triggerChange);
        this.listenTo(this.get('bl'), 'add', this.triggerChange);
        this.listenTo(this.get('formFieldList'), 'change', this.triggerChange);
        this.listenTo(this.get('formFieldList'), 'remove', this.triggerChange);
        this.listenTo(this.get('formFieldList'), 'add', this.triggerChange);
    },

    triggerChange: function () {
        this.trigger('change');
    },

    // To retain compatibility with other KeePassRPC clients and servers we
    // transform the persisted representations of some data
    parse: function (json) {
        const obj = JSON.parse(json);

        const wl = [];
        const bl = [];
        if (obj.altURLs) obj.altURLs.forEach(url => wl.push({url, regex: false}));
        if (obj.regExURLs) obj.regExURLs.forEach(url => wl.push({url, regex: true}));
        if (obj.blockedURLs) obj.blockedURLs.forEach(url => bl.push({url, regex: false}));
        if (obj.regExBlockedURLs) obj.regExBlockedURLs.forEach(url => bl.push({url, regex: true}));
        obj.wl = new URLMatchCollection(wl.length > 0 ? wl : null);
        obj.bl = new URLMatchCollection(bl.length > 0 ? bl : null);

        // Backbone does MAGIC with properties called id so we have to map to an alternative
        obj.formFieldList = new FormFieldCollection(
            obj.formFieldList &&
            obj.formFieldList.length > 0
                ? obj.formFieldList.map(ff => { ff.fieldId = ff.id; delete ff.id; return ff; })
                : null);

        obj.mam = this.getMAM(obj);
        obj.behaviour = this.getBehaviour(obj);

        delete obj.altURLs;
        delete obj.blockedURLs;
        delete obj.regExURLs;
        delete obj.regExBlockedURLs;
        delete obj.alwaysAutoFill;
        delete obj.neverAutoFill;
        delete obj.alwaysAutoSubmit;
        delete obj.neverAutoSubmit;
        delete obj.blockHostnameOnlyMatch;
        delete obj.blockDomainOnlyMatch;
        return obj;
    },

    toJSON: function() {
        const attrs = _.clone(this.attributes);

        attrs.altURLs = [];
        attrs.regExURLs = [];
        attrs.blockedURLs = [];
        attrs.regExBlockedURLs = [];
        attrs.wl.toArray().forEach(wl => {
            if (wl.get('regex')) attrs.regExURLs.push(wl.get('url'));
            else attrs.altURLs.push(wl.get('url'));
        });
        attrs.bl.toArray().forEach(bl => {
            if (bl.get('regex')) attrs.regExBlockedURLs.push(bl.get('url'));
            else attrs.blockedURLs.push(bl.get('url'));
        });
        delete attrs.wl;
        delete attrs.bl;

        attrs.formFieldList = attrs.formFieldList.toArray()
            .map(ff => {
                const listItem = _.clone(ff.attributes);
                listItem.id = listItem.fieldId || '';
                delete listItem.fieldId;
                return listItem;
            });
        this.parseBehaviour(attrs);
        this.parseMAM(attrs);

        return JSON.stringify(attrs);
    },

    getBehaviour: function(obj) {
        if (obj.neverAutoFill) {
            return 'NeverAutoFillNeverAutoSubmit';
        } else if (obj.alwaysAutoSubmit) {
            return 'AlwaysAutoFillAlwaysAutoSubmit';
        } else if (obj.alwaysAutoFill && obj.neverAutoSubmit) {
            return 'AlwaysAutoFillNeverAutoSubmit';
        } else if (obj.neverAutoSubmit) {
            return 'NeverAutoSubmit';
        } else if (obj.alwaysAutoFill) {
            return 'AlwaysAutoFill';
        } else {
            return 'Default';
        }
    },

    getMAM: function (obj) {
        if (obj.blockHostnameOnlyMatch) return 'Exact';
        else if (obj.blockDomainOnlyMatch) return 'Hostname';
        else return 'Domain';
    },

    parseBehaviour: function (attrs) {
        switch (attrs.behaviour) {
            case 'AlwaysAutoFill':
                attrs.alwaysAutoFill = true;
                attrs.alwaysAutoSubmit = false;
                attrs.neverAutoFill = false;
                attrs.neverAutoSubmit = false;
                break;
            case 'NeverAutoSubmit':
                attrs.alwaysAutoFill = false;
                attrs.alwaysAutoSubmit = false;
                attrs.neverAutoFill = false;
                attrs.neverAutoSubmit = true;
                break;
            case 'AlwaysAutoFillAlwaysAutoSubmit':
                attrs.alwaysAutoFill = true;
                attrs.alwaysAutoSubmit = true;
                attrs.neverAutoFill = false;
                attrs.neverAutoSubmit = false;
                break;
            case 'NeverAutoFillNeverAutoSubmit':
                attrs.alwaysAutoFill = false;
                attrs.alwaysAutoSubmit = false;
                attrs.neverAutoFill = true;
                attrs.neverAutoSubmit = true;
                break;
            case 'AlwaysAutoFillNeverAutoSubmit':
                attrs.alwaysAutoFill = true;
                attrs.alwaysAutoSubmit = false;
                attrs.neverAutoFill = false;
                attrs.neverAutoSubmit = true;
                break;
            case 'Default':
                attrs.alwaysAutoFill = false;
                attrs.alwaysAutoSubmit = false;
                attrs.neverAutoFill = false;
                attrs.neverAutoSubmit = false;
                break;
        }
        delete attrs.behaviour;
    },

    parseMAM: function (attrs) {
        if (attrs.mam === 'Domain') {
            attrs.blockDomainOnlyMatch = false;
            attrs.blockHostnameOnlyMatch = false;
        } else if (attrs.mam === 'Hostname') {
            attrs.blockDomainOnlyMatch = true;
            attrs.blockHostnameOnlyMatch = false;
        } else {
            attrs.blockDomainOnlyMatch = false;
            attrs.blockHostnameOnlyMatch = true;
        }
        delete attrs.mam;
    }
});

module.exports = EntrySettingsModel;
