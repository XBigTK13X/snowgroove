import pkg from "../../package.json";
import React from 'react'
import Snow from 'expo-snowui'
import {
    config,
    AudioContextProvider,
    AppContextProvider,
    useAppContext,
} from 'snowgroove'
import { routes } from '../routes'
import { pages } from '../pages'
import AuthPageLoader from './auth/auth-page-loader'

const appStyle = {
    color: {
        background: '#000000',
        text: '#EBEBEB',
        textDark: '#161616',
        active: '#969696',
        hover: '#FFF677',
        hoverDark: '#AFB153',
        core: '#AC03F4',
        coreDark: '#64008F',
        outlineDark: '#3F3F3F',
        fade: '#171717',
        transparentDark: '#00000099',
        panel: '#323232',
    }
}

const SnowApp = Snow.createSnowApp({
    enableSentry: true,
    sentryUrl: "https://b6f47194af564b55a3e1f404dcde8c49@bugsink.9914.us/6",
    appName: "snowgroove",
    appVersion: pkg.version
})

function PageWrapper(props) {
    const { CurrentPage, currentRoute, SnowStyle } = Snow.useSnowContext(props)
    const { routes } = useAppContext()

    let appWrapperStyle = { flex: 1, paddingBottom: 50 }
    if (SnowStyle.isPortrait) {
        appWrapperStyle.paddingTop = 50
    }

    let interior = <AuthPageLoader />
    if (currentRoute.routePath === routes.signIn || currentRoute.routePath === '/') {
        interior = <CurrentPage />
    }
    return (
        <Snow.View style={appWrapperStyle}>
            {interior}
        </Snow.View>
    )
}

export default function PageLoader() {
    return (
        <SnowApp
            DEBUG_SNOW={config.debugSnowui}
            DEBUG_NAVIGATION={false}
            DEBUG_FOCUS={false}
            DEBUG_FOCUS_TREE={false}
            snowStyle={appStyle}
            routePaths={routes}
            routePages={pages}
            initialRoutePath={routes.signIn}
            fullscreen={false}
        >
            <AppContextProvider>
                <AudioContextProvider>
                    <Snow.View style={{ flex: 1, paddingBottom: 50 }}>
                        <PageWrapper />
                    </Snow.View>
                </AudioContextProvider>
            </AppContextProvider >

        </SnowApp>
    )
}
