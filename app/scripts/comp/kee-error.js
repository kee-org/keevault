const KeeError = {
    Unexpected: 'unexpected',
    InvalidState: 'invalidState',
    LoginRequired: 'loginRequired',
    LoginFailed: 'loginFailed',
    LoginFailedMITM: 'loginFailedMITM',
    ServerFail: 'serverFail',
    ServerUnreachable: 'serverUnreachable',
    ServerTimeout: 'serverTimeout',
    NotFound: 'notFound',
    ServerConflict: 'serverConflict',
    AlreadyRegistered: 'alreadyRegistered',
    MissingPrimaryDB: 'missingPrimaryDB',
    ExceededQuota: 'exceededQuota',
    InvalidRequest: 'invalidRequest'
};

module.exports = KeeError;
