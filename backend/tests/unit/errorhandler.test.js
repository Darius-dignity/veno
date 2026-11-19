import { describe, it, mock, afterEach } from "node:test"
import assert from "node:assert/strict"
import errorHandler from "../../middlewares/errorhandler.js"
import notFound from "../../middlewares/notfound.js"

const makeReq = (method = "GET", url = "/api/x") => ({ method, originalUrl: url })

const makeRes = () => {
  const res = {
    headersSent: false,
    code: null,
    body: null,
    status(code) { res.code = code; return res },
    json(body) { res.body = body; return res },
  }
  return res
}

const run = (error, req = makeReq()) => {
  const res = makeRes()
  errorHandler(error, req, res, () => assert.fail("next() must not be called"))
  return res
}

const withEnv = (value, fn) => {
  const old = process.env.NODE_ENV
  process.env.NODE_ENV = value
  try { return fn() } finally { process.env.NODE_ENV = old }
}

describe("error handler", () => {
  afterEach(() => mock.restoreAll())

  it("turns one of our errors into the JSON format, keeping status, code and details", () => {
    const error = Object.assign(new Error("A category with this name already exists"), {
      statusCode: 409, code: "CATEGORY_ALREADY_EXISTS", details: { name: "Coffee" },
    })

    const res = run(error, makeReq("POST", "/api/categories"))

    assert.equal(res.code, 409)
    assert.equal(res.body.success, false)
    assert.equal(res.body.status, 409)
    assert.equal(res.body.code, "CATEGORY_ALREADY_EXISTS")
    assert.equal(res.body.error, "Conflict")
    assert.equal(res.body.message, "A category with this name already exists")
    assert.deepEqual(res.body.details, { name: "Coffee" })
    assert.ok(res.body.explanation.length > 10)
    assert.equal(res.body.path, "/api/categories")
    assert.equal(res.body.method, "POST")
    assert.ok(!Number.isNaN(Date.parse(res.body.timestamp)))
    assert.equal("debug" in res.body, false)
  })

  it("does not echo the query string back (it may contain secrets)", () => {
    const res = run(Object.assign(new Error("x"), { statusCode: 400, code: "X" }), makeReq("GET", "/api/x?token=secret"))
    assert.equal(res.body.path, "/api/x")
    assert.equal(JSON.stringify(res.body).includes("secret"), false)
  })

  it("an unexpected bug becomes a generic 500 and the internal message is never shown", () => {
    mock.method(console, "error", () => {})
    const res = run(new TypeError("password is 1234"), makeReq("GET", "/api/items"))

    assert.equal(res.code, 500)
    assert.equal(res.body.code, "INTERNAL_SERVER_ERROR")
    assert.equal(res.body.message, "Internal server error")
    assert.equal(res.body.message.includes("1234"), false)
  })

  it("production: no debug info and nothing internal leaks; development: debug shows the real cause", () => {
    mock.method(console, "error", () => {})
    const bug = () => new TypeError("secret internal detail")

    const prod = withEnv("production", () => run(bug()))
    assert.equal("debug" in prod.body, false)
    assert.equal(JSON.stringify(prod.body).includes("secret internal detail"), false)

    const dev = withEnv("development", () => run(bug()))
    assert.equal(dev.body.debug.message, "secret internal detail")
    assert.equal(dev.body.message, "Internal server error")
  })

  it("server errors are logged with their cause; client errors are not logged", () => {
    const log = mock.method(console, "error", () => {})

    run(Object.assign(new Error("not found"), { statusCode: 404, code: "X_NOT_FOUND" }))
    assert.equal(log.mock.callCount(), 0)

    run(new Error("boom"))
    assert.equal(log.mock.callCount(), 1)
  })

  it("our own 5xx errors keep their safe message and code (database error)", () => {
    mock.method(console, "error", () => {})
    const error = Object.assign(new Error("Database operation failed"), {
      statusCode: 500, code: "CATEGORY_DATABASE_ERROR", cause: new Error("connection lost"),
    })

    const res = withEnv("production", () => run(error))
    assert.equal(res.body.code, "CATEGORY_DATABASE_ERROR")
    assert.equal(res.body.message, "Database operation failed")
    assert.equal(JSON.stringify(res.body).includes("connection lost"), false)
  })

  it("express.json() errors: broken JSON -> 400 INVALID_JSON, too large -> 413", () => {
    const broken = run(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", status: 400 }))
    assert.equal(broken.code, 400)
    assert.equal(broken.body.code, "INVALID_JSON")

    const big = run(Object.assign(new Error("too large"), { type: "entity.too.large", status: 413, limit: 102400 }))
    assert.equal(big.code, 413)
    assert.equal(big.body.code, "PAYLOAD_TOO_LARGE")
  })

  it("odd errors: invalid status becomes 500, a thrown string works, a library .status is used", () => {
    mock.method(console, "error", () => {})
    assert.equal(run(Object.assign(new Error("odd"), { statusCode: 999, code: "X" })).code, 500)
    assert.equal(run("a thrown string").code, 500)

    const teapot = run(Object.assign(new Error("Teapot"), { status: 418 }))
    assert.equal(teapot.code, 418)
    assert.equal(teapot.body.code, "I_M_A_TEAPOT")
  })

  it("if the response already started it hands the error to Express and writes nothing", () => {
    const res = makeRes()
    res.headersSent = true
    let passed = null

    errorHandler(new Error("late"), makeReq(), res, (error) => { passed = error })

    assert.equal(passed.message, "late")
    assert.equal(res.body, null)
  })
})

describe("not found middleware", () => {
  it("creates a 404 ROUTE_NOT_FOUND error with method and path (no query string)", () => {
    let error = null
    notFound(makeReq("PUT", "/api/categories?x=1"), {}, (e) => { error = e })

    assert.equal(error.statusCode, 404)
    assert.equal(error.code, "ROUTE_NOT_FOUND")
    assert.deepEqual(error.details, { method: "PUT", path: "/api/categories" })
  })
})
