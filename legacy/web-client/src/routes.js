import pages from './page'

const routes = [
    {
        name: 'admin',
        url: '/admin',
        component: pages.Admin,
    },
    {
        name: 'queue',
        url: '/',
        component: pages.Queue,
    },
    {
        name: 'category-list',
        url: '/category/list',
        component: pages.CategoryList,
    },
    {
        name: 'artist-list',
        url: '/artist/list/:category',
        component: pages.ArtistList,
    },
    {
        name: 'album-list',
        url: '/album/list',
        component: pages.AlbumList,
    },
    {
        name: 'artist-view',
        url: '/artist/view/:artist',
        component: pages.ArtistView,
    },
    {
        name: 'album-view',
        url: '/album/view/:albumSlug',
        component: pages.AlbumView,
    },
    {
        name: 'playlist-list',
        url: '/playlist/list',
        component: pages.PlaylistList,
    },
    {
        name: 'playlist-view',
        url: '/playlist/view/:playlistId',
        component: pages.PlaylistView,
    },
    {
        name: 'song-list',
        url: '/song/list',
        component: pages.SongList,
    },
    {
        name: 'search',
        url: '/search',
        component: pages.Search,
    },
    {
        name: 'admin-logs',
        url: '/admin/logs',
        component: pages.AdminLogs,
    },
    {
        name: 'random-list',
        url: '/random/list',
        component: pages.RandomList,
    },
]

export default routes
