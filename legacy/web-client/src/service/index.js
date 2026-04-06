const services = {
    api: require('./snowgloo-api-client').default,
    musicQueue: require('./music-queue').default,
    user: require('./user').default,
}

export default services
