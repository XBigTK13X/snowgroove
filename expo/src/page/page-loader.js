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
        background: 'black',
        text: 'rgb(235, 235, 235)',
        textDark: 'rgb(22, 22, 22)',
        active: 'rgb(150, 150, 150)',
        hover: 'rgb(255, 246, 119)',
        hoverDark: 'rgb(175, 177, 83)',
        core: 'rgb(172,3,244)',
        coreDark: 'rgb(100, 0, 143)',
        outlineDark: 'rgb(63, 63, 63)',
        fade: 'rgb(23, 23, 23)',
        transparentDark: 'rgba(0,0,0,0.6)',
        panel: 'rgb(50,50,50)'
    }
}

const SnowApp = Snow.createSnowApp({
    enableSentry: true,
    sentryUrl: "https://b6f47194af564b55a3e1f404dcde8c49@bugsink.9914.us/6",
    appName: "snowgroove",
    appVersion: pkg.version
})

function PageWrapper() {
    const { CurrentPage, currentRoute } = Snow.useSnowContext()
    const { routes } = useAppContext()
    if (currentRoute.routePath === routes.signIn || currentRoute.routePath === '/') {
        return <CurrentPage />
    }
    return <AuthPageLoader />
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
        >
            <AudioContextProvider>
                <AppContextProvider>
                    <Snow.View style={{ flex: 1, paddingBottom: 50 }}>
                        <PageWrapper />
                    </Snow.View>
                </AppContextProvider >
            </AudioContextProvider>
        </SnowApp>
    )
}
