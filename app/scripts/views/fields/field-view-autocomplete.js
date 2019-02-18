const FieldViewBrowser = require('./field-view-browser');
const Keys = require('../../const/keys');

const FieldViewAutocomplete = FieldViewBrowser.extend({
    endEdit: function(newVal, extra) {
        if (this.autocomplete) {
            this.autocomplete.remove();
            this.autocomplete = null;
        }
        delete this.selectedCompletionIx;
        FieldViewBrowser.prototype.endEdit.call(this, newVal, extra);
    },

    startEdit: function() {
        FieldViewBrowser.prototype.startEdit.call(this);
        const fieldRect = this.input[0].getBoundingClientRect();
        this.autocomplete = $('<div class="details__field-autocomplete"></div>').appendTo('body');
        this.autocomplete.css({
            top: fieldRect.bottom,
            left: fieldRect.left,
            width: fieldRect.width - 2
        });
        delete this.selectedCompletionIx;
        this.autocomplete.mousedown(this.autocompleteClick.bind(this));
        if (this.input.val()) {
            this.autocomplete.hide();
        } else {
            this.updateAutocomplete();
        }
    },

    fieldValueInput: function(e) {
        e.stopPropagation();
        this.updateAutocomplete();
        FieldViewBrowser.prototype.fieldValueInput.call(this, e);
    },

    fieldValueKeydown: function(e) {
        switch (e.which) {
            case Keys.DOM_VK_UP:
                this.moveAutocomplete(false);
                e.preventDefault();
                break;
            case Keys.DOM_VK_DOWN:
                this.moveAutocomplete(true);
                e.preventDefault();
                break;
            case Keys.DOM_VK_RETURN:
                const selectedItem = this.autocomplete.find('.details__field-autocomplete-item--selected').text();
                if (selectedItem) {
                    this.input.val(selectedItem);
                    this.closeEditor(selectedItem);
                }
                break;
            default:
                delete this.selectedCompletionIx;
        }
        FieldViewBrowser.prototype.fieldValueKeydown.call(this, e);
    },

    moveAutocomplete: function(next) {
        const completions = this.model.getCompletions(this.input.val());
        if (typeof this.selectedCompletionIx === 'number') {
            this.selectedCompletionIx = (completions.length + this.selectedCompletionIx + (next ? 1 : -1)) % completions.length;
        } else {
            this.selectedCompletionIx = next ? 0 : completions.length - 1;
        }
        this.updateAutocomplete();
    },

    updateAutocomplete: function() {
        const completions = this.model.getCompletions(this.input.val());
        const completionsHtml = completions.map((item, ix) => {
            const sel = ix === this.selectedCompletionIx ? 'details__field-autocomplete-item--selected' : '';
            return '<div class="details__field-autocomplete-item ' + sel + '">' + _.escape(item) + '</div>';
        }).join('');
        this.autocomplete.html(completionsHtml);
        this.autocomplete.toggle(!!completionsHtml);
        const height = $('.details__field-autocomplete').height();
        $('.details__field-value-autocomplete-space').height(height);
    },

    autocompleteClick: function(e) {
        e.stopPropagation();
        if (e.target.classList.contains('details__field-autocomplete-item')) {
            const selectedItem = $(e.target).text();
            this.input.val(selectedItem);
            this.closeEditor(selectedItem);
        } else {
            this.afterPaint(function () { this.input.focus(); });
        }
    }
});

module.exports = FieldViewAutocomplete;
