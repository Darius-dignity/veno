const DashboardError = ({ error, resetErrorBoundary }) => {
  return (
    <div>
      Error!
      <h2>
        {error.message}
      </h2>
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  )
}

export default DashboardError