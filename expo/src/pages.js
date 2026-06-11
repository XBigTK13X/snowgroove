import { routes } from './routes'
import SignInPage from './page/sign-in'
import EnterPasswordPage from './page/password'
import LandingPage from './page/auth/wrap/landing'
import InfoPage from './page/auth/wrap/info'

import ContinueWatchingPage from './page/auth/wrap/list/continue-watching'
import DeviceDetailsPage from './page/auth/wrap/details/device-details'
import DeviceListPage from './page/auth/wrap/list/device-list'
import EpisodeDetailsPage from './page/auth/wrap/details/episode'
import EpisodeListPage from './page/auth/wrap/list/episode'
import CrateDetailsPage from './page/auth/wrap/details/crate-details'
import MusicSessionDetailsPage from './page/auth/wrap/details/music-session-details'
import OptionsPage from './page/auth/wrap/options'
import PlaylistDetailsPage from './page/auth/wrap/details/playlist'
import PlaylistListPage from './page/auth/wrap/list/playlist'
import SearchPage from './page/auth/wrap/search'
import SeasonListPage from './page/auth/wrap/list/season'
import ShowListPage from './page/auth/wrap/list/show'
import StreamableListPage from './page/auth/wrap/list/streamable'

import DashboardPage from './page/auth/wrap/admin/dashboard'
import CleanupRuleEditPage from './page/auth/wrap/admin/cleanup-rule/cleanup-rule-edit'
import CleanupRuleListPage from './page/auth/wrap/admin/cleanup-rule/cleanup-rule-list'
import ChannelsEditPage from './page/auth/wrap/admin/guide-source/channels-edit'
import ChannelGuideSourceListPage from './page/auth/wrap/admin/guide-source/guide-source-list'
import ChannelGuideSourceEditPage from './page/auth/wrap/admin/guide-source/guide-source-edit'
import JobDetailsPage from './page/auth/wrap/admin/job/job-details'
import JobListPage from './page/auth/wrap/admin/job/job-list'
import JobRunnerPage from './page/auth/wrap/admin/job/job-runner'
import LogViewerPage from './page/auth/wrap/admin/job/log-viewer'
import SessionListPage from './page/auth/wrap/admin/session/session-list'
import ShelfEditPage from './page/auth/wrap/admin/shelf/shelf-edit'
import ShelfListPage from './page/auth/wrap/admin/shelf/shelf-list'
import StreamablesEditPage from './page/auth/wrap/admin/stream-source/streamables-edit'
import StreamSourceEditPage from './page/auth/wrap/admin/stream-source/stream-source-edit'
import StreamSourceListPage from './page/auth/wrap/admin/stream-source/stream-source-list'
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

    [routes.continueWatching]: ContinueWatchingPage,
    [routes.deviceDetails]: DeviceDetailsPage,
    [routes.deviceList]: DeviceListPage,
    [routes.crateDetails]: CrateDetailsPage,
    [routes.musicSessionDetails]: MusicSessionDetailsPage,
    [routes.options]: OptionsPage,
    [routes.playlistDetails]: PlaylistDetailsPage,
    [routes.playlistList]: PlaylistListPage,
    [routes.search]: SearchPage,

    [routes.adminDashboard]: DashboardPage,
    [routes.adminCleanupRuleEdit]: CleanupRuleEditPage,
    [routes.adminCleanupRuleList]: CleanupRuleListPage,
    [routes.adminChannelsEdit]: ChannelsEditPage,
    [routes.adminChannelGuideSourceList]: ChannelGuideSourceListPage,
    [routes.adminChannelGuideSourceEdit]: ChannelGuideSourceEditPage,
    [routes.adminJobDetails]: JobDetailsPage,
    [routes.adminJobList]: JobListPage,
    [routes.adminJobRunner]: JobRunnerPage,
    [routes.adminLogViewer]: LogViewerPage,
    [routes.adminSessionList]: SessionListPage,
    [routes.adminShelfEdit]: ShelfEditPage,
    [routes.adminShelfList]: ShelfListPage,
    [routes.adminStreamablesEdit]: StreamablesEditPage,
    [routes.adminStreamSourceEdit]: StreamSourceEditPage,
    [routes.adminStreamSourceList]: StreamSourceListPage,
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