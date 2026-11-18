import app from "./app.route.js"
import notFound from "../middlewares/notfound.js"
import errorHandler from "../middlewares/errorhandler.js"

// Must stay last, in this order:
// 1. notFound: no route matched the request -> creates a 404 error
// 2. errorHandler: every error from the whole app ends here and becomes JSON
app.use(notFound)
app.use(errorHandler)

export default app