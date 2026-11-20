import { describe, it, expect, afterEach, jest } from "@jest/globals"
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
  errorHandler(error, req, res, () => { throw new Error("next() must not be called") })
  return res
}

const withEnv = (value, fn) => {
  const old = process.env.NODE_ENV
  process.env.NODE_ENV = value
  try { return fn() } finally { process.env.NODE_ENV = old }
}

describe("error handler", () => {
  afterEach(() => jest.restoreAllMocks())

  it("turns one of our errors into the JSON format, keeping status, code and details", () => {
    const error = Object.assign(new Error("A category with this name already exists"), {
      statusCode: 409, code: "CATEGORY_ALREADY_EXISTS", details: { name: "Coffee" },
    })

    const res = run(error, makeReq("POST", "/api/categories"))

    expect(res.code).toBe(409)
    expect(res.body.success).toBe(false)
    expect(res.body.status).toBe(409)
    expect(res.body.code).toBe("CATEGORY_ALREADY_EXISTS")
    expect(res.body.error).toBe("Conflict")
    expect(res.body.message).toBe("A category with this name already exists")
    expect(res.body.details).toEqual({ name: "Coffee" })
    expect(res.body.explanation.length > 10).toBeTruthy()
    expect(res.body.path).toBe("/api/categories")
    expect(res.body.method).toBe("POST")
    expect(!Number.isNaN(Date.parse(res.body.timestamp))).toBeTruthy()
    expect("debug" in res.body).toBe(false)
  })

  it("does not echo the query string back (it may contain secrets)", () => {
    const res = run(Object.assign(new Error("x"), { statusCode: 400, code: "X" }), makeReq("GET", "/api/x?token=secret"))
    expect(res.body.path).toBe("/api/x")
    expect(JSON.stringify(res.body).includes("secret")).toBe(false)
  })

  it("an unexpected bug becomes a generic 500 and the internal message is never shown", () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    const res = run(new TypeError("password is 1234"), makeReq("GET", "/api/items"))

    expect(res.code).toBe(500)
    expect(res.body.code).toBe("INTERNAL_SERVER_ERROR")
    expect(res.body.message).toBe("Internal server error")
    expect(res.body.message.includes("1234")).toBe(false)
  })

  it("production: no debug info and nothing internal leaks; development: debug shows the real cause", () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    const bug = () => new TypeError("secret internal detail")

    const prod = withEnv("production", () => run(bug()))
    expect("debug" in prod.body).toBe(false)
    expect(JSON.stringify(prod.body).includes("secret internal detail")).toBe(false)

    const dev = withEnv("development", () => run(bug()))
    expect(dev.body.debug.message).toBe("secret internal detail")
    expect(dev.body.message).toBe("Internal server error")
  })

  it("server errors are logged with their cause; client errors are not logged", () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {})

    run(Object.assign(new Error("not found"), { statusCode: 404, code: "X_NOT_FOUND" }))
    expect(log.mock.calls.length).toBe(0)

    run(new Error("boom"))
    expect(log.mock.calls.length).toBe(1)
  })

  it("our own 5xx errors keep their safe message and code (database error)", () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    const error = Object.assign(new Error("Database operation failed"), {
      statusCode: 500, code: "CATEGORY_DATABASE_ERROR", cause: new Error("connection lost"),
    })

    const res = withEnv("production", () => run(error))
    expect(res.body.code).toBe("CATEGORY_DATABASE_ERROR")
    expect(res.body.message).toBe("Database operation failed")
    expect(JSON.stringify(res.body).includes("connection lost")).toBe(false)
  })

  it("express.json() errors: broken JSON -> 400 INVALID_JSON, too large -> 413", () => {
    const broken = run(Object.assign(new SyntaxError("Unexpected token"), { type: "entity.parse.failed", status: 400 }))
    expect(broken.code).toBe(400)
    expect(broken.body.code).toBe("INVALID_JSON")

    const big = run(Object.assign(new Error("too large"), { type: "entity.too.large", status: 413, limit: 102400 }))
    expect(big.code).toBe(413)
    expect(big.body.code).toBe("PAYLOAD_TOO_LARGE")
  })

  it("odd errors: invalid status becomes 500, a thrown string works, a library .status is used", () => {
    jest.spyOn(console, "error").mockImplementation(() => {})
    expect(run(Object.assign(new Error("odd"), { statusCode: 999, code: "X" })).code).toBe(500)
    expect(run("a thrown string").code).toBe(500)

    const teapot = run(Object.assign(new Error("Teapot"), { status: 418 }))
    expect(teapot.code).toBe(418)
    expect(teapot.body.code).toBe("I_M_A_TEAPOT")
  })

  it("if the response already started it hands the error to Express and writes nothing", () => {
    const res = makeRes()
    res.headersSent = true
    let passed = null

    errorHandler(new Error("late"), makeReq(), res, (error) => { passed = error })

    expect(passed.message).toBe("late")
    expect(res.body).toBe(null)
  })
})

describe("not found middleware", () => {
  it("creates a 404 ROUTE_NOT_FOUND error with method and path (no query string)", () => {
    let error = null
    notFound(makeReq("PUT", "/api/categories?x=1"), {}, (e) => { error = e })

    expect(error.statusCode).toBe(404)
    expect(error.code).toBe("ROUTE_NOT_FOUND")
    expect(error.details).toEqual({ method: "PUT", path: "/api/categories" })
  })
})
