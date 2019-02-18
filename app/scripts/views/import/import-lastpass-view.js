const Backbone = require('backbone');
const papaparse = require('papaparse');
const Alerts = require('../../comp/alerts');
const Locale = require('../../util/locale');

const ImportLastPassView = Backbone.View.extend({
    template: require('templates/import/lastpass.hbs'),

    events: {
        'change .import__file-ctrl': 'fileSelected',
        'click .import__icon-import': 'fileChooser',
        'dragover': 'dragover',
        'dragleave': 'dragleave',
        'drop': 'drop'
    },

    render() {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        this.renderTemplate();
        return this;
    },

    fileChooser: function(e) {
        this.fileData = null;
        const fileInput = this.$el.find('.import__file-ctrl').attr('accept', 'csv').val(null);
        fileInput.click();
    },

    fileSelected: function(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    },

    processCSV: async function(csv) {
        const {data, errors, meta} = papaparse.parse(csv, {header: true, skipEmptyLines: true});
        if (!data || data.length < 1) return 'error';
        if (errors && errors.length >= 1) return 'error';
        if (meta && meta.fields < 5) return 'error';

        const error = await this.model.files.first().importFromDataRows(data, {
            'Notes': 'extra',
            'Title': 'name',
            'Password': 'password',
            'URL': 'url',
            'UserName': 'username'
        });

        if (error) {
            return error;
        } else {
            Backbone.trigger('show-entries');
        }
    },

    processFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = async e => {
            const error = await this.processCSV(e.target.result);
            if (error) {
                Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileCSV });
            } else {
                Backbone.trigger('show-entries');
            }
        };
        reader.onerror = () => {
            Alerts.error({ header: Locale.openFailedRead });
        };
        reader.readAsText(file);
    },

    processText: async function(text) {
        const error = await this.processCSV(text);
        if (error) {
            Alerts.error({ header: Locale.openWrongText, body: Locale.openWrongTextCSV });
        } else {
            Backbone.trigger('show-entries');
        }
    },

    dragover: function(e) {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.originalEvent.dataTransfer;
        dt.dropEffect = 'copy';
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        if (!this.$el.hasClass('import--drag')) {
            this.$el.addClass('import--drag');
        }
    },

    dragleave: function() {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        this.dragTimeout = setTimeout(() => {
            this.$el.removeClass('import--drag');
        }, 100);
    },

    drop: function(e) {
        e.preventDefault();
        if (this.busy) {
            return;
        }
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        this.$el.removeClass('import--drag');
        const text = e.originalEvent.dataTransfer.getData('Text');
        if (text) {
            this.processText(text);
        } else {
            const files = e.target.files || e.originalEvent.dataTransfer.files;
            const csvFile = _.find(files, file => file.name.split('.').pop().toLowerCase() === 'csv');
            if (csvFile) {
                this.processFile(csvFile);
            } else {
                Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileCSV });
            }
        }
    }
});

module.exports = ImportLastPassView;
