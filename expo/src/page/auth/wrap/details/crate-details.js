import { C, useAppContext } from 'snowgroove'

export default function CrateDetailsPage(props) {
    const {
        currentRoute
    } = C.useSnowContext(props)


    const { apiClient, routes, isAdmin } = useAppContext()
    const [crate, setCrate] = C.React.useState(null)

    C.React.useEffect(() => {
        if (crate) {
            setCrate(null)
        }
        apiClient.getCrate(
            currentRoute.routeParams.shelfId,
            currentRoute.routeParams.crateId
        ).then((response) => {
            setCrate(response)
        })
    }, [currentRoute?.routeParams?.shelfId, currentRoute?.routeParams?.crateId])



    if (!crate) {
        return <C.SnowLabel center>Loading crate...</C.SnowLabel>
    }


    let admin = null
    if (isAdmin) {
        admin = (
            <C.SnowGrid>
                <C.SnowCreateJobButton
                    title="Create Job"
                    jobDetails={{
                        targetId: currentRoute?.routeParams?.shelfId,
                        targetKind: 'shelf',
                        updateVideos: true,
                        skipExisting: false
                    }} />
            </C.SnowGrid>
        )
    }
    if (crate) {
        return (
            <C.FillView>
                <C.SnowView>
                </C.SnowView>
            </C.FillView>
        )
    }
}