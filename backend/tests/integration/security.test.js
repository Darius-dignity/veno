import { describe, it, expect, beforeAll, afterAll } from "@jest/globals"
import { startApp } from "../helpers/test-app.js"

// small limits so the tests are quick; TRUST_PROXY=1 lets each test pretend to be a different IP
let app
beforeAll(async () => {
  app = await startApp({
    RATE_LIMIT_ADMIN_MAX: "3",
    RATE_LIMIT_PUBLIC_MAX: "6",
    TRUST_PROXY: "1",
    CORS_ORIGINS: "http://localhost:5173,https://menu.example.com",
  })
})
afterAll(() => app.close())

const from = (ip, extra = {}) => ({ "x-forwarded-for": ip, ...extra })
const ID = "64b7f0a2c3d4e5f607182931"

describe("JSON errors, never HTML", () => {
  it("an unknown path and an unsupported method are 404 ROUTE_NOT_FOUND as JSON", async () => {
    const unknown = await app.request("GET", "/api/nothing?token=secret", { headers: from("10.1.0.1") })

    expect(unknown.status).toBe(404)
    expect(unknown.headers.get("content-type")).toMatch(/application\/json/)
    expect(unknown.body.code).toBe("ROUTE_NOT_FOUND")
    expect(unknown.body.details).toEqual({ method: "GET", path: "/api/nothing" })
    expect(JSON.stringify(unknown.body).includes("secret")).toBe(false)

    const wrongMethod = await app.request("PUT", "/api/categories", { headers: from("10.1.0.1") })
    expect(wrongMethod.status).toBe(404)
    expect(wrongMethod.body.code).toBe("ROUTE_NOT_FOUND")
  })

  it("broken JSON is 400 INVALID_JSON and a body over 100 KB is 413", async () => {
    const broken = await app.request("POST", "/api/categories", { json: '{"name": "Coffee",', headers: from("10.1.0.2") })
    expect(broken.status).toBe(400)
    expect(broken.body.code).toBe("INVALID_JSON")

    const big = await app.request("POST", "/api/categories", { json: { name: "x", description: "y".repeat(300 * 1024) }, headers: from("10.1.0.2") })
    expect(big.status).toBe(413)
    expect(big.body.code).toBe("PAYLOAD_TOO_LARGE")
  })

  it("every error has the full JSON shape", async () => {
    const { body } = await app.request("POST", "/api/categories", { json: {}, headers: from("10.1.0.3") })

    for (const key of ["success", "status", "code", "error", "message", "explanation", "details", "path", "method", "timestamp"]) {
      expect(key in body).toBeTruthy()
    }
    expect(body.success).toBe(false)
  })
})

describe("rate limiting (per IP address)", () => {
  it("admin APIs are strict: after 3 requests the 4th is 429 RATE_LIMIT_EXCEEDED with Retry-After", async () => {
    const headers = from("10.2.0.1")
    for (let i = 0; i < 3; i++) expect((await app.request("GET", "/api/categories", { headers })).status).not.toBe(429)

    const blocked = await app.request("GET", "/api/categories", { headers })

    expect(blocked.status).toBe(429)
    expect(blocked.body.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(blocked.body.details.limit).toBe(3)
    expect(blocked.body.details.retryAfterSeconds > 0).toBeTruthy()
    expect(Number(blocked.headers.get("retry-after")) > 0).toBeTruthy()
    expect(blocked.headers.get("content-type")).toMatch(/application\/json/)
  })

  it("all admin APIs (categories AND items, every method) share one counter", async () => {
    const headers = from("10.2.0.2")
    await app.request("GET", "/api/categories", { headers })
    await app.request("GET", "/api/items", { headers })
    await app.request("POST", "/api/categories", { json: {}, headers })

    expect((await app.request("DELETE", `/api/items/${ID}`, { headers })).status).toBe(429)
  })

  it("a blocked request is stopped before validation (a bad body gives 429, not 400)", async () => {
    const headers = from("10.2.0.3")
    for (let i = 0; i < 3; i++) await app.request("GET", "/api/items", { headers })

    expect((await app.request("POST", "/api/items", { json: {}, headers })).status).toBe(429)
  })

  it("customer APIs are lenient (6 here) and have their own counter: admin limits do not affect them", async () => {
    const headers = from("10.2.0.4")
    for (let i = 0; i < 4; i++) await app.request("GET", "/api/categories", { headers }) // exhaust ADMIN

    for (let i = 0; i < 6; i++) expect((await app.request("GET", "/api/categories/menu", { headers })).status).toBe(200)
    expect((await app.request("GET", "/api/categories/menu", { headers })).status).toBe(429)

    // the item menu shares the customer counter
    expect((await app.request("GET", `/api/items/menu/${ID}`, { headers })).status).toBe(429)
  })

  it("another IP address is not affected", async () => {
    for (let i = 0; i < 4; i++) await app.request("GET", "/api/categories", { headers: from("10.2.0.5") })

    expect((await app.request("GET", "/api/categories", { headers: from("10.2.0.6") })).status).toBe(200)
  })
})

describe("CORS and helmet", () => {
  it("an allowed browser origin gets CORS headers (both origins from CORS_ORIGINS)", async () => {
    for (const origin of ["http://localhost:5173", "https://menu.example.com"]) {
      const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.1", { origin }) })

      expect(res.status).toBe(200)
      expect(res.headers.get("access-control-allow-origin")).toBe(origin)
      expect(res.headers.get("access-control-allow-credentials")).toBe("true")
    }
  })

  it("an origin that is not allowed is stopped with 403 CORS_ORIGIN_NOT_ALLOWED (JSON), also on preflight", async () => {
    const headers = from("10.3.0.2", { origin: "https://evil.example" })

    const normal = await app.request("GET", "/api/categories/menu", { headers })
    expect(normal.status).toBe(403)
    expect(normal.body.code).toBe("CORS_ORIGIN_NOT_ALLOWED")
    expect(normal.headers.get("access-control-allow-origin")).toBe(null)

    const preflight = await app.request("OPTIONS", "/api/categories", { headers: { ...headers, "access-control-request-method": "DELETE" } })
    expect(preflight.status).toBe(403)
  })

  it("preflight from an allowed origin is answered (204) and never counted by the rate limit", async () => {
    const headers = from("10.3.0.3", { origin: "http://localhost:5173", "access-control-request-method": "PATCH" })

    for (let i = 0; i < 10; i++) {
      const res = await app.request("OPTIONS", "/api/categories", { headers })
      expect(res.status).toBe(204)
      expect(res.headers.get("access-control-allow-methods")).toMatch(/PATCH/)
    }

    expect((await app.request("GET", "/api/categories", { headers: from("10.3.0.3") })).status).toBe(200)
  })

  it("requests without an Origin header (Postman, curl) are allowed", async () => {
    const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.4") })
    expect(res.status).toBe(200)
    expect(res.headers.get("access-control-allow-origin")).toBe(null)
  })

  it("helmet is active: X-Powered-By is hidden and nosniff is set", async () => {
    const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.5") })

    expect(res.headers.get("x-powered-by")).toBe(null)
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })
})
