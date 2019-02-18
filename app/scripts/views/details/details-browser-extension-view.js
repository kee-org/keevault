const Backbone = require('backbone');
const Locale = require('../../util/locale');
const GridView = require('../grid-view');
const Backgrid = require('backgrid');
const InputFx = require('../../util/input-fx');
const FeatureDetector = require('../../util/feature-detector');

const BrowserExtensionView = Backbone.View.extend({
    template: require('templates/details/details-browser-extension.hbs'),

    events: {
        'change #details__browser-extension-enabled': 'setEnabled',
        'click #details__browser-extension-show-settings': 'showAllSettings',
        'keypress #details__browser-extension-priority,#details__browser-extension-realm,#details__browser-extension-extraMatchURLs input': 'keyPress',
        'keypress #details__browser-extension-extraMatchURLs input,#details__browser-extension-extraBlockURLs input': 'keyPress',
        'keydown #details__browser-extension-priority,#details__browser-extension-realm': 'keyDown',
        'keyDown #details__browser-extension-extraMatchURLs input,#details__browser-extension-extraBlockURLs input': 'keyDown',
        'change #details__browser-extension-minURLMatchAccuracy': 'setMinURLMatchAccuracy',
        'change #details__browser-extension-autofill,#details__browser-extension-autosubmit': 'setBehaviour',
        'change #details__browser-extension-realm': 'setRealm',
        'change #details__browser-extension-priority': 'setPriority'
    },

    initialize: function(opts) {
        this.displayPriorityField = opts.displayPriorityField;
        this.views = {};
    },

    render: function() {
        const browserName = FeatureDetector.getBrowserExtensionType();
        this.renderTemplate({
            hide: this.model.get('hide'),
            priority: this.model.get('priority'),
            realm: this.model.get('hTTPRealm'),
            minURLMatchAccuracy: this.model.get('mam'),
            isDesktop: FeatureDetector.getPlatformType() === 'desktop',
            extensionLink: FeatureDetector.getExtensionInstallURL(),
            extensionAvailable: !!browserName,
            extensionEnabled: window.keeAddonEnabled,
            browserName: browserName,
            displayPriorityField: this.displayPriorityField
        });
        this.renderBehaviour(this.model.get('behaviour'));
        this.renderURLCollections();
        return this;
    },

    renderBehaviour: function(behaviour) {
        const autofill = this.$el.find('#details__browser-extension-autofill');
        const autosubmit = this.$el.find('#details__browser-extension-autosubmit');

        switch (behaviour) {
            case 'AlwaysAutoFill':
                autofill.val('Always');
                autosubmit.val('Default');
                autofill.removeAttr('disabled');
                autosubmit.removeAttr('disabled');
                break;
            case 'NeverAutoSubmit':
                autofill.val('Default');
                autosubmit.val('Never');
                autofill.removeAttr('disabled');
                autosubmit.removeAttr('disabled');
                break;
            case 'AlwaysAutoFillAlwaysAutoSubmit':
                autosubmit.val('Always');
                autofill.val('Always');
                autofill.attr('disabled', 'disabled');
                autosubmit.removeAttr('disabled');
                break;
            case 'NeverAutoFillNeverAutoSubmit':
                autofill.val('Never');
                autosubmit.val('Never');
                autosubmit.attr('disabled', 'disabled');
                autofill.removeAttr('disabled');
                break;
            case 'AlwaysAutoFillNeverAutoSubmit':
                autofill.val('Always');
                autosubmit.val('Never');
                autosubmit.removeAttr('disabled');
                autofill.removeAttr('disabled');
                break;
            case 'Default':
                autofill.val('Default');
                autosubmit.val('Default');
                autosubmit.removeAttr('disabled');
                autofill.removeAttr('disabled');
                break;
        }
    },

    renderURLCollections: function () {
        const RegexBooleanCell = Backgrid.BooleanCell.extend({
            events: {
                'change input': function(e) {
                    if (e.target.checked) {
                        try {
                            new RegExp(this.model.get('url')); //eslint-disable-line
                            this.model.set(this.column.get('name'), true);
                        } catch (error) {
                            e.target.checked = false;
                            InputFx.shake(this.$el.prev());
                        }
                    } else {
                        this.model.set(this.column.get('name'), false);
                    }
                }
            },
            render: function () {
                this.$el.empty();
                const model = this.model, column = this.column;
                const editable = Backgrid.callByNeed(column.editable(), column, model);
                const id = `kee-vault-backgrid-boolean-${model.cid}`;
                this.$el.append($('<input>', {
                    tabIndex: -1,
                    type: 'checkbox',
                    checked: this.formatter.fromRaw(model.get(column.get('name')), model),
                    disabled: !editable,
                    id
                })).append($('<label>', { for: id }));
                this.delegateEvents();
                return this;
            }
        });

        const URLFormatter = _.extend({}, Backgrid.StringFormatter.prototype, {
            toRaw: function (formattedValue, model) {
                formattedValue = formattedValue && formattedValue.trim();
                const invalid = model.validate(_.extend(model.attributes, {url: formattedValue}));
                if (invalid) {
                    return undefined;
                }
                return formattedValue;
            }
        });

        const URLStringCell = Backgrid.StringCell.extend({
            formatter: URLFormatter,
            initialize: function (options) {
                URLStringCell.__super__.initialize.apply(this, arguments);
                this.listenTo(this.model, 'backgrid:error', () => {
                    this.$el.find('input').toggleClass('input--error', true);
                    InputFx.shake(this.$el.find('input'));
                });
            }
        });

        const columns = [{
            name: 'url',
            label: Locale.url,
            cell: URLStringCell,
            sortable: false
        }, {
            name: 'regex',
            label: Locale.regex,
            cell: RegexBooleanCell,
            sortable: false
        }];

        const wlCollection = this.model.get('wl');
        const blCollection = this.model.get('bl');

        const wlGrid = new GridView({
            columns: _.clone(columns),
            collection: wlCollection,
            newRowConfig: {
                validate: (text) => {
                    return this.isUniqueURLOrPattern(text, wlCollection);
                },
                addItem: (text) => {
                    wlCollection.add({
                        url: text,
                        regex: false
                    });
                },
                placeholder: 'URL or regex pattern (e.g. https://www.google.com/)'
            }
        });
        const blGrid = new GridView({
            columns: _.clone(columns),
            collection: blCollection,
            newRowConfig: {
                validate: (text) => {
                    return this.isUniqueURLOrPattern(text, blCollection);
                },
                addItem: (text) => {
                    blCollection.add({
                        url: text,
                        regex: false
                    });
                },
                placeholder: 'URL or regex pattern (e.g. https://www.google.com/)'
            }
        });

        this.$el.find('#details__browser-extension-extraMatchURLs').append(wlGrid.render().el);
        this.$el.find('#details__browser-extension-extraBlockURLs').append(blGrid.render().el);
    },

    isUniqueURLOrPattern: function (text, collection) {
        if (collection.any(model => model.get('url') === text)) {
            return false;
        }
        return true;
    },

    setEnabled: function (e) {
        if (e.target.checked) {
            this.model.set('hide', false);
            this.$el.find('#details__browser-extension-show-settings').removeClass('hide');
        } else {
            this.model.set('hide', true);
            this.$el.find('#details__browser-extension-show-settings').addClass('hide');
            this.$el.find('#details__browser-extension-settings').addClass('hide');
        }
    },

    showAllSettings: function () {
        this.$el.find('#details__browser-extension-show-settings').addClass('hide');
        this.$el.find('#details__browser-extension-settings').removeClass('hide');
    },

    setMinURLMatchAccuracy: function (e) {
        const mam = e.target.value;
        this.model.set('mam', mam);
    },

    setBehaviour: function (e) {
        const autofill = this.$el.find('#details__browser-extension-autofill').val();
        const autosubmit = this.$el.find('#details__browser-extension-autosubmit').val();
        let newBehaviour;
        if (autofill === 'Never') {
            newBehaviour = 'NeverAutoFillNeverAutoSubmit';
        } else if (autosubmit === 'Always') {
            newBehaviour = 'AlwaysAutoFillAlwaysAutoSubmit';
        } else if (autofill === 'Always' && autosubmit === 'Never') {
            newBehaviour = 'AlwaysAutoFillNeverAutoSubmit';
        } else if (autosubmit === 'Never') {
            newBehaviour = 'NeverAutoSubmit';
        } else if (autofill === 'Always') {
            newBehaviour = 'AlwaysAutoFill';
        } else {
            newBehaviour = 'Default';
        }
        this.renderBehaviour(newBehaviour);
        this.model.set('behaviour', newBehaviour);
    },

    setRealm: function (e) {
        const realm = e.target.value;
        this.model.set('hTTPRealm', realm);
    },

    setPriority: function (e) {
        const priority = e.target.value;
        this.model.set('priority', priority);
    },

    keyPress: function(e) {
        e.stopPropagation();
    },

    keyDown: function(e) {
        e.stopPropagation();
    }

});

module.exports = BrowserExtensionView;
