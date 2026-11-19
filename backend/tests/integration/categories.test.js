import { describe, it, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { startApp } from "../helpers/test-app.js"

let app
before(async () => { app = await startApp() })
beforeEach(() => app.fakeDb.reset())
after(() => app.close())

const post = (name, extra = {}) => app.request("POST", "/api/categories", { json: { name, ...extra } })
const ID_NOT_FOUND = "64b7f0a2c3d4e5f607189999"

describe("POST /api/categories", () => {
  it("creates a category with the defaults (201)", async () => {
    const { status, body } = await post("Coffee")

    assert.equal(status, 201)
    assert.equal(typeof body.id, "string")
    assert.equal(body.name, "Coffee")
    assert.equal(body.description, "")
    assert.equal(body.isActive, true)
    assert.equal(body.icon, null)
    assert.ok(body.createdAt && body.updatedAt)
    assert.equal("_id" in body, false)
  })

  it("a missing or empty name is a 400 VALIDATION_ERROR that points at the field", async () => {
    for (const json of [{}, { name: "" }, { name: "x".repeat(51) }]) {
      const { status, body } = await app.request("POST", "/api/categories", { json })

      assert.equal(status, 400)
      assert.equal(body.code, "VALIDATION_ERROR")
      assert.deepEqual(body.details.map((d) => [d.source, d.path]), [["body", "name"]])
    }
  })

  it("the same name twice is a 409 CATEGORY_ALREADY_EXISTS", async () => {
    await post("Coffee")
    const { status, body } = await post("Coffee")

    assert.equal(status, 409)
    assert.equal(body.code, "CATEGORY_ALREADY_EXISTS")
  })
})

describe("reading categories", () => {
  it("GET /:id returns it; unknown id is 404; bad id is 400", async () => {
    const { body: created } = await post("Coffee")

    assert.equal((await app.request("GET", `/api/categories/${created.id}`)).body.name, "Coffee")

    const missing = await app.request("GET", `/api/categories/${ID_NOT_FOUND}`)
    assert.equal(missing.status, 404)
    assert.equal(missing.body.code, "CATEGORY_NOT_FOUND")

    assert.equal((await app.request("GET", "/api/categories/abc")).status, 400)
  })

  it("the admin list can be filtered with ?isActive", async () => {
    await post("Coffee")
    await post("Tea", { isActive: false })

    const all = await app.request("GET", "/api/categories")
    const active = await app.request("GET", "/api/categories?isActive=true")

    assert.deepEqual(all.body.map((c) => c.name), ["Coffee", "Tea"])
    assert.deepEqual(active.body.map((c) => c.name), ["Coffee"])
    assert.equal((await app.request("GET", "/api/categories?isActive=maybe")).status, 400)
  })

  it("the public menu shows only ACTIVE categories, only {id, name, icon}, sorted by name", async () => {
    await post("Tea")
    await post("Coffee")
    await post("Hidden", { isActive: false })

    const { status, body } = await app.request("GET", "/api/categories/menu")

    assert.equal(status, 200)
    assert.deepEqual(body.map((c) => c.name), ["Coffee", "Tea"])
    for (const category of body) assert.deepEqual(Object.keys(category), ["id", "name", "icon"])
  })
})

describe("PATCH /api/categories/:id", () => {
  it("changes only the fields that were sent", async () => {
    const { body: created } = await post("Coffee", { description: "Hot" })
    const { status, body } = await app.request("PATCH", `/api/categories/${created.id}`, { json: { name: "Hot Coffee" } })

    assert.equal(status, 200)
    assert.equal(body.name, "Hot Coffee")
    assert.equal(body.description, "Hot")
  })

  it("renaming to another category's name is a 409", async () => {
    await post("Tea")
    const { body: coffee } = await post("Coffee")
    const { status, body } = await app.request("PATCH", `/api/categories/${coffee.id}`, { json: { name: "Tea" } })

    assert.equal(status, 409)
    assert.equal(body.code, "CATEGORY_ALREADY_EXISTS")
  })

  it("sending nothing is a 400 CATEGORY_EMPTY_UPDATE", async () => {
    const { body: created } = await post("Coffee")
    const { status, body } = await app.request("PATCH", `/api/categories/${created.id}`, { json: {} })

    assert.equal(status, 400)
    assert.equal(body.code, "CATEGORY_EMPTY_UPDATE")
  })

  it("setting isActive to false removes it from the public menu", async () => {
    const { body: created } = await post("Coffee")
    await app.request("PATCH", `/api/categories/${created.id}`, { json: { isActive: false } })

    assert.deepEqual((await app.request("GET", "/api/categories/menu")).body, [])
  })

  it("unknown id is 404, bad id is 400", async () => {
    assert.equal((await app.request("PATCH", `/api/categories/${ID_NOT_FOUND}`, { json: { name: "X" } })).status, 404)
    assert.equal((await app.request("PATCH", "/api/categories/abc", { json: { name: "X" } })).status, 400)
  })
})

describe("DELETE /api/categories/:id", () => {
  it("deletes it (204) and a second delete is 404", async () => {
    const { body: created } = await post("Coffee")

    const first = await app.request("DELETE", `/api/categories/${created.id}`)
    assert.equal(first.status, 204)
    assert.equal(first.body, null)

    const second = await app.request("DELETE", `/api/categories/${created.id}`)
    assert.equal(second.status, 404)
    assert.equal(second.body.code, "CATEGORY_NOT_FOUND")
  })

  it("CASCADE: deleting a category deletes all its items and leaves other categories' items alone", async () => {
    const { body: coffee } = await post("Coffee")
    const { body: tea } = await post("Tea")
    const item = (name, category) => app.request("POST", "/api/items", { json: { name, price: 1, category } })
    await item("Latte", coffee.id)
    await item("Espresso", coffee.id)
    await item("Green tea", tea.id)

    assert.equal((await app.request("DELETE", `/api/categories/${coffee.id}`)).status, 204)

    const left = await app.request("GET", "/api/items")
    assert.deepEqual(left.body.map((i) => i.name), ["Green tea"])
    assert.equal(app.fakeDb.items.length, 1)
  })
})
