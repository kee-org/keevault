const Backbone = require('backbone');
const Backgrid = require('backgrid');
const GridAddRowView = require('./grid-add-row-view');

const GridView = Backbone.View.extend({
    events: {
        'change .primaryAttribute': 'addIfValid'
    },

    initialize: function(options) {
        this.newRowConfig = options.newRowConfig;
        this.collection = options.collection;
        this.columns = options.columns;
        this.newRowConfig = options.newRowConfig;
    },

    render: function() {
        const ActionCell = Backgrid.Cell.extend({
            events: {
                'click button': 'deleteRow'
            },
            deleteRow: function(e) {
                e.preventDefault();
                this.model.destroy();
            },
            render: function () {
                this.$el.html('<button>x</button>');
                return this;
            }
        });

        const addFooter = Backgrid.Footer.extend({
            initialize: function(options) {
                Backgrid.Footer.prototype.initialize.call(this, options);
                this.options = options;
            },

            render: function() {
                Backgrid.Footer.prototype.render.call(this);
                this.$el.append(new GridAddRowView(this.options.newRowConfig).render().el);
                return this;
            }
        });

        const columns = this.columns;
        columns.push({
            name: '',
            label: '',
            cell: ActionCell,
            sortable: false
        });

        // Initialize a new Grid instance
        const grid = new Backgrid.Grid({
            columns: columns,
            collection: this.collection,
            footer: addFooter,
            newRowConfig: this.newRowConfig
        });

        this.$el.append(grid.render().el);
        return this;
    }
});

module.exports = GridView;
