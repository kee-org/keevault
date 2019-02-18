const Backbone = require('backbone');
const BrowserFieldModel = require('../../models/browser-addon/browser-field-model');

const BrowserFieldCollection = Backbone.Collection.extend({
    model: BrowserFieldModel
});

module.exports = BrowserFieldCollection;
