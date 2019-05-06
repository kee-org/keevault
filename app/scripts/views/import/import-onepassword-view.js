const Backbone = require('backbone');
const KdbxImport = require('kdbx-import').KdbxImport;
const Alerts = require('../../comp/alerts');
const Locale = require('../../util/locale');

const ImportOnePasswordView = Backbone.View.extend({
    template: require('templates/import/onepassword.hbs'),

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
        if (file && file.name) {
            if (file.name.endsWith('1pif')) this.processPIFFile(file);
            else if (file.name.endsWith('csv')) this.processCSVFile(file);
        }
    },

    processCSV: async function(csv) {
        const startTime = Date.now();
        const importResult = await KdbxImport.fromOnePasswordCSV(this.model.files.first().db.meta, csv);
        const error = this.model.files.first().importFromKdbx(importResult.db);
        const time = Date.now() - startTime;

        if (error) {
            window.trackMatomoAction(['trackEvent', 'Import', 'Error', 'onePasswordCSV', time]);
            return error;
        }
        window.trackMatomoAction(['trackEvent', 'Import', 'Success', 'onePasswordCSV', time]);
    },

    processPIF: async function(pif) {
        const startTime = Date.now();
        const importResult = await KdbxImport.fromOnePasswordPIF(this.model.files.first().db.meta, pif);
        const error = this.model.files.first().importFromKdbx(importResult.db);
        const time = Date.now() - startTime;

        if (error) {
            window.trackMatomoAction(['trackEvent', 'Import', 'Error', 'onePasswordPIF', time]);
            return error;
        }
        window.trackMatomoAction(['trackEvent', 'Import', 'Success', 'onePasswordPIF', time]);
    },

    processCSVFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = async e => {
            const error = await this.processCSV(e.target.result);
            if (error) {
                Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileOnePassword });
            } else {
                Backbone.trigger('show-entries');
            }
        };
        reader.onerror = () => {
            Alerts.error({ header: Locale.openFailedRead });
        };
        reader.readAsText(file);
    },

    processPIFFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = async e => {
            const error = await this.processPIF(e.target.result);
            if (error) {
                Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileOnePassword });
            } else {
                Backbone.trigger('show-entries');
            }
        };
        reader.onerror = () => {
            Alerts.error({ header: Locale.openFailedRead });
        };
        reader.readAsText(file);
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
        const files = e.target.files || e.originalEvent.dataTransfer.files;
        const csvFile = _.find(files, file => file.name.split('.').pop().toLowerCase() === 'csv');
        const pifFile = _.find(files, file => file.name.split('.').pop().toLowerCase() === '1pif');
        if (csvFile) {
            this.processCSVFile(csvFile);
        } else if (pifFile) {
            this.processPIFFile(pifFile);
        } else {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileOnePassword });
        }
    }
});

module.exports = ImportOnePasswordView;
