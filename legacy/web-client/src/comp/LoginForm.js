import React, { Component } from 'react'

import service from '../service'

export default class LoginForm extends Component {
    constructor(props) {
        super(props)
        this.state = {
            users: null,
        }
    }

    componentDidMount() {
        service.api.userList().then((result) => {
            this.setState({
                users: result.users,
            })
        })
    }

    render() {
        if (!this.state.users) {
            return 'Loading users'
        }
        return (
            <div className="list-grid">
                {this.state.users.map((user, userIndex) => {
                    return (
                        <div
                            className="list-item-small button"
                            key={userIndex}
                            onClick={() => {
                                this.props.login(user)
                            }}
                        >
                            {user}
                        </div>
                    )
                })}
            </div>
        )
    }
}
