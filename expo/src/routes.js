// /wrap/ routes will have the nav header
export var routes = {
    signIn: '/sign-in',
    enterPassword: '/password',
    landing: '/auth/wrap/landing',
    info: '/auth/wrap/info',

    continueWatching: '/auth/wrap/list/continue-watching',
    deviceDetails: '/auth/wrap/details/device',
    deviceList: '/auth/wrap/list/device',
    crateDetails: '/auth/wrap/details/crate',
    musicSessionDetails: '/auth/wrap/details/music-session-details',
    options: '/auth/wrap/options',
    playlistDetails: '/auth/wrap/details/playlist',
    playlistList: '/auth/wrap/list/playlist',
    playlistUpdate: '/auth/wrap/update/playlist',
    search: '/auth/wrap/search',

    adminDashboard: '/auth/wrap/admin/dashboard',
    adminCleanupRuleEdit: '/auth/wrap/admin/cleanup-rule/cleanup-rule-edit',
    adminCleanupRuleList: '/auth/wrap/admin/cleanup-rule/cleanup-rule-list',
    adminJobDetails: '/auth/wrap/admin/job/job-details',
    adminJobList: '/auth/wrap/admin/job/job-list',
    adminJobRunner: '/auth/wrap/admin/job/job-runner',
    adminLogViewer: '/auth/wrap/admin/job/log-viewer',
    adminSessionList: '/auth/wrap/admin/session/session-list',
    adminShelfEdit: '/auth/wrap/admin/shelf/shelf-edit',
    adminShelfList: '/auth/wrap/admin/shelf/shelf-list',
    adminTagEdit: '/auth/wrap/admin/tag/tag-edit',
    adminTagList: '/auth/wrap/admin/tag/tag-list',
    adminTagRuleEdit: '/auth/wrap/admin/tag-rule/tag-rule-edit',
    adminTagRuleList: '/auth/wrap/admin/tag-rule/tag-rule-list',
    adminUserAccess: '/auth/wrap/admin/user/user-access',
    adminUserEdit: '/auth/wrap/admin/user/user-edit',
    adminUserList: '/auth/wrap/admin/user/user-list',
}

export function QuietReactWarning() {
    return null
}

export default QuietReactWarning