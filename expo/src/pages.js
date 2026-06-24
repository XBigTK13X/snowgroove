import { routes } from './routes'
import SignInPage from './page/sign-in'
import EnterPasswordPage from './page/password'
import LandingPage from './page/auth/wrap/landing'
import InfoPage from './page/auth/wrap/info'

import DeviceDetailsPage from './page/auth/wrap/device-details'
import DeviceListPage from './page/auth/wrap/device-list'
import CrateDetailsPage from './page/auth/wrap/crate-details'
import MusicSessionDetailsPage from './page/auth/wrap/music-session-details'
import OptionsPage from './page/auth/wrap/options'
import PlaylistDetailsPage from './page/auth/wrap/playlist-details'
import PlaylistListPage from './page/auth/wrap/playlist-list'
import PlaylistUpdatePage from './page/auth/wrap/playlist-update'
import SearchPage from './page/auth/wrap/search'

import DashboardPage from './page/auth/wrap/admin/dashboard'
import CleanupRuleEditPage from './page/auth/wrap/admin/cleanup-rule/cleanup-rule-edit'
import CleanupRuleListPage from './page/auth/wrap/admin/cleanup-rule/cleanup-rule-list'
import JobDetailsPage from './page/auth/wrap/admin/job/job-details'
import JobListPage from './page/auth/wrap/admin/job/job-list'
import JobRunnerPage from './page/auth/wrap/admin/job/job-runner'
import LogViewerPage from './page/auth/wrap/admin/job/log-viewer'
import SessionListPage from './page/auth/wrap/admin/session/session-list'
import ShelfEditPage from './page/auth/wrap/admin/shelf/shelf-edit'
import ShelfListPage from './page/auth/wrap/admin/shelf/shelf-list'
import TagEditPage from './page/auth/wrap/admin/tag/tag-edit'
import TagListPage from './page/auth/wrap/admin/tag/tag-list'
import TagRuleEditPage from './page/auth/wrap/admin/tag-rule/tag-rule-edit'
import TagRuleListPage from './page/auth/wrap/admin/tag-rule/tag-rule-list'
import UserAccessPage from './page/auth/wrap/admin/user/user-access'
import UserEditPage from './page/auth/wrap/admin/user/user-edit'
import UserListPage from './page/auth/wrap/admin/user/user-list'

export var pages = {
    [routes.signIn]: SignInPage,
    [routes.enterPassword]: EnterPasswordPage,
    [routes.landing]: LandingPage,
    [routes.info]: InfoPage,

    [routes.deviceDetails]: DeviceDetailsPage,
    [routes.deviceList]: DeviceListPage,
    [routes.crateDetails]: CrateDetailsPage,
    [routes.musicSessionDetails]: MusicSessionDetailsPage,
    [routes.options]: OptionsPage,
    [routes.playlistDetails]: PlaylistDetailsPage,
    [routes.playlistList]: PlaylistListPage,
    [routes.playlistUpdate]: PlaylistUpdatePage,
    [routes.search]: SearchPage,

    [routes.adminDashboard]: DashboardPage,
    [routes.adminCleanupRuleEdit]: CleanupRuleEditPage,
    [routes.adminCleanupRuleList]: CleanupRuleListPage,
    [routes.adminJobDetails]: JobDetailsPage,
    [routes.adminJobList]: JobListPage,
    [routes.adminJobRunner]: JobRunnerPage,
    [routes.adminLogViewer]: LogViewerPage,
    [routes.adminSessionList]: SessionListPage,
    [routes.adminShelfEdit]: ShelfEditPage,
    [routes.adminShelfList]: ShelfListPage,
    [routes.adminTagEdit]: TagEditPage,
    [routes.adminTagList]: TagListPage,
    [routes.adminTagRuleEdit]: TagRuleEditPage,
    [routes.adminTagRuleList]: TagRuleListPage,
    [routes.adminUserAccess]: UserAccessPage,
    [routes.adminUserEdit]: UserEditPage,
    [routes.adminUserList]: UserListPage,
}


export function QuietReactWarning() {
    return null
}

export default QuietReactWarning