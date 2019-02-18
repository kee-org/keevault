const Backbone = require('backbone');

const ImportNoneView = Backbone.View.extend({
    template: require('templates/import/none.hbs'),

    events: {
        'click #vault_import_skip': 'skip'
    },

    render: function () {
        this.renderTemplate({firstRun: this.model.firstRun});
        return this;
    },

    skip: function (e) {
        Backbone.trigger('show-entries');
        if (!this.model.firstRun) {
            Backbone.trigger('show-file-settings', { cid: this.model.files.first().cid });
        }
    }
});

module.exports = ImportNoneView;
