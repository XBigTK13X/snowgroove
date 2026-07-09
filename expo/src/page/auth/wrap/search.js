import { C, useAppContext } from 'snowgroove'

export default function SearchPage() {
    const { apiClient, routes } = useAppContext()
    const { navPush, currentRoute } = C.useSnowContext()

    const [queryText, setQueryText] = C.React.useState('')
    const queryTextRef = C.React.useRef(queryText)
    const [searchResults, setSearchResults] = C.React.useState(null)
    const [resultKey, setResultKey] = C.React.useState(null)
    const [loading, setLoading] = C.React.useState(false)

    C.React.useEffect(() => {
        let query = currentRoute?.routeParams?.queryText
        if (query && query !== queryTextRef.current) {
            setQueryText(query)
            queryTextRef.current = query
            if (query?.length > 1) {
                setLoading(true)
                apiClient.search(query).then(response => {
                    if (queryTextRef.current === query) {
                        setSearchResults(response)
                        setResultKey(`query-${query}`)
                    }
                    setLoading(false)
                })
            }
        }
    }, [currentRoute])

    const executeQuery = (input) => {
        navPush({
            params: {
                ...currentRoute?.routeParams,
                queryText: input ?? queryText
            },
            func: false
        })
    }

    let resultsTabs = null
    if (searchResults) {
        if (!searchResults.length) {
            resultsTabs = <C.SnowText>No results found for [{queryText}].</C.SnowText>
        }
        else {
            let headers = searchResults.map(searchResult => {
                return `${searchResult.name} [${searchResult.items.length}]`
            })
            resultsTabs = (
                <C.SnowTabs yy={1} key={resultKey} focusKey="search-results" headers={headers}>
                    {searchResults.map((searchResult, resultIndex) => {
                        if (searchResult.kind === 'artists') {
                            return <C.SnowGrid items={searchResult.items} renderItem={(crate) => {
                                return (
                                    <C.SnowTextButton
                                        title={crate.title}
                                        onPress={navPush({
                                            path: routes.crateDetails,
                                            params: {
                                                crateId: crate.id
                                            }
                                        })} />
                                )
                            }} />
                        }
                        if (searchResult.kind === 'albums') {
                            return <C.SnowGrid items={searchResult.items} renderItem={(crate) => {
                                return (
                                    <C.SnowImageButton
                                        title={crate.title}
                                        imageUrl={crate.album_cover_image_url}
                                        onPress={navPush({
                                            path: routes.crateDetails,
                                            params: {
                                                crateId: crate.id
                                            }
                                        })} />
                                )
                            }} />
                        }
                        if (searchResult.kind.includes('audio_files')) {
                            return <C.SnowSongList disableDrag audioFiles={searchResult.items} />
                        }
                        return <C.SnowText>No handler for {searchResult.kind}</C.SnowText>
                    })}
                </C.SnowTabs>
            )
        }
    }

    return (
        <C.SnowGrid
            assignFocus={false}
            itemsPerRow={1}>
            <C.SnowLabel>Enter a search query</C.SnowLabel>
            <C.SnowInput
                yy={0}
                focusStart
                focusKey="page-entry"
                value={queryText}
                onValueChange={setQueryText}
                onSubmit={executeQuery}
                onDebounce={setQueryText} />
            {loading && !searchResults ? <C.SnowText center>Searching for [{queryText}]...</C.SnowText> : null}
            {resultsTabs}
        </C.SnowGrid>
    )
}
