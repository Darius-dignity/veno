import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals"
import { startApp } from "../helpers/test-app.js"
import { buildForm } from "../helpers/files.js"

let app, coffee, tea
beforeAll(async () => { app = await startApp() })
afterAll(() => app.close())

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

    expect(status).toBe(201)
    expect(body.name).toBe("Latte")
    expect(body.price).toBe(4.5)
    expect(body.description).toBe("")
    expect(body.isAvailable).toBe(true)
    expect(body.image).toBe(null)
    expect(body.category).toBe(coffee)
    expect("_id" in body).toBe(false)
  })

  it("a price sent as form text becomes a number (multipart without a file)", async () => {
    const { status, body } = await app.request("POST", "/api/items", { form: buildForm({ name: "Mocha", price: "5.25", category: coffee, isAvailable: "false" }) })

    expect(status).toBe(201)
    expect(body.price).toBe(5.25)
    expect(body.isAvailable).toBe(false)
  })

  it("bad prices are refused with 400 (missing, empty, negative, too many decimals)", async () => {
    const prices = [undefined, "", -1, 4.567, "abc"]
    const results = []

    for (const price of prices) {
      const { status, body } = await createItem({ name: "X", price, category: coffee })
      results.push([status, body.code])
    }

    expect(results).toEqual(prices.map(() => [400, "VALIDATION_ERROR"]))
  })

  it("the category must exist: 400 ITEM_CATEGORY_NOT_FOUND", async () => {
    const { status, body } = await item("Latte", NOT_FOUND)

    expect(status).toBe(400)
    expect(body.code).toBe("ITEM_CATEGORY_NOT_FOUND")
  })

  it("the same name twice in one category is 409; the same name in ANOTHER category is fine", async () => {
    await item("Latte", coffee)

    const duplicate = await item("Latte", coffee)
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe("ITEM_ALREADY_EXISTS")

    expect((await item("Latte", tea)).status).toBe(201)
  })
})

describe("reading items", () => {
  it("GET /:id returns it; unknown id is 404; bad id is 400", async () => {
    const { body: created } = await item("Latte", coffee)

    expect((await app.request("GET", `/api/items/${created.id}`)).body.name).toBe("Latte")

    const missing = await app.request("GET", `/api/items/${NOT_FOUND}`)
    expect(missing.status).toBe(404)
    expect(missing.body.code).toBe("ITEM_NOT_FOUND")
    expect((await app.request("GET", "/api/items/abc")).status).toBe(400)
  })

  it("the admin list can be filtered by category and availability", async () => {
    await item("Latte", coffee)
    await item("Hidden", coffee, { isAvailable: false })
    await item("Green tea", tea)

    const names = async (query) => (await app.request("GET", `/api/items${query}`)).body.map((i) => i.name)

    expect(await names(`?category=${coffee}`)).toEqual(["Hidden", "Latte"])
    expect(await names(`?category=${coffee}&isAvailable=true`)).toEqual(["Latte"])
    expect((await app.request("GET", "/api/items?category=abc")).status).toBe(400)
  })

  it("the public menu shows only AVAILABLE items with only the menu fields, sorted by name", async () => {
    await item("Mocha", coffee)
    await item("Latte", coffee)
    await item("Hidden", coffee, { isAvailable: false })

    const { status, body } = await app.request("GET", `/api/items/menu/${coffee}`)

    expect(status).toBe(200)
    expect(body.map((i) => i.name)).toEqual(["Latte", "Mocha"])
    for (const row of body) expect(Object.keys(row)).toEqual(["id", "name", "description", "price", "image"])
  })

  it("the public menu: an empty category is [], an inactive or unknown category is 404", async () => {
    expect((await app.request("GET", `/api/items/menu/${coffee}`)).body).toEqual([])

    await app.request("PATCH", `/api/categories/${coffee}`, { json: { isActive: false } })
    const inactive = await app.request("GET", `/api/items/menu/${coffee}`)
    expect(inactive.status).toBe(404)
    expect(inactive.body.code).toBe("CATEGORY_NOT_FOUND")

    expect((await app.request("GET", `/api/items/menu/${NOT_FOUND}`)).status).toBe(404)
    expect((await app.request("GET", "/api/items/menu/abc")).status).toBe(400)
  })
})

describe("PATCH /api/items/:id", () => {
  it("changes only the price", async () => {
    const { body: created } = await item("Latte", coffee)
    const { status, body } = await app.request("PATCH", `/api/items/${created.id}`, { json: { price: 6 } })

    expect(status).toBe(200)
    expect(body.price).toBe(6)
    expect(body.name).toBe("Latte")
  })

  it("sending nothing is 400 ITEM_EMPTY_UPDATE", async () => {
    const { body: created } = await item("Latte", coffee)
    const { status, body } = await app.request("PATCH", `/api/items/${created.id}`, { json: {} })

    expect(status).toBe(400)
    expect(body.code).toBe("ITEM_EMPTY_UPDATE")
  })

  it("renaming into an existing name of the same category is 409", async () => {
    await item("Mocha", coffee)
    const { body: latte } = await item("Latte", coffee)

    expect((await app.request("PATCH", `/api/items/${latte.id}`, { json: { name: "Mocha" } })).status).toBe(409)
  })

  it("moving to another category: fine, unless that category already has the name (409) or does not exist (400)", async () => {
    const { body: latte } = await item("Latte", coffee)

    const moved = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: tea } })
    expect(moved.body.category).toBe(tea)

    await item("Latte", coffee) // the name is free in coffee again
    const clash = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: coffee } })
    expect(clash.status).toBe(409)

    const unknown = await app.request("PATCH", `/api/items/${latte.id}`, { json: { category: NOT_FOUND } })
    expect(unknown.status).toBe(400)
    expect(unknown.body.code).toBe("ITEM_CATEGORY_NOT_FOUND")
  })
})

describe("DELETE /api/items/:id", () => {
  it("deletes it (204); a second delete is 404", async () => {
    const { body: created } = await item("Latte", coffee)

    expect((await app.request("DELETE", `/api/items/${created.id}`)).status).toBe(204)

    const again = await app.request("DELETE", `/api/items/${created.id}`)
    expect(again.status).toBe(404)
    expect(again.body.code).toBe("ITEM_NOT_FOUND")
  })
})
