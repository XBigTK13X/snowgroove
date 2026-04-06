import React, { Component } from 'react'

import Comp from './'

const actionLinks = [
    {
        to: 'queue',
        text: 'Queue',
    },
    {
        to: 'playlist-list',
        text: 'Playlists',
    },
    {
        to: 'search',
        text: 'Search',
    },
    {
        to: 'random-list',
        text: 'Random',
    },
    {
        text: 'Categories',
        to: 'category-list',
    },
    {
        text: 'Admin',
        to: 'admin',
    },
    {
        text: 'Logout',
        action: 'logout',
    },
]

export default class NavBar extends Component {
    render() {
        return (
            <div>
                {actionLinks.map((link, linkIndex) => {
                    if (link.action) {
                        return <Comp.LinkTile key={linkIndex} text={link.text} action={this.props.logout} />
                    }
                    return <Comp.LinkTile key={linkIndex} to={link.to} text={link.text} params={link.params} />
                })}
            </div>
        )
    }
}
