import useSWR from "swr"

const DashboardPage = () => {

    const { response } = useSWR("/api/categories")

    return (
        <div>
        Actual Page
        <p>
            { JSON.stringify(response.data) }
        </p>
        </div>
    )
}

export default DashboardPage