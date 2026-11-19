import { describe, it, mock, afterEach } from "node:test"
import assert from "node:assert/strict"
import CategoryRepository from "../../modules/category/repository.js"
import ItemRepository from "../../modules/item/repository.js"

const ID = "64b7f0a2c3d4e5f607182931"

// A fake model: records what the repository asks for and returns what we tell it
const fakeModel = (result = null) => {
  const record = []
  const query = () => {
    const q = {
      select: (p) => { record.push(["select", p]); return q },
      sort: (s) => { record.push(["sort", s]); return q },
      lean: async () => result,
    }
    return q
  }

  return {
    record,
    find: (f) => { record.push(["find", f]); return query() },
    findById: (id) => { record.push(["findById", id]); return query() },
    findByIdAndUpdate: () => query(),
    findByIdAndDelete: () => query(),
    exists: async (f) => { record.push(["exists", f]); return null },
    create: async () => { throw Object.assign(new Error("E11000"), { code: 11000, keyValue: { category: ID, name: "Latte" } }) },
  }
}

const catchError = async (promise) => { try { await promise } catch (e) { return e } return null }

afterEach(() => mock.restoreAll())

describe("CategoryRepository", () => {
  it("an invalid id is refused with 400 before the database is asked", async () => {
    const model = fakeModel()
    const error = await catchError(new CategoryRepository(model).findById("abc"))

    assert.equal(error.code, "CATEGORY_INVALID_ID")
    assert.equal(error.statusCode, 400)
    assert.equal(model.record.length, 0)
  })

  it("a missing category is 404 CATEGORY_NOT_FOUND (find, update and delete)", async () => {
    const repo = new CategoryRepository(fakeModel(null))
    for (const call of [repo.findById(ID), repo.updateById(ID, { name: "x" }), repo.deleteById(ID)]) {
      const error = await catchError(call)
      assert.equal(error.code, "CATEGORY_NOT_FOUND")
      assert.equal(error.statusCode, 404)
    }
  })

  it("a duplicate key from MongoDB becomes 409 CATEGORY_ALREADY_EXISTS", async () => {
    const model = fakeModel()
    model.create = async () => { throw Object.assign(new Error("E11000"), { code: 11000, keyValue: { name: "Coffee" } }) }
    const error = await catchError(new CategoryRepository(model).create({ name: "Coffee" }))

    assert.equal(error.code, "CATEGORY_ALREADY_EXISTS")
    assert.equal(error.statusCode, 409)
    assert.deepEqual(error.details, { name: "Coffee" })
  })

  it("any other database failure becomes a generic 500 and keeps the real cause", async () => {
    const model = fakeModel()
    model.find = () => { throw new Error("connection lost") }
    const error = await catchError(new CategoryRepository(model).findAll())

    assert.equal(error.code, "CATEGORY_DATABASE_ERROR")
    assert.equal(error.statusCode, 500)
    assert.equal(error.message, "Database operation failed")
    assert.equal(error.cause.message, "connection lost")
  })

  it("the public menu asks only for ACTIVE categories, reads only name and icon, sorted by name", async () => {
    const model = fakeModel([])
    await new CategoryRepository(model).findAllForMenu()

    assert.deepEqual(model.record, [["find", { isActive: true }], ["select", { name: 1, icon: 1 }], ["sort", { name: 1 }]])
  })
})

describe("ItemRepository", () => {
  it("invalid ids are refused; the message says which id was wrong", async () => {
    const repo = new ItemRepository(fakeModel())
    const item = await catchError(repo.findById("abc"))
    const category = await catchError(repo.findAvailableByCategory("abc"))

    assert.equal(item.message, "Invalid item id")
    assert.equal(category.message, "Invalid category id")
    assert.equal(category.statusCode, 400)
  })

  it("a missing item is 404 ITEM_NOT_FOUND", async () => {
    const error = await catchError(new ItemRepository(fakeModel(null)).findById(ID))
    assert.equal(error.code, "ITEM_NOT_FOUND")
    assert.equal(error.statusCode, 404)
  })

  it("same name in the same category (duplicate key) becomes 409 ITEM_ALREADY_EXISTS", async () => {
    const error = await catchError(new ItemRepository(fakeModel()).create({ name: "Latte", category: ID }))

    assert.equal(error.code, "ITEM_ALREADY_EXISTS")
    assert.equal(error.statusCode, 409)
    assert.equal(error.details.name, "Latte")
    assert.equal(error.details.category, ID)
  })

  it("the public menu asks only for AVAILABLE items of one category, menu fields only, sorted by name", async () => {
    const model = fakeModel([])
    await new ItemRepository(model).findAvailableByCategory(ID)

    assert.deepEqual(model.record, [
      ["find", { category: ID, isAvailable: true }],
      ["select", { name: 1, description: 1, price: 1, image: 1 }],
      ["sort", { name: 1 }],
    ])
  })

  it("image file names of a category are listed for cleanup", async () => {
    const model = fakeModel([{ _id: 1, image: "a.webp" }, { _id: 2, image: "b.svg" }])
    assert.deepEqual(await new ItemRepository(model).findImagesByCategoryId(ID), ["a.webp", "b.svg"])
  })

  it("a database failure becomes a generic 500 ITEM_DATABASE_ERROR", async () => {
    const model = fakeModel()
    model.find = () => { throw new Error("connection lost") }
    const error = await catchError(new ItemRepository(model).findAll())

    assert.equal(error.code, "ITEM_DATABASE_ERROR")
    assert.equal(error.statusCode, 500)
  })
})
