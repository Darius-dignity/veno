import { describe, it, before, beforeEach, after } from "node:test"
import assert from "node:assert/strict"
import { startApp } from "../helpers/test-app.js"
import { buildForm } from "../helpers/files.js"

let app, coffee, tea
before(async () => { app = await startApp() })
after(() => app.close())

beforeEach(async () => {
  app.fakeDb.reset()
  coffee = (await app.request("POST", "/api/categories", { json: { name: "Coffee" } })).body.id
  tea = (await app.request("POST", "/api/categories", { json: { name: "Tea" } })).body.id
})

const createItem = (json) => app.request("POST", "/api/items", { json })
const item = (name, category, extra = {}) => createItem({ name, price: 4.5, category, ...extra })
const NOT_FOUND = "64b7f0a2c3d4e5f607189999"

describe("POST /api/items", () => {
  it("creates an item with the defaults (201)", async () => {
    const { status, body } = await item("Latte", coffee)

    assert.equal(status, 201)
    assert.equal(body.name, "Latte")
    assert.equal(body.price, 4.5)
    assert.equal(body.description, "")
    assert.equal(body.isAvailable, true)
    assert.equal(body.image, null)
    assert.equal(body.category, coffee)
    assert.equal("_id" in body, false)
  })

  it("a price sent as form text becomes a number (multipart without a file)", async () => {
    const { status, body } = await app.request("POST", "/api/items", { form: buildForm({ name: "Mocha", price: "5.25", category: coffee, isAvailable: "false" }) })

    assert.equal(status, 201)
    assert.equal(body.price, 5.25)
    assert.equal(body.isAvailable, false)
  })

  it("bad prices are refused with 400 (missing, empty, negative, too many decimals)", async () => {
    for (const price of [undefined, "", -1, 4.567, "abc"]) {
      const { status, body } = await createItem({ name: "X", price, category: coffee })

      assert.equal(status, 400, `price ${JSON.stringify(price)}`)
      assert.equal(body.code, "VALIDATION_ERROR")
    }
  })

  it("the category must exist: 400 ITEM_CATEGORY_NOT_FOUND", async () => {
    const { status, body } = await item("Latte", NOT_FOUND)

    assert.equal(status, 400)
    assert.equal(body.code, "ITEM_CATEGORY_NOT_FOUND")
  })

  it("the same name twice in one category is 409; the same name in ANOTHER category is fine", async () => {
    await item("Latte", coffee)

    const duplicate = await item("Latte", coffee)
    assert.equal(duplicate.status, 409)
    assert.equal(duplicate.body.code, "ITEM_ALREADY_EXISTS")

    assert.equal((await item("Latte", tea)).status, 201)
  })
})

describe("reading items", () => {
  it("GET /:id returns it; unknown id is 404; bad id is 400", async () => {
    const { body: created } = await item("Latte", coffee)

    assert.equal((await app.request("GET", `/api/items/${created.id}`)).body.name, "Latte")

    const missing = await app.request("GET", `/api/items/${NOT_FOUND}`)
    assert.equal(missing.status, 404)
    assert.equal(missing.body.code, "ITEM_NOT_FOUND")
    assert.equal((await app.request("GET", "/api/items/abc")).status, 400)
  })

  it("the admin list can be filtered by category and availability", async () => {
    await item("Latte", coffee)
    await item("Hidden", coffee, { isAvailable: false })
    await item("Green tea", tea)

    const names = async (query) => (await app.request("GET", `/api/items${query}`)).body.map((i) => i.name)

    assert.deepEqual(await names(`?category=${coffee}`), ["Hidden", "Latte"])
    assert.deepEqual(await names(`?category=${coffee}&isAvailable=true`), ["Latte"])
    assert.equal((await app.request("GET", "/api/items?category=abc")).status, 400)
  })

  it("the public menu shows only AVAILABLE items with only the menu fields, sorted by name", async () => {
    await item("Mocha", coffee)
    await item("Latte", coffee)
    await item("Hidden", coffee, { isAvailable: false })

    const { status, body } = await app.request("GET", `/api/items/menu/${coffee}`)

    assert.equal(status, 200)
    assert.deepEqual(body.map((i) => i.name), ["Latte", "Mocha"])
    for (const row of body) assert.deepEqual(Object.keys(row), ["id", "name", "description", "price", "image"])
  })

  it("the public menu: an empty category is [], an inactive or unknown category is 404", async () => {
    assert.deepEqual((await app.request("GET", `/api/items/menu/${coffee}`)).body, [])

    await app.request("PATCH", `/api/categories/${coffee}`, { json: { isActive: false } })
    const inactive = await app.request("GET", `/api/items/menu/${coffee}`)
    assert.equal(inactive.status, 404)
    assert.equal(inactive.body.code, "CATEGORY_NOT_FOUND")

    assert.equal((await app.request("GET", `/api/items/menu/${NOT_FOUND}`)).status, 404)
    assert.equal((await app.request("GET", "/api/items/menu/abc")).status, 400)
  })
})

describe("PATCH /api/items/:id", () => {
  it("changes only the price", async () => {
    const { body: created } = await item("Latte", coffee)
    const { status, body } = await app.request("PATCH", `/api/items/${created.id}`, { json: { price: 6 } })

    assert.equal(status, 200)
    assert.equal(body.price, 6)
    assert.equal(body.name, "Latte")
  })

  it("sending nothing is 400 ITEM_EMPTY_UPDATE", async () => {
    const { body: created } = await item("Latte", coffee)
    const { status, body } = await app.request("PATCH", `/api/items/${created.id}`, { json: {} })

    assert.equal(status, 400)
    assert.equal(body.code, "ITEM_EMPTY_UPDATE")
  })

  it("renaming into an existing name of the same category is 409", async () => {
    await item("Mocha", coffee)
    const { body: latte } = await item("Latte", coffee)

    assert.equal((await app.request("PATCH", `/api/items/${latte.id}`, { json: { name: "Mocha" } })).status, 409)
  })

  it("moving to another category: fine, unless that category already has the name (409) or does not exist (400)", async () => {
    const { body: latte } = await item("Latte", coffee)

    const moved = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: tea } })
    assert.equal(moved.body.category, tea)

    await item("Latte", coffee) // the name is free in coffee again
    const clash = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: coffee } })
    assert.equal(clash.status, 409)

    const unknown = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: NOT_FOUND } })
    assert.equal(unknown.status, 400)
    assert.equal(unknown.body.code, "ITEM_CATEGORY_NOT_FOUND")
  })
})

describe("DELETE /api/items/:id", () => {
  it("deletes it (204); a second delete is 404", async () => {
    const { body: created } = await item("Latte", coffee)

    assert.equal((await app.request("DELETE", `/api/items/${created.id}`)).status, 204)

    const again = await app.request("DELETE", `/api/items/${created.id}`)
    assert.equal(again.status, 404)
    assert.equal(again.body.code, "ITEM_NOT_FOUND")
  })
})
