import express from "express"
import helmet from "helmet"
import logger from "../middlewares/logger.js"
import corsMiddleware from "../middlewares/cors.js"
import security from "../config/security.js"

const app = express()

// Behind a reverse proxy the client IP is in the X-Forwarded-For header.
// Set TRUST_PROXY=<number of proxies> in .env, otherwise rate limiting would
// count every client under the proxy's IP address.
if (security.trustProxy > 0) {
  app.set("trust proxy", security.trustProxy)
}

// First, so every request is logged, including blocked ones
app.use(logger)

// Security headers (hides X-Powered-By, adds nosniff, HSTS, frame protection...)
app.use(helmet())

// Browser access rules (also answers the preflight OPTIONS requests)
app.use(corsMiddleware)

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

export default app