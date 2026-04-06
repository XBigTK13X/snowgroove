const _ = require('lodash')
const hash = require('object-hash')
const settings = require('./settings')

const searchify = (text) => {
    return _.deburr(text).toLowerCase().replace(/\W/g, '').replace(/\s/g, '')
}

const sortify = (text) => {
    return text.toLowerCase().replace('the ', '')
}

const alphabetize = (items, property) => {
    if (property) {
        return items.sort((a, b) => {
            return sortify(a[property]) > sortify(b[property]) ? 1 : -1
        })
    }
    return items.sort((a, b) => {
        return sortify(a) > sortify(b) ? 1 : -1
    })
}

const contentHash = (content) => {
    return hash(content, { algorithm: 'md5' })
}

const log = (...args) => {
    if (typeof console !== 'undefined') {
        console.log.apply(console, args)
    }
}

const nginxMediaPath = (absoluteFilePath) => {
    let relativePath = absoluteFilePath.replace(settings.mediaRoot + '/', '')
    return `${settings.mediaServer}/${settings.relativeMediaDir}${encodeURI(relativePath).replace(/#/g, '%23')}`
}

const nginxThumbnailPath = (absoluteFilePath, isLocalPath) => {
    if (isLocalPath) {
        let relativePath = absoluteFilePath.replace(settings.mediaRoot + '/', '')
        relativePath = relativePath.replace('music/', '')
        relativePath = relativePath.replaceAll('/', '-') + '.jpg'
        return `${settings.mediaServer}/music/.snowgloo/thumbnails/200x200/-${relativePath}`
    }
    else {
        let relativePath = absoluteFilePath.replace(settings.mediaServer + '/', '')
        relativePath = relativePath.replace('music/', '')
        relativePath = relativePath.replaceAll('/', '-') + '.jpg'
        return `${settings.mediaServer}/music/.snowgloo/thumbnails/200x200/-${relativePath}`
    }
}

const m3uEntry = (songDict) => {
    let m3u = ``
    m3u += `\n#EXTINF: ${songDict.AudioDuration},${songDict.Artist} - ${songDict.Title}`
    m3u += `\n#EXTALB: ${songDict.DisplayAlbum}`
    m3u += `\n#EXTIMG: ${songDict.CoverArt}`
    m3u += `\n${songDict.AudioUrl}`
    return m3u
}

module.exports = {
    searchify,
    sortify,
    alphabetize,
    contentHash,
    log,
    nginxMediaPath,
    nginxThumbnailPath,
    m3uEntry
}
