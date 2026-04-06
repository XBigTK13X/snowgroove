const settings = require('./settings')
const fs = require('fs')
const _ = require('lodash')
const path = require('path')
const mkdirp = require('mkdirp')

class Asset {
    constructor(name) {
        this.filePath = path.join(settings.databaseDirectory, `/asset/${name}`)
        let dirPath = path.dirname(this.filePath)
        if (!fs.existsSync(dirPath)) {
            mkdirp.sync(dirPath)
        }
    }

    exists() {
        return fs.existsSync(this.filePath)
    }

    read() {
        return new Promise((resolve, reject) => {
            fs.access(this.filePath, (err) => {
                if (err) {
                    return resolve(null)
                }
                fs.readFile(this.filePath, 'binary', (err, data) => {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(data)
                })
            })
        })
    }

    write(binaryContent) {
        return new Promise((resolve, reject) => {
            fs.writeFile(this.filePath, binaryContent, 'binary', (err) => {
                if (err) {
                    return reject(err)
                }
                return resolve()
            })
        })
    }
}

let instances = {}

let getInstance = (name) => {
    if (!_.has(instances, name)) {
        instances[name] = new Asset(name)
    }
    return instances[name]
}

module.exports = {
    getInstance,
}
