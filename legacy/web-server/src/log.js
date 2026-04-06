const settings = require('./settings')
const fs = require('fs')
const _ = require('lodash')
const path = require('path')
const mkdirp = require('mkdirp')
const database = require('./database')

class Log {
    constructor(name) {
        this.workingSet = {
            entries: [],
        }
    }

    read() {
        return new Promise((resolve, reject) => {
            resolve(this.workingSet)
        })
    }

    write(log) {
        return new Promise((resolve, reject) => {
            this.workingSet.entries.push(log)
            resolve(this.workingSet)
        })
    }
}

let instances = {}

let getInstance = (name) => {
    if (!_.has(instances, name)) {
        instances[name] = new Log(name)
    }
    return instances[name]
}

let getAll = () => {
    return instances
}

let wipeAll = () => {
    instances = {}
}

let persistAll = () => {
    return database.getInstance(`/log/${new Date().getTime()}.log`).write(instances)
}

module.exports = {
    getInstance,
    getAll,
    persistAll,
    wipeAll,
}
