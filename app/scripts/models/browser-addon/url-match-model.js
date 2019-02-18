const Backbone = require('backbone');

const URLMatchModel = Backbone.Model.extend({
    defaults: {
        url: '',
        regex: false
    },

    validate: function(attrs, options) {
        const newURL = attrs.url && attrs.url.trim();
        if (!newURL) {
            return 'No URL / pattern supplied';
        }
        if (attrs.regex) {
            try {
                new RegExp(newURL); //eslint-disable-line
            } catch (e) {
                return 'Pattern is not a valid regular expression.';
            }
        }
        if (this.collection) {
            if (this.collection.any(model => model.cid !== this.cid && model.get('url') === newURL)) {
                return 'Duplicate URL/pattern';
            }
        }
    }
});

module.exports = URLMatchModel;
