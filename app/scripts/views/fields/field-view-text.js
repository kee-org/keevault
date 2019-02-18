const Backbone = require('backbone');
const FieldView = require('./field-view');
const GeneratorView = require('../generator-view');
const KeyHandler = require('../../comp/key-handler');
const Keys = require('../../const/keys');
const PasswordGenerator = require('../../util/password-generator');
const FeatureDetector = require('../../util/feature-detector');
const kdbxweb = require('kdbxweb');
const Tip = require('../../util/tip');

const FieldViewText = FieldView.extend({
    renderValue: function(value) {
        return value && value.isProtected ? PasswordGenerator.present(value.textLength)
            : _.escape(value || '').replace(/\n/g, '<br/>');
    },

    getEditValue: function(value) {
        return value && value.isProtected ? value.getText() : value || '';
    },

    renderInput: function(text, isProtected) {
        this.$el.toggleClass('details__field--protected', isProtected);
        this.input = $(document.createElement(this.model.multiline ? 'textarea' : 'input'));
        this.valueEl.prepend(this.input);
        this.input.attr({ autocomplete: 'off', spellcheck: 'false' })
            .val(text).focus()[0].setSelectionRange(text.length, text.length);
        this.input.bind({
            input: this.fieldValueInput.bind(this),
            keydown: this.fieldValueKeydown.bind(this),
            keypress: this.fieldValueInput.bind(this),
            click: this.fieldValueInputClick.bind(this),
            mousedown: this.fieldValueInputMouseDown.bind(this)
        });
    },

    startEdit: function() {
        this.valueEl.html('');
        const text = this.getEditValue(this.value);
        const isProtected = !!(this.value && this.value.isProtected);
        this.renderInput(text, isProtected);
        this.listenTo(Backbone, 'click', this.fieldValueBlur);
        this.listenTo(Backbone, 'main-window-will-close user-idle', this.externalEndEdit);
        if (this.model.multiline) {
            this.setInputHeight();
        }
        if (FeatureDetector.isMobile) {
            this.createMobileControls();
        }
        if (this.model.canGen) {
            $('<div/>').addClass('details__field-value-btn details__field-value-btn-gen').appendTo(this.valueEl)
                .click(this.showGeneratorClick.bind(this))
                .mousedown(this.showGenerator.bind(this));
        }
        Tip.hideTip(this.valueEl[0]);
        Tip.hideTip(this.labelEl[0]);
    },

    createMobileControls: function() {
        this.mobileControls = {};
        ['cancel', 'apply'].forEach(action => {
            this.mobileControls[action] = $('<div/>')
                .addClass('details__field-value-btn details__field-value-btn-' + action)
                .addClass('fas')
                .appendTo(this.labelEl)
                .data('action', action)
                .on({
                    mousedown: this.mobileFieldControlMouseDown.bind(this),
                    touchstart: this.mobileFieldControlTouchStart.bind(this),
                    touchend: this.mobileFieldControlTouchEnd.bind(this),
                    touchmove: this.mobileFieldControlTouchMove.bind(this)
                });
        });
    },

    showGeneratorClick: function(e) {
        e.stopPropagation();
        if (!this.gen) {
            this.input.focus();
        }
    },

    showGenerator: function() {
        if (this.gen) {
            this.hideGenerator();
        } else {
            const fieldRect = this.input[0].getBoundingClientRect();
            const right = document.body.getBoundingClientRect().right - fieldRect.right;
            const top = fieldRect.bottom;
            this.gen = new GeneratorView({model: {pos: {right, top}, password: this.value}}).render();
            this.gen.once('remove', this.generatorClosed.bind(this));
            this.gen.once('result', this.generatorResult.bind(this));
        }
    },

    hideGenerator: function() {
        if (this.gen) {
            const gen = this.gen;
            delete this.gen;
            gen.remove();
          //  this.input.focus();
        }
    },

    generatorClosed: function() {
        if (this.browserFieldView) {
            this.browserFieldView.closing();
            this.browserFieldView.remove();
            this.browserFieldView = null;
        } else {
            this.endEdit(this.input.val());
        }
    },

    generatorResult: function(password) {
        this.input.val(password);
        if (this.browserFieldView) {
            this.browserFieldView.closing();
            this.browserFieldView.remove();
            this.browserFieldView = null;
        } else {
            this.endEdit(password);
        }
    },

    setInputHeight: function() {
        const MinHeight = 18;
        this.input.height(MinHeight);
        let newHeight = this.input[0].scrollHeight;
        if (newHeight <= MinHeight) {
            newHeight = MinHeight;
        }
        /*
        This is bogus on Linux. Maybe it was a hack for some other systems though.
         else {
            newHeight += 2;
        }
        */
        this.input.height(newHeight);
    },

    fieldValueBlur: function() {
        if (!this.gen && this.input) {
            this.endEdit(this.input.val());
        }
    },

    fieldValueInput: function(e) {
        e.stopPropagation();
        if (this.model.multiline) {
            this.setInputHeight();
        }
    },

    fieldValueInputClick: function() {
        if (this.gen) {
            this.hideGenerator();
        }
    },

    fieldValueInputMouseDown: function(e) {
        e.stopPropagation();
    },

    fieldValueKeydown: function(e) {
        KeyHandler.reg();
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            if (!this.model.multiline || (!e.altKey && !e.shiftKey && !e.ctrlKey)) {
                if (this.gen) {
                    e.target.value = this.gen.password;
                    this.hideGenerator();
                    return;
                }
                this.stopBlurListener();
                this.endEdit(e.target.value);
            }
        } else if (code === Keys.DOM_VK_ESCAPE) {
            this.stopBlurListener();
            this.endEdit();
        } else if (code === Keys.DOM_VK_TAB) {
            e.preventDefault();
            this.stopBlurListener();
            this.endEdit(e.target.value, { tab: { field: this.model.name, prev: e.shiftKey } });
        } else if (code === Keys.DOM_VK_G && e.metaKey) {
            e.preventDefault();
            this.showGenerator();
        } else if (code === Keys.DOM_VK_S && (e.metaKey || e.ctrlKey)) {
            this.stopBlurListener();
            this.endEdit(e.target.value);
            return;
        }
        e.stopPropagation();
    },

    externalEndEdit: function() {
        if (this.input) {
            this.endEdit(this.input.val());
        }
    },

    endEdit: function(newVal, extra) {
        if (this.gen) {
            this.hideGenerator();
        }
        if (!this.editing) {
            return;
        }
        delete this.input;
        if (this.mobileControls) {
            this.mobileControls.cancel.remove();
            this.mobileControls.apply.remove();
            delete this.mobileControls;
        }
        this.stopBlurListener();
        if (typeof newVal === 'string' && this.value instanceof kdbxweb.ProtectedValue) {
            newVal = kdbxweb.ProtectedValue.fromString(newVal);
        }
        if (typeof newVal === 'string') {
            newVal = $.trim(newVal);
        }
        FieldView.prototype.endEdit.call(this, newVal, extra);
    },

    stopBlurListener: function() {
        this.stopListening(Backbone, 'click main-window-will-close', this.fieldValueBlur);
    },

    mobileFieldControlMouseDown(e) {
        e.stopPropagation();
        this.stopBlurListener();
        const action = $(e.target).data('action');
        if (this.browserFieldView) {
            if (action !== 'apply') {
                this.input.val(this.getEditValue(this.value));
            }
            this.browserFieldView.closing();
            this.browserFieldView.remove();
            this.browserFieldView = null;
        } else {
            if (action === 'apply') {
                this.endEdit(this.input.val());
            } else {
                this.endEdit();
            }
        }
    },

    mobileFieldControlTouchStart(e) {
        this.$el.attr('active-mobile-action', $(e.target).data('action'));
    },

    mobileFieldControlTouchEnd(e) {
        const shouldExecute = this.$el.attr('active-mobile-action') === $(e.target).data('action');
        this.$el.removeAttr('active-mobile-action');
        if (shouldExecute) {
            this.mobileFieldControlMouseDown(e);
        }
    },

    mobileFieldControlTouchMove(e) {
        const touch = e.originalEvent.targetTouches[0];
        const rect = touch.target.getBoundingClientRect();
        const inside = touch.clientX >= rect.left && touch.clientX <= rect.right &&
            touch.clientY >= rect.top && touch.clientY <= rect.bottom;
        if (inside) {
            this.$el.attr('active-mobile-action', $(e.target).data('action'));
        } else {
            this.$el.removeAttr('active-mobile-action');
        }
    },

    render() {
        FieldView.prototype.render.call(this);
    }
});

module.exports = FieldViewText;
