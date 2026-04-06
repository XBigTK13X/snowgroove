import React, { Component } from 'react'
import Comp from '../comp'

export default class CategoryList extends Component {
    constructor(props) {
        super(props)

        this.state = {
            categories: {},
        }
    }

    componentDidMount() {
        this.props.api.getCategories().then((result) => {
            this.setState({
                categories: result,
            })
        })
    }

    render() {
        if (!this.state.categories.list) {
            return 'No categories available on server.'
        }
        return (
            <div>
                <h1>Categories ({this.state.categories.list.length})</h1>
                <div className="list-grid">
                    {this.state.categories.list.map((categoryName, categoryIndex) => {
                        return <Comp.CategoryListItem key={categoryIndex} categoryName={categoryName} categoryKind={this.state.categories.lookup[categoryName].Kind} />
                    })}
                </div>
            </div>
        )
    }
}
