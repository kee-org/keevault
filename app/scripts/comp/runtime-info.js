const RuntimeInfo = {
    version: '@@VERSION',
    beta: !!'@@BETA',
    buildDate: '@@DATE',
    commit: '@@COMMIT',
    userAgent: navigator.userAgent
};

if (/^http(s?):\/\/keevault\.pm(\/|$)/.test(location.href)) {
    RuntimeInfo.stage = 'prod';
} else if (/^http(s?):\/\/app-beta\.kee\.pm(\/|$)/.test(location.href)) {
    RuntimeInfo.stage = 'beta';
} else {
    RuntimeInfo.stage = 'dev';
}

module.exports = RuntimeInfo;
