import { C, useAppContext, useAudioContext } from 'snowgroove'

export default function CrateDetailsPage(props) {
    const {
        currentRoute,
        navPush
    } = C.useSnowContext(props)


    const { addCrateToQueue } = useAudioContext()
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
            if (childCrate.album_cover_image_url) {
                return (
                    <C.SnowImageButton title={childCrate.title} imageUrl={childCrate.album_cover_image_url} onPress={navPush({
                        params: {
                            shelfId: currentRoute.routeParams.shelfId,
                            crateId: childCrate.id
                        },
                        replace: false
                    })} />
                )
            }
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
            <C.SnowSongList disableDrag audioFiles={crateDetails?.audio_files} />
        )
    }


    let crateControls = null
    if (crateDetails && crateDetails?.kind !== 'crate' && crateDetails?.kind !== 'crate-list') {
        crateControls = (
            <C.SnowGrid>
                <C.SnowTextButton title={`Add ${crateDetails.title} to Queue`} onPress={() => {
                    addCrateToQueue(crateDetails.id)
                }} />
            </C.SnowGrid>
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
                {admin}
                {crateControls}
                {parentCrates}
                {childCrates}
                {audioFiles}
            </C.SnowView>
        </C.FillView>
    )
}