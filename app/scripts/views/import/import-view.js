const Backbone = require('backbone');
const Scrollable = require('../../mixins/scrollable');
const InputFx = require('../../util/input-fx');

const ImportView = Backbone.View.extend({
    template: require('templates/import/import.hbs'),

    views: null,

    events: {
        'click .vault_import_choice': 'onSourceClick'
    },

    initialize: function () {
        this.listenTo(Backbone, 'import-source', this.setImportSource);
        this.views = { };
    },

    remove: function() {
        Backbone.View.prototype.remove.call(this);
    },

    render: function () {
        this.renderTemplate({firstRun: this.model.firstRun});
        this.importSourceEl = this.$el.find('.scroller');
        this.setImportSource({importSource: 'none'});
        return this;
    },

    setImportSource: function (e) {
        const ImportSourceView = require('./import-' + e.importSource + '-view');
        if (this.views.importSource) {
            if (this.views.importSource instanceof ImportSourceView) {
                return;
            }
            this.views.importSource.remove();
        }
        this.views.importSource = new ImportSourceView({ el: this.importSourceEl, model: this.model });
        this.views.importSource.appModel = this.model;
        this.views.importSource.render();
        this.importSource = e.importSource;
    },

    onSourceClick: function (e) {
        e.stopPropagation();
        if (!e.currentTarget.classList.contains('active')) {
            $('.vault_import_choice').removeClass('active');
            e.currentTarget.classList.add('active');
            this.setImportSource({importSource: e.currentTarget.dataset.importSource});
        } else if (e.currentTarget.dataset.importSource === 'none') {
            InputFx.shake($('#vault_import_skip'));
        } else if (e.currentTarget.dataset.importSource === 'keepass' ||
        e.currentTarget.dataset.importSource === 'lastpass' ||
        e.currentTarget.dataset.importSource === 'other') {
            InputFx.shake($('.import_source .import__icon.import__icon-import'));
        }
    }
});

_.extend(ImportView.prototype, Scrollable);

module.exports = ImportView;
