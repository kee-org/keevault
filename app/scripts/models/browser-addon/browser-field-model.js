const Backbone = require('backbone');

const BrowserFieldModel = Backbone.Model.extend({
    defaults: {
        page: -1,
        placeholderHandling: 'Default'
    }
});

module.exports = BrowserFieldModel;
