const Backbone = require('backbone');
const URLMatchDomainModel = require('../../models/browser-addon/url-match-domain-model');

const URLMatchDomainCollection = Backbone.Collection.extend({
    model: URLMatchDomainModel
});

module.exports = URLMatchDomainCollection;
