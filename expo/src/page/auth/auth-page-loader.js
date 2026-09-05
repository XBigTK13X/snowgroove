import React from 'react'
import { C, useAppContext } from 'snowgroove'
import Snow, {
    SnowTextButton,
    SnowGrid,
    SnowBreak
} from 'expo-snowui'

const styles = {
    header: {
        width: '100%'
    }
}

function HeaderNav(props) {
    const { navPush, navPop } = C.useSnowContext()
    const { displayName, routes, isAdmin, signOut, targetPlayer } = useAppContext();

    return (
        <Snow.View yy={0} style={styles.header}>
            <SnowGrid
                itemsPerRow={3}
                focusKey="header" >
                <SnowTextButton
                    title="Sign Out"
                    short
                    onPress={signOut} />
                {isAdmin ? <SnowTextButton
                    title="Dashboard"
                    short
                    onPress={navPush({ path: routes.adminDashboard })} />
                    : null}
                <SnowTextButton
                    title={`Back`}
                    short
                    onPress={navPop(true)} />
            </SnowGrid>
            <SnowGrid
                itemsPerRow={2}
                focusKey="header-action" >
                <SnowTextButton
                    title="Library"
                    onPress={navPush({ path: routes.library })}
                />
                <C.SnowTextButton
                    title="Devices"
                    onPress={navPush({ path: routes.deviceList })}
                />
                <SnowTextButton
                    title="Playing"
                    onPress={navPush({ path: routes.landing })}
                />
                <SnowTextButton
                    title={targetPlayer?.name ?? "Queue"}
                    onPress={navPush({ path: routes.musicSessionDetails })}
                />
            </SnowGrid>
            <SnowBreak />
        </Snow.View >
    )
}

function SnowHeaderNavPage(props) {
    const { displayName, routes } = useAppContext();

    return (
        <Snow.View>
            <HeaderNav
                yy={0}
                displayName={displayName}
                routes={routes} />
            <Snow.View yy={1}>
                {props.children}
            </Snow.View>
        </Snow.View>
    )
}

export default function AuthPageLoader(props) {
    const { apiClient, session, sessionLoaded, isAdmin, routes } = useAppContext();
    const { CurrentPage, currentRoute, navPush } = Snow.useSnowContext()
    const [hasAuth, setHasAuth] = React.useState(false)

    React.useEffect(() => {
        if (!hasAuth) {
            if (currentRoute.routePath.includes('/auth/') && sessionLoaded && !session) {
                setHasAuth(true)
                navPush({ path: routes.signIn, func: false })
            }

            if (currentRoute.routePath.includes('/admin/') && sessionLoaded && !isAdmin) {
                setHasAuth(true)
                navPush({ path: routes.landing, func: false })
            }
        }
    }, [hasAuth, session, sessionLoaded, isAdmin, currentRoute])

    if (!apiClient) {
        return null
    }

    const hasHeader = currentRoute.routePath.includes('/wrap/')
    if (hasHeader) {
        return (
            <SnowHeaderNavPage>
                <CurrentPage />
            </SnowHeaderNavPage>
        )
    }
    return (
        <CurrentPage />
    )
}
