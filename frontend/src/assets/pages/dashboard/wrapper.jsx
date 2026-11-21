import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"

import DashboardError from "./error.jsx"
import DashboardSkeleton from "./skeletone.jsx"
import DashboardPage from "./page.jsx"

const Dashboard = () => {
  return (
    <ErrorBoundary FallbackComponent={DashboardError}>
        <Suspense fallback={<DashboardSkeleton />}>
            <DashboardPage />
        </Suspense>
    </ErrorBoundary>
  )
}

export default Dashboard