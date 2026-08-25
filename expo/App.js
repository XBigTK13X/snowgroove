const originalLog = console.log
console.log = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('Native module loaded')) {
        return
    }
    originalLog(...args)
}

const originalError = console.error
console.error = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes('VirtualizedLists should never be nested')) {
        return
    }
    originalError(...args)
}

import { LogBox } from 'react-native'
import PageLoader from "./src/page/page-loader"

LogBox.ignoreLogs([
    /VirtualizedLists should never be nested/
])

export default PageLoader