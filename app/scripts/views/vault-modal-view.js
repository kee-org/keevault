const Backbone = require('backbone');
const Keys = require('../const/keys');
const KeyHandler = require('../comp/key-handler');

const VaultModalView = Backbone.View.extend({
    el: 'div.app',

    template: require('templates/vault-modal.hbs'),

    events: {
        'click .modal__buttons button': 'buttonClick',
        'click': 'bodyClick'
    },

    initialize: function () {
        if (typeof this.model.esc === 'string') {
            KeyHandler.onKey(Keys.DOM_VK_ESCAPE, this.escPressed, this, false, true);
        }
        if (typeof this.model.enter === 'string') {
            KeyHandler.onKey(Keys.DOM_VK_RETURN, this.enterPressed, this, false, true);
        }
    },

    remove: function() {
        KeyHandler.offKey(Keys.DOM_VK_ESCAPE, this.escPressed, this);
        KeyHandler.offKey(Keys.DOM_VK_RETURN, this.enterPressed, this);
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
        if (this.model.view) {
            this.model.view.setElement(this.$el.find('.modal__body'));
            this.model.view.render();
        }

        if (this.model.target) {
            const target = $(this.model.target);
            if (this.model.width) {
                target.css('max-width', this.model.width);
            }
            const targetOffset = target.offset();
            switch (this.model.position) {
                case 'left':
                    this.addArrow(el, 'right');
                    el[0].firstElementChild.style.transformOrigin = 'calc(100% + 30px)';
                    el.offset({ top: targetOffset.top, left: targetOffset.left - el.width() - 30 });
                    break;
                case 'right':
                    this.addArrow(el, 'left');
                    el[0].firstElementChild.style.transformOrigin = 'calc(0% - 30px)';
                    el.offset({ top: targetOffset.top, left: targetOffset.left + target.width() + 30 });
                    break;
                case 'top':
                    this.addArrow(el, 'bottom');
                    el[0].firstElementChild.style.transformOrigin = 'centre calc(100% + 30px)';
                    el.offset({ top: targetOffset.top - el.height() - 30, left: targetOffset.left - el.width() / 2 + target.width() / 2 });
                    break;
            }
        }
        return this;
    },

    addArrow (el, position) {
        el[0].classList.add('arrow_box');
        el[0].classList.add(position);
    },

    buttonClick: function(e) {
        const result = $(e.target).data('result');
        this.closeWithResult(result);
    },

    bodyClick: function() {
        if (typeof this.model.click === 'string') {
            this.closeWithResult(this.model.click);
        }
    },

    escPressed: function(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.closeWithResult(this.model.esc);
    },

    enterPressed: function(e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        this.closeWithResult(this.model.enter);
    },

    closeWithResult: function(result) {
        const checked = this.model.checkbox ? this.$el.find('#modal__check').is(':checked') : undefined;
        this.trigger('result', result, checked);
        this.$el.addClass('modal--hidden');
        this.undelegateEvents();
        setTimeout(this.remove.bind(this), 200);
    },

    closeImmediate: function() {
        this.trigger('result', undefined);
        this.undelegateEvents();
        this.remove();
    },

    abort: function() {
        this.closeWithResult('abort');
    }
});

module.exports = VaultModalView;
