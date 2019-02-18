const Backbone = require('backbone');
const InputFx = require('../util/input-fx');

const GridAddRowView = Backbone.View.extend({
    events: {
        'change .primaryAttribute': 'addIfValid'
    },

    initialize: function(options) {
        this.placeholder = options.placeholder;
        this.validate = options.validate;
        this.addItem = options.addItem;
    },

    render: function() {
        this.$el.html(`<input type="text" placeholder="${this.placeholder}" class="primaryAttribute" />`);
        return this;
    },

    addIfValid: function() {
        const primaryAttributeField = this.$el.find('.primaryAttribute');
        let text = primaryAttributeField.val();
        if (text) text = text.trim();
        if (text) {
            if (this.validate(text)) {
                this.addItem(text);
                primaryAttributeField.val('');
                primaryAttributeField.toggleClass('input--error', false);
                return;
            }
        }
        primaryAttributeField.toggleClass('input--error', true);
        InputFx.shake(primaryAttributeField);
    }
});

module.exports = GridAddRowView;
