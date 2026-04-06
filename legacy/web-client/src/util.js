const pad = (num) => {
    if (num < 10) {
        return '0' + num
    }
    return num
}

const trackPad = (num) => {
    if (num < 10) {
        return '00' + num
    }
    if (num < 100) {
        return '0' + num
    }
    return num
}

const breakdown = (seconds) => {
    let ticks = seconds
    let hh = Math.floor(ticks / 3600)
    let mm = Math.floor((ticks % 3600) / 60)
    let ss = Math.floor(ticks % 60)
    return {
        hours: hh,
        minutes: mm,
        seconds: ss,
    }
}

const secondsToTimeStamp = (seconds) => {
    const b = breakdown(seconds)
    let timestamp = `${pad(b.seconds)}s`
    if (b.minutes || b.hours) {
        timestamp = `${pad(b.minutes)}m ${timestamp}`
    }
    if (b.hours) {
        timestamp = `${pad(b.hours)}h ${timestamp}`
    }
    return timestamp
}

const log = (...args) => {
    if (typeof console !== 'undefined') {
        console.log.apply(console, args)
    }
}

const funcs = {
    secondsToTimeStamp,
    trackPad,
    log,
}

export default funcs
