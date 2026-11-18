import rateLimit from "express-rate-limit"
import security from "../config/security.js"

class RateLimitError extends Error {
  constructor({ limit, windowMs, retryAfterSeconds }) {
    super("Too many requests, please slow down")
    this.name = "RateLimitError"
    this.statusCode = 429
    this.code = "RATE_LIMIT_EXCEEDED"
    this.details = {
      limit,
      windowSeconds: Math.round(windowMs / 1000),
      retryAfterSeconds,
    }
  }
}

// Counts requests per client IP address (the library's default key is req.ip).
// Each limiter keeps its own counter, so admin and public requests do not
// affect each other.
const createLimiter = ({ limit }) =>
  rateLimit({
    windowMs: security.rateLimit.windowMs,
    limit,
    standardHeaders: "draft-7", // sends RateLimit and RateLimit-Policy headers
    legacyHeaders: false, // no old X-RateLimit-* headers
    // Does not answer itself: hands over to the error handler,
    // so a 429 has the same JSON format as every other error
    handler: (req, res, next, options) => {
      const retryAfterSeconds =
        Number(res.getHeader("Retry-After")) ||
        Math.ceil(options.windowMs / 1000)

      next(
        new RateLimitError({
          limit: options.limit,
          windowMs: options.windowMs,
          retryAfterSeconds,
        })
      )
    },
  })

// Customer APIs (the public menu): lenient.
// Many customers can share one IP (for example a cafe's Wi-Fi), so it is high.
const publicLimiter = createLimiter({ limit: security.rateLimit.publicMax })

// Admin APIs (create, edit, delete, list, get one): strict.
const adminLimiter = createLimiter({ limit: security.rateLimit.adminMax })

export default {
  publicLimiter,
  adminLimiter,
}
