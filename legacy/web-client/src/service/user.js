class UserService {
    constructor() {
        this.currentUser = localStorage.getItem('snowgloo-user')
    }
    isAuthenticated() {
        return !!this.currentUser
    }
    getUser() {
        return this.currentUser
    }
    login(user) {
        this.currentUser = user
        localStorage.setItem('snowgloo-user', user)
    }
    logout() {
        this.currentUser = null
        localStorage.removeItem('snowgloo-user')
    }
}

let instance
if (!instance) {
    instance = new UserService()
}

export default instance
