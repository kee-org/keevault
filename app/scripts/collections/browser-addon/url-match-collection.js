const Backbone = require('backbone');
const URLMatchModel = require('../../models/browser-addon/url-match-model');

const URLMatchCollection = Backbone.Collection.extend({
    model: URLMatchModel
});

module.exports = URLMatchCollection;
