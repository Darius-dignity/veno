import { once } from "node:events"

// Starts the REAL app (real routes, validation, multer, services, repositories,
// Mongoose models) on a random port, on top of the in-memory database.
// Pass env values to change limits or CORS for one test file.
export async function startApp(env = {}) {
  // Must be set BEFORE the app is imported: config/security.js reads them once
  Object.assign(process.env, {
    NODE_ENV: "test",
    DOTENV_CONFIG_QUIET: "true",
    CORS_ORIGINS: "http://localhost:5173",
    RATE_LIMIT_ADMIN_MAX: "100000",
    RATE_LIMIT_PUBLIC_MAX: "100000",
    ...env,
  })

  console.log = () => {} // silence the request logger

  const { fakeDb } = await import("./fake-db.js")
  const { default: app } = await import("../../app/app.afterware.js")

  const server = app.listen(0)
  await once(server, "listening")
  const base = `http://127.0.0.1:${server.address().port}`

  // request("POST", "/api/categories", { json: {...} })  or  { form: FormData }
  const request = async (method, path, { json, form, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } }

    if (json !== undefined) {
      init.headers["content-type"] = "application/json"
      init.body = typeof json === "string" ? json : JSON.stringify(json)
    }

    if (form) init.body = form

    const res = await fetch(base + path, init)
    const text = await res.text()

    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }

    return { status: res.status, headers: res.headers, body }
  }

  return {
    request,
    fakeDb,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
