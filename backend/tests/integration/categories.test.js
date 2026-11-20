import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals"
import { startApp } from "../helpers/test-app.js"

let app
beforeAll(async () => { app = await startApp() })
beforeEach(() => app.fakeDb.reset())
afterAll(() => app.close())

const post = (name, extra = {}) => app.request("POST", "/api/categories", { json: { name, ...extra } })
const ID_NOT_FOUND = "64b7f0a2c3d4e5f607189999"

describe("POST /api/categories", () => {
  it("creates a category with the defaults (201)", async () => {
    const { status, body } = await post("Coffee")

    expect(status).toBe(201)
    expect(typeof body.id).toBe("string")
    expect(body.name).toBe("Coffee")
    expect(body.description).toBe("")
    expect(body.isActive).toBe(true)
    expect(body.icon).toBe(null)
    expect(body.createdAt && body.updatedAt).toBeTruthy()
    expect("_id" in body).toBe(false)
  })

  it("a missing or empty name is a 400 VALIDATION_ERROR that points at the field", async () => {
    const inputs = [{}, { name: "" }, { name: "x".repeat(51) }]
    const results = []

    for (const json of inputs) {
      const { status, body } = await app.request("POST", "/api/categories", { json })
      results.push([status, body.code, body.details.map((d) => `${d.source}.${d.path}`)])
    }

    expect(results).toEqual(inputs.map(() => [400, "VALIDATION_ERROR", ["body.name"]]))
  })

  it("the same name twice is a 409 CATEGORY_ALREADY_EXISTS", async () => {
    await post("Coffee")
    const { status, body } = await post("Coffee")

    expect(status).toBe(409)
    expect(body.code).toBe("CATEGORY_ALREADY_EXISTS")
  })
})

describe("reading categories", () => {
  it("GET /:id returns it; unknown id is 404; bad id is 400", async () => {
    const { body: created } = await post("Coffee")

    expect((await app.request("GET", `/api/categories/${created.id}`)).body.name).toBe("Coffee")

    const missing = await app.request("GET", `/api/categories/${ID_NOT_FOUND}`)
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe("CATEGORY_NOT_FOUND")

    expect((await app.request("GET", "/api/categories/abc")).status).toBe(400)
  })

  it("the admin list can be filtered with ?isActive", async () => {
    await post("Coffee")
    await post("Tea", { isActive: false })

    const all = await app.request("GET", "/api/categories")
    const active = await app.request("GET", "/api/categories?isActive=true")

    expect(all.body.map((c) => c.name)).toEqual(["Coffee", "Tea"])
    expect(active.body.map((c) => c.name)).toEqual(["Coffee"])
    expect((await app.request("GET", "/api/categories?isActive=maybe")).status).toBe(400)
  })

  it("the public menu shows only ACTIVE categories, only {id, name, icon}, sorted by name", async () => {
    await post("Tea")
    await post("Coffee")
    await post("Hidden", { isActive: false })

    const { status, body } = await app.request("GET", "/api/categories/menu")

    expect(status).toBe(200)
    expect(body.map((c) => c.name)).toEqual(["Coffee", "Tea"])
    for (const category of body) expect(Object.keys(category)).toEqual(["id", "name", "icon"])
  })
})

describe("PATCH /api/categories/:id", () => {
  it("changes only the fields that were sent", async () => {
    const { body: created } = await post("Coffee", { description: "Hot" })
    const { status, body } = await app.request("PATCH", `/api/categories/${created.id}`, { json: { name: "Hot Coffee" } })

    expect(status).toBe(200)
    expect(body.name).toBe("Hot Coffee")
    expect(body.description).toBe("Hot")
  })

  it("renaming to another category's name is a 409", async () => {
    await post("Tea")
    const { body: coffee } = await post("Coffee")
    const { status, body } = await app.request("PATCH", `/api/categories/${coffee.id}`, { json: { name: "Tea" } })

    expect(status).toBe(409)
    expect(body.code).toBe("CATEGORY_ALREADY_EXISTS")
  })

  it("sending nothing is a 400 CATEGORY_EMPTY_UPDATE", async () => {
    const { body: created } = await post("Coffee")
    const { status, body } = await app.request("PATCH", `/api/categories/${created.id}`, { json: {} })

    expect(status).toBe(400)
    expect(body.code).toBe("CATEGORY_EMPTY_UPDATE")
  })

  it("setting isActive to false removes it from the public menu", async () => {
    const { body: created } = await post("Coffee")
    await app.request("PATCH", `/api/categories/${created.id}`, { json: { isActive: false } })

    expect((await app.request("GET", "/api/categories/menu")).body).toEqual([])
  })

  it("unknown id is 404, bad id is 400", async () => {
    expect((await app.request("PATCH", `/api/categories/${ID_NOT_FOUND}`, { json: { name: "X" } })).status).toBe(404)
    expect((await app.request("PATCH", "/api/categories/abc", { json: { name: "X" } })).status).toBe(400)
  })
})

describe("DELETE /api/categories/:id", () => {
  it("deletes it (204) and a second delete is 404", async () => {
    const { body: created } = await post("Coffee")

    const first = await app.request("DELETE", `/api/categories/${created.id}`)
    expect(first.status).toBe(204)
    expect(first.body).toBe(null)

    const second = await app.request("DELETE", `/api/categories/${created.id}`)
    expect(second.status).toBe(404)
    expect(second.body.code).toBe("CATEGORY_NOT_FOUND")
  })

  it("CASCADE: deleting a category deletes all its items and leaves other categories' items alone", async () => {
    const { body: coffee } = await post("Coffee")
    const { body: tea } = await post("Tea")
    const item = (name, category) => app.request("POST", "/api/items", { json: { name, price: 1, category } })
    await item("Latte", coffee.id)
    await item("Espresso", coffee.id)
    await item("Green tea", tea.id)

    expect((await app.request("DELETE", `/api/categories/${coffee.id}`)).status).toBe(204)

    const left = await app.request("GET", "/api/items")
    expect(left.body.map((i) => i.name)).toEqual(["Green tea"])
    expect(app.fakeDb.items.length).toBe(1)
  })
})
