const settings = require('./settings')
const fs = require('fs')
const _ = require('lodash')
const path = require('path')
const mkdirp = require('mkdirp')

class Database {
    constructor(name) {
        this.filePath = path.join(settings.databaseDirectory, `${name}.json`)
        let dirPath = path.dirname(this.filePath)
        if (!fs.existsSync(dirPath)) {
            mkdirp.sync(dirPath)
        }
        this.workingSet = {}
    }

    isEmpty() {
        return _.isEmpty(this.workingSet)
    }

    read() {
        return new Promise((resolve, reject) => {
            fs.access(this.filePath, (err) => {
                if (err) {
                    return resolve(this.workingSet)
                }
                fs.readFile(this.filePath, 'utf8', (err, data) => {
                    if (err) {
                        return reject(err)
                    }
                    this.workingSet = JSON.parse(data)
                    return resolve(this.workingSet)
                })
            })
        })
    }

    write(workingSet) {
        return new Promise((resolve, reject) => {
            if (workingSet) {
                this.workingSet = workingSet
            }
            fs.writeFile(this.filePath, JSON.stringify(this.workingSet, null, '\t'), 'utf8', (err) => {
                if (err) {
                    return reject(err)
                }
                return resolve(this.workingSet)
            })
        })
    }
}

let instances = {}

let getInstance = (name) => {
    if (!_.has(instances, name)) {
        instances[name] = new Database(name)
    }
    return instances[name]
}

module.exports = {
    getInstance,
}
