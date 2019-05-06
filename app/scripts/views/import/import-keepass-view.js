const Backbone = require('backbone');
const kdbxweb = require('kdbxweb');
const Alerts = require('../../comp/alerts');
const Locale = require('../../util/locale');
const InputFx = require('../../util/input-fx');
const FeatureDetector = require('../../util/feature-detector');
const Keys = require('../../const/keys');

const ImportKeePassView = Backbone.View.extend({
    template: require('templates/import/keepass.hbs'),

    events: {
        'change .import__file-ctrl': 'fileSelected',
        'click .import__icon-import': 'fileChooser',
        'click #importButton': 'startImport',
        'dragover': 'dragover',
        'dragleave': 'dragleave',
        'drop': 'drop',
        'keydown #importPassword': 'inputKeydown',
        'keyup #importPassword': 'inputKeyup',
        'keypress #importPassword': 'inputKeypress'
    },

    render() {
        if (this.dragTimeout) {
            clearTimeout(this.dragTimeout);
        }
        this.renderTemplate();
        return this;
    },

    async startImport() {
        const importButton = $('#importButton')[0];
        const passwordEl = $('#importPassword');
        importButton.classList.add('active');
        importButton.setAttribute('disabled', 'disabled');
        passwordEl.attr('disabled', 'disabled');

        const activeFile = this.model.files.first();

        if (!passwordEl) return;
        const password = passwordEl.val();

        const startTime = Date.now();
        const error = await activeFile.importFromData(this.fileData, password);
        const time = Date.now() - startTime;

        passwordEl.removeAttr('disabled');
        importButton.classList.remove('active');
        importButton.removeAttribute('disabled');

        if (error) {
            passwordEl.toggleClass('input--error', true);
            if (!FeatureDetector.isMobile) {
                passwordEl.focus();
            }
            passwordEl.selectionStart = 0;
            passwordEl.selectionEnd = passwordEl.val().length;
            InputFx.shake(passwordEl);

            // This won't be needed once we support adding a key file for
            // importing so it's a quick hack
            $('#keyfileNotSupported')[0].classList.remove('hide');
            window.trackMatomoAction(['trackEvent', 'Import', 'Error', 'keepass', time]);
        } else {
            Backbone.trigger('show-entries');
            window.trackMatomoAction(['trackEvent', 'Import', 'Success', 'keepass', time]);
        }
    },

    fileChooser: function(e) {
        this.fileData = null;
        const fileInput = this.$el.find('.import__file-ctrl').attr('accept', 'kdbx').val(null);
        fileInput.click();
    },

    fileSelected: function(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    },

    processFile: function(file, complete) {
        const reader = new FileReader();
        reader.onload = e => {
            if (!this.checkOpenFileFormat(e.target.result)) {
                return;
            }
            this.fileData = e.target.result;
            const importEl = $('#importButton');
            const passwordEl = $('#importPassword');
            importEl.find('div.content').text(Locale.importFrom.replace('{}', file.name));
            passwordEl.attr('placeholder', `${Locale.openPassFor} ${file.name}`);
            $('.open__pass-area').removeClass('hide');
            importEl.removeClass('hide');

            // This won't be needed once we support adding a key file for
            // importing so it's a quick hack
            $('#keyfileNotSupported')[0].classList.add('hide');

            if (!FeatureDetector.isMobile) {
                passwordEl.focus();
            }
            window.trackMatomoAction(['trackEvent', 'Import', 'PasswordPromptShown', 'keepass']);
        };
        reader.onerror = () => {
            Alerts.error({ header: Locale.openFailedRead });
        };
        reader.readAsArrayBuffer(file);
    },

    checkOpenFileFormat: function(fileData) {
        const fileSig = fileData.byteLength < 8 ? null : new Uint32Array(fileData, 0, 2);
        if (!fileSig || fileSig[0] !== kdbxweb.Consts.Signatures.FileMagic) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileBody });
            return false;
        }
        if (fileSig[1] === kdbxweb.Consts.Signatures.Sig2Kdb) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openKdbFileBody });
            return false;
        }
        if (fileSig[1] !== kdbxweb.Consts.Signatures.Sig2Kdbx) {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileBody });
            return false;
        }
        return true;
    },

    dragover: function(e) {
        e.preventDefault();
        e.stopPropagation();
        const dt = e.originalEvent.dataTransfer;
        if (!dt.types || (dt.types.indexOf ? dt.types.indexOf('Files') === -1 : !dt.types.contains('Files'))) {
            dt.dropEffect = 'none';
            return;
        }
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
        const dataFile = _.find(files, file => file.name.split('.').pop().toLowerCase() === 'kdbx');
        if (dataFile) {
            this.processFile(dataFile);
        } else {
            Alerts.error({ header: Locale.openWrongFile, body: Locale.openWrongFileBody });
        }
    },

    inputKeydown: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_RETURN) {
            this.startImport();
        } else if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeyup: function(e) {
        const code = e.keyCode || e.which;
        if (code === Keys.DOM_VK_CAPS_LOCK) {
            this.toggleCapsLockWarning(false);
        }
    },

    inputKeypress: function(e) {
        const charCode = e.keyCode || e.which;
        const ch = String.fromCharCode(charCode);
        const lower = ch.toLowerCase();
        const upper = ch.toUpperCase();
        if (lower !== upper && !e.shiftKey) {
            this.toggleCapsLockWarning(ch !== lower);
        }
    },

    toggleCapsLockWarning: function(on) {
        this.$el.find('.open__pass-warning').toggleClass('invisible', !on);
    }

});

module.exports = ImportKeePassView;
