import React, { Component } from 'react'

import Comp from './'

export default class LinkTile extends Component {
    render() {
        if (this.props.action) {
            return (
                <a href="/" onClick={this.props.action}>
                    <div className="nav-button">{this.props.text}</div>
                </a>
            )
        }
        return (
            <Comp.Href to={this.props.to} params={this.props.params}>
                <a href="/">
                    <div className="nav-button">{this.props.text}</div>
                </a>
            </Comp.Href>
        )
    }
}
