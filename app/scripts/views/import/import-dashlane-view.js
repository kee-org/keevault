const Backbone = require('backbone');
const KdbxImport = require('kdbx-import').KdbxImport;
const Alerts = require('../../comp/alerts');
const Locale = require('../../util/locale');

const ImportDashlaneView = Backbone.View.extend({
    template: require('templates/import/dashlane.hbs'),

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
        if (file && file.name && file.name.endsWith('json')) this.processFile(file);
    },

    process: async function(json) {
        const startTime = Date.now();
        const importResult = await KdbxImport.fromDashlane(this.model.files.first().db.meta, json);
        const error = this.model.files.first().importFromKdbx(importResult.db);
        const time = Date.now() - startTime;

        if (error) {
            window.trackMatomoAction(['trackEvent', 'Import', 'Error', 'dashlane', time]);
            return error;
        }
        window.trackMatomoAction(['trackEvent', 'Import', 'Success', 'dashlane', time]);
    },

    processFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = async e => {
            const error = await this.process(e.target.result);
            if (error) {
                Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileDashlane });
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
        const file = _.find(files, file => file.name.split('.').pop().toLowerCase() === 'json');
        if (file) {
            this.processFile(file);
        } else {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileDashlane });
        }
    }
});

module.exports = ImportDashlaneView;
