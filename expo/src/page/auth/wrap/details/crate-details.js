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
    let childAlbums = null
    if (crateDetails?.children?.length) {
        let crates = crateDetails?.children?.filter(xx => { return !xx.album_cover_image_url })
        let albums = crateDetails?.children?.filter(xx => { return xx.album_cover_image_url })
        if (crates?.length) {
            childCrates = (
                <C.SnowView>
                    <C.SnowLabel center>Crates</C.SnowLabel>
                    <C.SnowGrid items={crates} renderItem={(childCrate) => {
                        return (
                            <C.SnowTextButton
                                title={childCrate.title}
                                onPress={navPush({
                                    params: {
                                        shelfId: currentRoute.routeParams.shelfId,
                                        crateId: childCrate.id
                                    },
                                    replace: false
                                })} />
                        )
                    }} />
                </C.SnowView>)
        }
        if (albums?.length) {
            childAlbums = (
                <C.SnowView>
                    <C.SnowLabel center>Albums</C.SnowLabel>
                    <C.SnowGrid items={albums} renderItem={(childAlbum) => {
                        return (
                            <C.SnowImageButton
                                title={childAlbum.title}
                                imageUrl={childAlbum.album_cover_image_url}
                                onPress={navPush({
                                    params: {
                                        shelfId: currentRoute.routeParams.shelfId,
                                        crateId: childAlbum.id
                                    },
                                    replace: false
                                })} />
                        )
                    }} />
                </C.SnowView>)
        }
    }

    let audioFiles = null
    if (crateDetails?.audio_files?.length) {
        audioFiles = (
            <C.SnowSongList disableDrag audioFiles={crateDetails?.audio_files} />
        )
    }


    let topButtons = []
    if (crateDetails && crateDetails?.kind !== 'crate' && crateDetails?.kind !== 'crate-list') {
        topButtons.push(
            <C.SnowTextButton title={`Add ${crateDetails.title} to Queue`} onPress={() => {
                addCrateToQueue(crateDetails.id)
            }} />
        )
    }

    if (isAdmin) {
        topButtons.push(
            <C.SnowCreateJobButton
                title="Create Job"
                jobDetails={{
                    targetId: currentRoute?.routeParams?.shelfId,
                    targetKind: 'shelf',
                    updateVideos: true,
                    skipExisting: false
                }} />
        )
    }
    return (
        <C.FillView>
            <C.SnowView>
                {topButtons?.length ? <C.SnowGrid items={topButtons} /> : null}
                {parentCrates}
                {childCrates}
                {childAlbums}
                {audioFiles}
            </C.SnowView>
        </C.FillView>
    )
}