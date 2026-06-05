import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function CrateDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { playAudioFile } = useAudioContext()
    const { apiClient, routes, isAdmin } = useAppContext()
    const [crateList, setCrateList] = C.React.useState(null)
    const [crateDetails, setCrateDetails] = C.React.useState(null)

    C.React.useEffect(() => {
        if (crateList || crateDetails) {
            setCrateList(null)
            setCrateDetails(null)
        }
        apiClient.getCrate(
            currentRoute.routeParams.shelfId,
            currentRoute.routeParams.crateId
        ).then((response) => {
            if (response?.kind === 'crate-list') {
                setCrateList(response.items)
            } else {
                setCrateDetails(response.item)
            }
        })
    }, [currentRoute?.routeParams?.shelfId, currentRoute?.routeParams?.crateId])



    if (!crateDetails && !crateList) {
        return <C.SnowLabel center>Loading crate...</C.SnowLabel>
    }

    let parentCrates = null
    if (crateList?.length) {
        parentCrates = <C.SnowGrid items={crateList} renderItem={(parentCrate) => {
            return (
                <C.SnowTextButton title={parentCrate.title} onPress={navPush({
                    params: {
                        shelfId: currentRoute.routeParams.shelfId,
                        crateId: parentCrate.id
                    },
                    replace: false
                })} />
            )
        }} />
    }

    let childCrates = null
    if (crateDetails?.children?.length) {
        childCrates = <C.SnowGrid items={crateDetails.children} renderItem={(childCrate) => {
            return (
                <C.SnowTextButton title={childCrate.title} onPress={navPush({
                    params: {
                        shelfId: currentRoute.routeParams.shelfId,
                        crateId: childCrate.id
                    },
                    replace: false
                })} />
            )
        }} />
    }

    let audioFiles = null
    if (crateDetails?.audio_files?.length) {
        audioFiles = (
            <C.SnowDraggableColumn
                title="Songs"
                items={crateDetails?.audio_files}
                renderItem={(item) => {
                    return (
                        <C.SnowView>
                            <C.SnowText>{item.position} - {item.title}</C.SnowText>
                        </C.SnowView>
                    )
                }}
                onPress={(item) => {
                    playAudioFile(item)
                }}
            />
        )
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
    return (
        <C.FillView>
            <C.SnowView>
                {parentCrates}
                {childCrates}
                {audioFiles}
            </C.SnowView>
        </C.FillView>
    )
}