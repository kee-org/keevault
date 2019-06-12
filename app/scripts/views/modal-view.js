const Backbone = require('backbone');
const Keys = require('../const/keys');
const KeyHandler = require('../comp/key-handler');

const ModalView = Backbone.View.extend({
    el: 'body',

    template: require('templates/modal.hbs'),

    events: {
        'click .modal__buttons button,button.vault_action': 'buttonClick',
        'click': 'bodyClick'
    },

    initialize: function () {
        if (typeof this.model.esc === 'string') {
            KeyHandler.onKey(Keys.DOM_VK_ESCAPE, this.escPressed, this, false, true);
        }
        if (typeof this.model.enter === 'string') {
            KeyHandler.onKey(Keys.DOM_VK_RETURN, this.enterPressed, this, false, true);
        }
        KeyHandler.setModal('alert');

        if (typeof this.model.template === 'string') {
            this.template = require('templates/' + this.model.template + '.hbs');
        }
    },

    remove: function() {
        KeyHandler.offKey(Keys.DOM_VK_ESCAPE, this.escPressed, this);
        KeyHandler.offKey(Keys.DOM_VK_RETURN, this.enterPressed, this);
        KeyHandler.setModal(null);
        if (this.model.view) {
            this.model.view.remove();
        }
        Backbone.View.prototype.remove.apply(this, arguments);
    },

    render: function () {
        const parent = this.$el;
        this.setElement($(this.template(this.model)));
        parent.append(this.$el);
        const el = this.$el;
        el.addClass('modal--hidden');
        setTimeout(() => {
            el.removeClass('modal--hidden');
            document.activeElement.blur();
        }, 20);
        if (this.model.view) {
            this.model.view.setElement(this.$el.find('.modal__body'));
            this.model.view.render();
        }
        return this;
    },

    change: function(config) {
        if (config.header) {
            this.$el.find('.modal__header').html(config.header);
        }
    },

    buttonClick: function(e) {
        if (!e.currentTarget) return;
        if (!e.currentTarget.tagName || e.currentTarget.tagName.toLowerCase() !== 'button') return;

        const currentTarget = $(e.currentTarget);
        const asyncResult = currentTarget.data('asyncresult');
        if (asyncResult) {
            this.closeWithAsyncResult(asyncResult, currentTarget[0]);
            return;
        }
        const result = currentTarget.data('result');
        this.closeWithResult(result);
    },

    bodyClick: function() {
        if (typeof this.model.click === 'string') {
            this.closeWithNonButtonResult(this.model.click);
        }
    },

    escPressed: function() {
        this.closeWithNonButtonResult(this.model.esc);
    },

    enterPressed: function(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.closeWithNonButtonResult(this.model.enter);
    },

    closeWithNonButtonResult: function(result) {
        if (!result) this.closeWithResult(result);
        const asyncButton = this.$el.find(`.vault_action[data-asyncresult="${result}"]`);
        if (asyncButton && asyncButton.length > 0 && asyncButton[0]) {
            this.closeWithAsyncResult(result, asyncButton[0]);
        } else {
            this.closeWithResult(result);
        }
    },

    closeWithAsyncResult: function(result, button) {
        const checked = this.model.checkbox ? this.$el.find('#modal__check').is(':checked') : undefined;
        button.classList.add('active');
        this.trigger('asyncResult', result, checked, () => {
            button.classList.remove('active');
            this.$el.addClass('modal--hidden');
            this.undelegateEvents();
            setTimeout(this.remove.bind(this), 100);
        });
    },

    closeWithResult: function(result) {
        const checked = this.model.checkbox ? this.$el.find('#modal__check').is(':checked') : undefined;
        this.trigger('result', result, checked);
        this.$el.addClass('modal--hidden');
        this.undelegateEvents();
        setTimeout(this.remove.bind(this), 100);
    },

    closeImmediate: function() {
        this.trigger('result', undefined);
        this.undelegateEvents();
        this.remove();
    }
});

module.exports = ModalView;
