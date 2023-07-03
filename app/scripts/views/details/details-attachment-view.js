const Backbone = require('backbone');
const FeatureDetector = require('../../util/feature-detector');

const DetailsAttachmentView = Backbone.View.extend({
    template: require('templates/details/details-attachment.hbs'),

    events: {
        'click .details__attachment-preview-download-btn': 'downloadAttachment'
    },

    render: function(complete) {
        this.renderTemplate({ isMobile: FeatureDetector.isMobile}, true);
        const shortcut = this.$el.find('.details__attachment-preview-download-text-shortcut');
        shortcut.text(FeatureDetector.actionShortcutSymbol());
        const blob = new Blob([this.model.getBinary()], {type: this.model.mimeType});
        const dataEl = this.$el.find('.details__attachment-preview-data');
        switch ((this.model.mimeType || '').split('/')[0]) {
            case 'text':
                const reader = new FileReader();
                reader.addEventListener('loadend', () => {
                    $('<pre/>').text(reader.result).appendTo(dataEl);
                    complete();
                });
                reader.readAsText(blob);
                return this;
            case 'image':
                $('<img/>').attr('src', URL.createObjectURL(blob)).appendTo(dataEl);
                complete();
                return this;
        }
        this.$el.addClass('details__attachment-preview--empty');
        this.$el.find('.details__attachment-preview-icon').addClass('fa-' + this.model.icon);
        complete();
        return this;
    },

    downloadAttachment: function() {
        this.trigger('download');
    }
});

module.exports = DetailsAttachmentView;
