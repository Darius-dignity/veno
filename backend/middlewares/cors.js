import cors from "cors"
import security from "../config/security.js"

class CorsOriginError extends Error {
  constructor(origin) {
    super(`Origin ${origin} is not allowed`)
    this.name = "CorsOriginError"
    this.statusCode = 403
    this.code = "CORS_ORIGIN_NOT_ALLOWED"
    this.details = { origin }
  }
}

const allowedOrigins = new Set(security.corsOrigins)

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // No Origin header = not a browser (Postman, curl, server to server).
    // CORS is a browser rule, so these requests are allowed.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true)
    }

    // An error (not just "false") so the request is stopped with a JSON 403
    // instead of being processed without CORS headers
    callback(new CorsOriginError(origin))
  },
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // Lets the React app read these response headers (for example on a 429)
  exposedHeaders: ["Retry-After", "RateLimit", "RateLimit-Policy"],
  credentials: true,
  maxAge: 600, // the browser may cache the preflight answer for 10 minutes
})

export default corsMiddleware
