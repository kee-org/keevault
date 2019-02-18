const Backbone = require('backbone');

const URLMatchDomainModel = Backbone.Model.extend({
    defaults: {
        domain: '',
        method: ''
    }
});

module.exports = URLMatchDomainModel;
