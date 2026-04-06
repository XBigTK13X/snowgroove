import React, { Component } from 'react'

import Comp from './'

export default class LinkButton extends Component {
    render() {
        let style = this.props.buttonClass || 'large-button'
        return (
            <Comp.Href to={this.props.to} params={this.props.params}>
                <a href="/">
                    <button className={style}>{this.props.text}</button>
                </a>
            </Comp.Href>
        )
    }
}
