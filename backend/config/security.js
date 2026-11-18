import env from "./env.js"

const toNumber = (value, fallback) => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

const toList = (value, fallback) => {
  const list = String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return list.length > 0 ? list : fallback
}

export default {
  // Browser origins allowed to call the API (your React app). Comma-separated in .env
  corsOrigins: toList(env.cors, ["http://localhost:5173"]),

  // Number of reverse proxies (nginx, a load balancer...) in front of the app.
  // 0 = none: the client IP is the direct connection.
  // Needed so rate limiting sees the real client IP instead of the proxy's IP.
  trustProxy: Math.floor(toNumber(env.trust_proxy, 0)),

  rateLimit: {
    windowMs: toNumber(env.rate_limit_window, 60 * 1000), // 1 minute
    publicMax: toNumber(env.rate_limit_public, 300), // customers: lenient
    adminMax: toNumber(env.rate_limit_admin, 30), // admin: strict
  },
}
