const Backbone = require('backbone');
const FileModel = require('../models/file-model');

const FileCollection = Backbone.Collection.extend({
    model: FileModel,

    hasDemoFile: function() {
        return this.some(file => file.get('demo'));
    },

    hasOpenFiles: function() {
        return this.some(file => file.get('open'));
    },

    hasUnsavedFiles: function() {
        return this.some(file => file.get('modified'));
    },

    hasSyncingFiles: function() {
        return this.some(file => file.get('syncing'));
    },

    hasErrorFiles: function() {
        return this.some(file => file.get('syncError'));
    },

    hasDirtyFiles: function() {
        return this.some(file => file.get('dirty'));
    },

    getByName: function(name) {
        return this.find(file => file.get('name').toLowerCase() === name.toLowerCase());
    },

    hasAtLeastOneEntry: function() {
        return this.some(file => {
            for (const entry of Object.values(file.entryMap)) {
                if (entry && entry.entry && entry.entry.parentGroup &&
                    !entry.entry.parentGroup.uuid.equals(file.db.meta.recycleBinUuid)) {
                    return true;
                }
            }
        });
    }
});

module.exports = FileCollection;
