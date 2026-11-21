import useSWR from "swr"

const DashboardPage = () => {

    const { data } = useSWR("/api/categories")

    return (
        <div>
            Actual Page
            <p>
                Dashboard Page
            </p>
        </div>
    )
}

export default DashboardPage