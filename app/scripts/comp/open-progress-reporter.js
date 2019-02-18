const Backbone = require('backbone');
const Logger = require('../util/logger');

const logger = new Logger('OpenProgressReporter');
const OpenProgressReporter = {
    times: [],
    init: function() {
        Backbone.on('progress-open-start', OpenProgressReporter.start, OpenProgressReporter);
        Backbone.on('progress-open-end', OpenProgressReporter.end, OpenProgressReporter);
        Backbone.on('progress-open-loginFinishStart', OpenProgressReporter.loginFinishStart, OpenProgressReporter);
        Backbone.on('progress-open-loginFinishFinish', OpenProgressReporter.loginFinishFinish, OpenProgressReporter);
        Backbone.on('progress-open-findDBStart', OpenProgressReporter.findDBStart, OpenProgressReporter);
        Backbone.on('progress-open-findDBEnd', OpenProgressReporter.findDBEnd, OpenProgressReporter);
        Backbone.on('progress-open-downloadDBStart', OpenProgressReporter.downloadDBStart, OpenProgressReporter);
        Backbone.on('progress-open-downloadDBEnd', OpenProgressReporter.downloadDBEnd, OpenProgressReporter);
        Backbone.on('progress-open-openDBStart', OpenProgressReporter.openDBStart, OpenProgressReporter);
        Backbone.on('progress-open-openDBEnd', OpenProgressReporter.openDBEnd, OpenProgressReporter);
    },
    start: function() {
        this.times = [];
        this.times.push({label: 'start', time: Date.now()});
    },
    end: function() {
        this.times.push({label: 'end', time: Date.now()});
        let time;
        let lastTime;
        const startTime = this.times[0].time;
        while ((time = this.times.shift()) !== undefined) {
            const difference = lastTime ? time.time - lastTime : undefined;
            lastTime = time.time;
            logger.info(time.label, time.time, difference !== undefined ? '(' + difference + 'ms)' : '');
        }
        logger.info('Total time: ' + (lastTime - startTime) + 'ms');
    },
    loginFinishStart: function() {
        this.times.push({label: 'login phase 2 start', time: Date.now()});
    },
    loginFinishFinish: function() {
        this.times.push({label: 'login phase 2 end', time: Date.now()});
    },
    findDBStart: function() {
        this.times.push({label: 'KDBX list start', time: Date.now()});
    },
    findDBEnd: function() {
        this.times.push({label: 'KDBX list end', time: Date.now()});
    },
    downloadDBStart: function() {
        this.times.push({label: 'KDBX download start', time: Date.now()});
    },
    downloadDBEnd: function() {
        this.times.push({label: 'KDBX download end', time: Date.now()});
    },
    openDBStart: function() {
        this.times.push({label: 'KDBX open start', time: Date.now()});
    },
    openDBEnd: function() {
        this.times.push({label: 'KDBX open end', time: Date.now()});
    }
};

module.exports = OpenProgressReporter;
