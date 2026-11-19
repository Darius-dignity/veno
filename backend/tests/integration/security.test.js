import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { startApp } from "../helpers/test-app.js"

// small limits so the tests are quick; TRUST_PROXY=1 lets each test pretend to be a different IP
let app
before(async () => {
  app = await startApp({
    RATE_LIMIT_ADMIN_MAX: "3",
    RATE_LIMIT_PUBLIC_MAX: "6",
    TRUST_PROXY: "1",
    CORS_ORIGINS: "http://localhost:5173,https://menu.example.com",
  })
})
after(() => app.close())

const from = (ip, extra = {}) => ({ "x-forwarded-for": ip, ...extra })
const ID = "64b7f0a2c3d4e5f607182931"

describe("JSON errors, never HTML", () => {
  it("an unknown path and an unsupported method are 404 ROUTE_NOT_FOUND as JSON", async () => {
    const unknown = await app.request("GET", "/api/nothing?token=secret", { headers: from("10.1.0.1") })

    assert.equal(unknown.status, 404)
    assert.match(unknown.headers.get("content-type"), /application\/json/)
    assert.equal(unknown.body.code, "ROUTE_NOT_FOUND")
    assert.deepEqual(unknown.body.details, { method: "GET", path: "/api/nothing" })
    assert.equal(JSON.stringify(unknown.body).includes("secret"), false)

    const wrongMethod = await app.request("PUT", "/api/categories", { headers: from("10.1.0.1") })
    assert.equal(wrongMethod.status, 404)
    assert.equal(wrongMethod.body.code, "ROUTE_NOT_FOUND")
  })

  it("broken JSON is 400 INVALID_JSON and a body over 100 KB is 413", async () => {
    const broken = await app.request("POST", "/api/categories", { json: '{"name": "Coffee",', headers: from("10.1.0.2") })
    assert.equal(broken.status, 400)
    assert.equal(broken.body.code, "INVALID_JSON")

    const big = await app.request("POST", "/api/categories", { json: { name: "x", description: "y".repeat(300 * 1024) }, headers: from("10.1.0.2") })
    assert.equal(big.status, 413)
    assert.equal(big.body.code, "PAYLOAD_TOO_LARGE")
  })

  it("every error has the full JSON shape", async () => {
    const { body } = await app.request("POST", "/api/categories", { json: {}, headers: from("10.1.0.3") })

    for (const key of ["success", "status", "code", "error", "message", "explanation", "details", "path", "method", "timestamp"]) {
      assert.ok(key in body, `missing ${key}`)
    }
    assert.equal(body.success, false)
  })
})

describe("rate limiting (per IP address)", () => {
  it("admin APIs are strict: after 3 requests the 4th is 429 RATE_LIMIT_EXCEEDED with Retry-After", async () => {
    const headers = from("10.2.0.1")
    for (let i = 0; i < 3; i++) assert.notEqual((await app.request("GET", "/api/categories", { headers })).status, 429)

    const blocked = await app.request("GET", "/api/categories", { headers })

    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.code, "RATE_LIMIT_EXCEEDED")
    assert.equal(blocked.body.details.limit, 3)
    assert.ok(blocked.body.details.retryAfterSeconds > 0)
    assert.ok(Number(blocked.headers.get("retry-after")) > 0)
    assert.match(blocked.headers.get("content-type"), /application\/json/)
  })

  it("all admin APIs (categories AND items, every method) share one counter", async () => {
    const headers = from("10.2.0.2")
    await app.request("GET", "/api/categories", { headers })
    await app.request("GET", "/api/items", { headers })
    await app.request("POST", "/api/categories", { json: {}, headers })

    assert.equal((await app.request("DELETE", `/api/items/${ID}`, { headers })).status, 429)
  })

  it("a blocked request is stopped before validation (a bad body gives 429, not 400)", async () => {
    const headers = from("10.2.0.3")
    for (let i = 0; i < 3; i++) await app.request("GET", "/api/items", { headers })

    assert.equal((await app.request("POST", "/api/items", { json: {}, headers })).status, 429)
  })

  it("customer APIs are lenient (6 here) and have their own counter: admin limits do not affect them", async () => {
    const headers = from("10.2.0.4")
    for (let i = 0; i < 4; i++) await app.request("GET", "/api/categories", { headers }) // exhaust ADMIN

    for (let i = 0; i < 6; i++) assert.equal((await app.request("GET", "/api/categories/menu", { headers })).status, 200)
    assert.equal((await app.request("GET", "/api/categories/menu", { headers })).status, 429)

    // the item menu shares the customer counter
    assert.equal((await app.request("GET", `/api/items/menu/${ID}`, { headers })).status, 429)
  })

  it("another IP address is not affected", async () => {
    for (let i = 0; i < 4; i++) await app.request("GET", "/api/categories", { headers: from("10.2.0.5") })

    assert.equal((await app.request("GET", "/api/categories", { headers: from("10.2.0.6") })).status, 200)
  })
})

describe("CORS and helmet", () => {
  it("an allowed browser origin gets CORS headers (both origins from CORS_ORIGINS)", async () => {
    for (const origin of ["http://localhost:5173", "https://menu.example.com"]) {
      const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.1", { origin }) })

      assert.equal(res.status, 200)
      assert.equal(res.headers.get("access-control-allow-origin"), origin)
      assert.equal(res.headers.get("access-control-allow-credentials"), "true")
    }
  })

  it("an origin that is not allowed is stopped with 403 CORS_ORIGIN_NOT_ALLOWED (JSON), also on preflight", async () => {
    const headers = from("10.3.0.2", { origin: "https://evil.example" })

    const normal = await app.request("GET", "/api/categories/menu", { headers })
    assert.equal(normal.status, 403)
    assert.equal(normal.body.code, "CORS_ORIGIN_NOT_ALLOWED")
    assert.equal(normal.headers.get("access-control-allow-origin"), null)

    const preflight = await app.request("OPTIONS", "/api/categories", { headers: { ...headers, "access-control-request-method": "DELETE" } })
    assert.equal(preflight.status, 403)
  })

  it("preflight from an allowed origin is answered (204) and never counted by the rate limit", async () => {
    const headers = from("10.3.0.3", { origin: "http://localhost:5173", "access-control-request-method": "PATCH" })

    for (let i = 0; i < 10; i++) {
      const res = await app.request("OPTIONS", "/api/categories", { headers })
      assert.equal(res.status, 204)
      assert.match(res.headers.get("access-control-allow-methods"), /PATCH/)
    }

    assert.equal((await app.request("GET", "/api/categories", { headers: from("10.3.0.3") })).status, 200)
  })

  it("requests without an Origin header (Postman, curl) are allowed", async () => {
    const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.4") })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get("access-control-allow-origin"), null)
  })

  it("helmet is active: X-Powered-By is hidden and nosniff is set", async () => {
    const res = await app.request("GET", "/api/categories/menu", { headers: from("10.3.0.5") })

    assert.equal(res.headers.get("x-powered-by"), null)
    assert.equal(res.headers.get("x-content-type-options"), "nosniff")
  })
})
