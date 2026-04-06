import React, { Component } from 'react'

import Comp from './'

export default class CategoryListItem extends Component {
    render() {
        let to = this.props.categoryKind === 'ArtistList' ? 'artist-list' : 'artist-view'
        let params =
            this.props.categoryKind === 'ArtistList'
                ? {
                      category: this.props.categoryName,
                  }
                : {
                      artist: this.props.categoryName,
                  }
        return (
            <Comp.Href to={to} params={params}>
                <a href="/">
                    <div className="list-item-small">{this.props.categoryName}</div>
                </a>
            </Comp.Href>
        )
    }
}
