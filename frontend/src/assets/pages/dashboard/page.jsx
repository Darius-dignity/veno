import useSWR from "swr"

const DashboardPage = () => {

    const { data } = useSWR("/api/categories")

    return (
        <div>
        Actual Page
        <p>
            { JSON.stringify(data) }
        </p>
        </div>
    )
}

export default DashboardPage