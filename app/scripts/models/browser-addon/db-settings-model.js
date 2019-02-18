const Backbone = require('backbone');
const MatchedURLAccuracyOverrides = require('../../collections/browser-addon/url-match-domain-collection');
const Hex = require('../../util/hex');

const DBSettingsModel = Backbone.Model.extend({

    // Adding new properties to the same version is fine for other KPRPC implementations
    // using Jayrock.Json.Conversion.JsonConvert.Import because they just ignore
    // unexpected properties. They would be deleted by the .plgx plugin but as long as
    // the new properties have sensible defaults in Kee Vault, we don't need to support
    // round-trips.
    defaults: {
        version: 3,
        defaultMatchAccuracy: 'Domain',
        defaultPlaceholderHandling: 'Disabled',
        matchedURLAccuracyOverrides: new MatchedURLAccuracyOverrides(null),
        displayPriorityField: false,
        displayGlobalPlaceholderOption: false
    },

    initialize: function(model, options) {
        this.listenTo(this.get('matchedURLAccuracyOverrides'), 'change', (obj) => {
            this.trigger('change');
        });
        this.listenTo(this.get('matchedURLAccuracyOverrides'), 'remove', (obj) => {
            this.trigger('change');
        });
        this.listenTo(this.get('matchedURLAccuracyOverrides'), 'add', (obj) => {
            this.trigger('change');
        });
    },

    // To retain backwards compatibility with other KeePassRPC clients we
    // transform the persisted representations of the UUID and URL overrides array
    parse: function (json) {
        const obj = JSON.parse(json);
        const arr = [];
        for (const domain in obj.matchedURLAccuracyOverrides) {
            if (obj.matchedURLAccuracyOverrides.hasOwnProperty(domain)) {
                const method = obj.matchedURLAccuracyOverrides[domain];
                arr.push({domain, method});
            }
        }
        obj.matchedURLAccuracyOverrides = new MatchedURLAccuracyOverrides(arr.length > 0 ? arr : null);
        obj.rootUUID = Hex.hex2base64(obj.rootUUID);
        return obj;
    },

    toJSON: function() {
        const attrs = _.clone(this.attributes);
        attrs.rootUUID = Hex.base642hex(attrs.rootUUID);
        attrs.matchedURLAccuracyOverrides = {};
        for (const overrideModel of this.attributes.matchedURLAccuracyOverrides.toArray()) {
            attrs.matchedURLAccuracyOverrides[overrideModel.get('domain')] = overrideModel.get('method');
        }
        return JSON.stringify(attrs);
    }
});

module.exports = DBSettingsModel;
