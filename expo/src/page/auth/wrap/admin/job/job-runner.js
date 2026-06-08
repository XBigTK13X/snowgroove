import Snow from 'expo-snowui'
import { C, useAppContext } from 'snowgroove'

export default function ShelfEditPage() {
    const { navPush, currentRoute } = Snow.useSnowContext()
    const { apiClient, routes } = useAppContext()

    const [form, setForm] = C.React.useState({
        skipExisting: currentRoute.routeParams.skipExisting ?? '',
        targetDirectory: currentRoute.routeParams.targetDirectory ?? '',
        targetId: currentRoute.routeParams.targetId ?? '',
        targetKind: currentRoute.routeParams.targetKind ?? ''
    })
    const formRef = C.React.useRef(form)

    C.React.useEffect(() => {
        formRef.current = form
    })

    const createJob = (apiCall) => {
        let params = {}
        if (formRef.current.skipExisting !== '') {
            params.skipExisting = formRef.current.skipExisting
        }
        if (formRef.current.targetDirectory !== '') {
            params.targetDirectory = formRef.current.targetDirectory
        }
        if (formRef.current.targetId !== '') {
            params.targetId = formRef.current.targetId
        }
        if (formRef.current.targetKind !== '') {
            params.targetKind = formRef.current.targetKind
        }
        navPush({ params, func: false })
        let details = {
            skipExisting: formRef.current.skipExisting,
            targetDirectory: formRef.current.targetDirectory,
            targetId: formRef.current.targetId,
            targetKind: formRef.current.targetKind
        }
        return apiCall(details)
    }

    const buttons = [
        { name: 'Apply Directory Tag', apiCall: apiClient.createJobApplyDirectoryTag },
        { name: 'Clean File Records', apiCall: apiClient.createJobCleanFileRecords },
        { name: 'Delete Cached Text', apiCall: apiClient.deleteAllCachedText },
        { name: 'Delete Media Records', apiCall: apiClient.createJobDeleteMediaRecords },
        { name: 'Read Media Files', apiCall: apiClient.createJobReadMediaFiles },
        { name: 'Scan Shelves', apiCall: apiClient.createJobShelvesScan },
        { name: 'Scan Remote Players', apiCall: apiClient.createJobRemotePlayersScan },
    ]

    const renderItem = (item) => {
        return <C.SnowTextButton
            tall
            title={item.name}
            onPress={() => {
                createJob(item.apiCall).then(job => {
                    if (item.name !== 'Delete Cached Text') {
                        navPush({
                            path: routes.adminJobDetails,
                            params: {
                                jobId: job.id
                            },
                            func: false
                        })
                    }
                })
            }}
        />
    }

    const changeForm = (key) => {
        return (val) => {
            setForm((prev) => {
                let result = { ...prev }
                result[key] = val
                return result
            })
        }
    }

    return (
        <>
            <C.SnowGrid
                focusStart
                focusKey="page-entry"
                itemsPerRow={3}
                items={buttons}
                renderItem={renderItem} />
            <C.SnowGrid focusKey="payload" itemsPerRow={2}>
                <C.SnowLabel>Target Directory</C.SnowLabel>
                <C.SnowInput onValueChange={changeForm('targetDirectory')} value={form.targetDirectory} />
                <C.SnowLabel>Target Kind</C.SnowLabel>
                <C.SnowInput onValueChange={changeForm('targetKind')} value={form.targetKind} />
                <C.SnowLabel>Target Id</C.SnowLabel>
                <C.SnowInput onValueChange={changeForm('targetId')} value={form.targetId} />
                <C.SnowLabel>Skip Existing</C.SnowLabel>
                <C.SnowInput onValueChange={changeForm('skipExisting')} value={form.skipExisting} />
            </C.SnowGrid>
        </>
    )
}
