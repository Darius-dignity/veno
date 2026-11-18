class RouteNotFoundError extends Error {
  constructor(method, path) {
    super(`Route ${method} ${path} does not exist`)
    this.name = "RouteNotFoundError"
    this.statusCode = 404
    this.code = "ROUTE_NOT_FOUND"
    this.details = { method, path }
  }
}

// Runs only when no route matched the request.
// It does not answer itself: it hands over to the error handler,
// so every error (including "route not found") has the same JSON format.
const notFound = (req, res, next) => {
  next(new RouteNotFoundError(req.method, req.originalUrl.split("?")[0]))
}

export default notFound
