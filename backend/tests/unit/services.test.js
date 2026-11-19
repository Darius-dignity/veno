import { describe, it } from "node:test"
import assert from "node:assert/strict"
import CategoryService from "../../modules/category/service.js"
import ItemService from "../../modules/item/service.js"
import CategoryErrors from "../../modules/category/error.js"

const A = "64b7f0a2c3d4e5f607182931"
const B = "64b7f0a2c3d4e5f607182932"
const ITEM = "64b7f0a2c3d4e5f607182999"

const rejectsWith = (promise, code) =>
  assert.rejects(promise, (error) => { assert.equal(error.code, code); return true })

// ------------------------------------------------------------------ category service
const makeCategoryService = ({ categories, itemImages = [], failUpdate = false, failDelete = false } = {}) => {
  const data = categories ?? { [A]: { _id: A, name: "Coffee", icon: "old.svg" }, [B]: { _id: B, name: "Tea", icon: null } }
  const calls = []

  const categoryRepository = {
    findById: async (id) => {
      calls.push("findById")
      if (!data[id]) throw new CategoryErrors.CategoryNotFoundError(id)
      return data[id]
    },
    existsByName: async (name, excludeId) => Object.values(data).some((c) => c.name === name && c._id !== excludeId),
    create: async (d) => ({ _id: "new", ...d }),
    updateById: async (id, payload) => {
      calls.push("updateById")
      if (failUpdate) throw new Error("db down")
      data[id] = { ...data[id], ...payload }
      return data[id]
    },
    deleteById: async (id) => {
      calls.push("deleteById")
      if (failDelete) throw new Error("db down")
      delete data[id]
    },
  }
  const itemRepository = { findImagesByCategoryId: async () => { calls.push("findImages"); return itemImages } }
  const storage = () => ({ remove: async (file) => { calls.push(`remove:${file}`) } })

  const service = new CategoryService({ categoryRepository, itemRepository, iconStorage: storage(), itemImageStorage: storage() })
  return { service, calls, data }
}

describe("CategoryService", () => {
  it("refuses to start with a missing dependency and names it (wiring mistakes show up at startup)", () => {
    assert.throws(
      () => new CategoryService({ categoryRepository: {}, iconStorage: {}, itemImageStorage: {} }),
      /missing "itemRepository"/
    )
  })

  it("create: trims the name and refuses a duplicate", async () => {
    const { service } = makeCategoryService()
    assert.equal((await service.createCategory({ name: "  Juice " })).name, "Juice")
    await rejectsWith(service.createCategory({ name: "Coffee" }), "CATEGORY_ALREADY_EXISTS")
  })

  it("update: nothing to update is refused (also removeIcon:false alone)", async () => {
    const { service } = makeCategoryService()
    await rejectsWith(service.updateCategory(A, {}), "CATEGORY_EMPTY_UPDATE")
    await rejectsWith(service.updateCategory(A, { removeIcon: false }), "CATEGORY_EMPTY_UPDATE")
  })

  it("update: renaming to another category's name is refused; keeping its own name is fine", async () => {
    const { service } = makeCategoryService()
    await rejectsWith(service.updateCategory(A, { name: "Tea" }), "CATEGORY_ALREADY_EXISTS")
    assert.equal((await service.updateCategory(A, { name: "Coffee" })).name, "Coffee")
  })

  it("update: a new icon replaces the old one; the old FILE is removed only AFTER the database update", async () => {
    const { service, calls } = makeCategoryService()
    const updated = await service.updateCategory(A, { icon: "new.webp" })

    assert.equal(updated.icon, "new.webp")
    assert.ok(calls.indexOf("updateById") < calls.indexOf("remove:old.svg"))
  })

  it("update: removeIcon sets the icon to null and removes the file; a new file wins over removeIcon", async () => {
    const first = makeCategoryService()
    assert.equal((await first.service.updateCategory(A, { removeIcon: true })).icon, null)
    assert.ok(first.calls.includes("remove:old.svg"))

    const second = makeCategoryService()
    assert.equal((await second.service.updateCategory(A, { icon: "n.webp", removeIcon: true })).icon, "n.webp")
  })

  it("update: if the database update fails, the OLD icon file is NOT deleted", async () => {
    const { service, calls } = makeCategoryService({ failUpdate: true })
    await assert.rejects(service.updateCategory(A, { icon: "new.webp" }))
    assert.equal(calls.some((c) => c.startsWith("remove:")), false)
  })

  it("update: changing only text does not look up the icon or touch any file", async () => {
    const { service, calls } = makeCategoryService()
    await service.updateCategory(A, { description: "x" })
    assert.deepEqual(calls, ["updateById"])
  })

  it("delete: item image names are read BEFORE deleting, files are removed AFTER the database delete", async () => {
    const { service, calls } = makeCategoryService({ itemImages: ["i1.webp", "i2.webp"] })
    await service.deleteCategory(A)

    assert.deepEqual(calls.slice(0, 3), ["findById", "findImages", "deleteById"])
    assert.deepEqual(calls.slice(3).sort(), ["remove:i1.webp", "remove:i2.webp", "remove:old.svg"])
  })

  it("delete: if the database delete fails, NO file is removed", async () => {
    const { service, calls } = makeCategoryService({ itemImages: ["i1.webp"], failDelete: true })
    await assert.rejects(service.deleteCategory(A))
    assert.equal(calls.some((c) => c.startsWith("remove:")), false)
  })

  it("delete: an unknown category stops before anything is deleted", async () => {
    const { service, calls } = makeCategoryService()
    await rejectsWith(service.deleteCategory("64b7f0a2c3d4e5f607189999"), "CATEGORY_NOT_FOUND")
    assert.equal(calls.includes("deleteById"), false)
  })
})

// ------------------------------------------------------------------ item service
const makeItemService = ({ failUpdate = false } = {}) => {
  const items = { [ITEM]: { _id: ITEM, name: "Latte", category: A, image: "old.webp", price: 4 } }
  const categories = { [A]: { isActive: true }, [B]: { isActive: false } }
  const taken = new Set() // "category|name" that already exist
  const calls = []

  const itemRepository = {
    existsByNameInCategory: async (name, category, excludeId) => { calls.push(`exists:${category}|${name}|${excludeId ?? ""}`); return taken.has(`${category}|${name}`) },
    create: async (d) => ({ _id: "new", ...d }),
    findById: async (id) => { calls.push("findById"); return items[id] },
    updateById: async (id, payload) => { calls.push("updateById"); if (failUpdate) throw new Error("db down"); items[id] = { ...items[id], ...payload }; return items[id] },
    deleteById: async (id) => ({ _id: id, image: items[id].image }),
    findAvailableByCategory: async (id) => { calls.push(`menu:${id}`); return [] },
  }
  const categoryService = {
    assertCategoryExists: async (id) => { calls.push(`assertCategory:${id}`); if (!categories[id]) throw new CategoryErrors.CategoryNotFoundError(id) },
    getCategoryById: async (id) => { if (!categories[id]) throw new CategoryErrors.CategoryNotFoundError(id); return categories[id] },
  }
  const imageStorage = { remove: async (file) => { calls.push(`remove:${file}`) } }

  return { service: new ItemService({ itemRepository, categoryService, imageStorage }), calls, items, taken, categoryService }
}

describe("ItemService", () => {
  it("create: a category that does not exist is refused with ITEM_CATEGORY_NOT_FOUND (400)", async () => {
    const { service } = makeItemService()
    await assert.rejects(service.createItem({ name: "X", price: 1, category: "64b7f0a2c3d4e5f607189999" }), (e) => {
      assert.equal(e.code, "ITEM_CATEGORY_NOT_FOUND")
      assert.equal(e.statusCode, 400)
      return true
    })
  })

  it("create: other category errors are not swallowed", async () => {
    const { service, categoryService } = makeItemService()
    categoryService.assertCategoryExists = async () => { throw Object.assign(new Error("bad id"), { code: "CATEGORY_INVALID_ID" }) }
    await rejectsWith(service.createItem({ name: "X", price: 1, category: "zzz" }), "CATEGORY_INVALID_ID")
  })

  it("create: the same name twice in one category is refused; the name is trimmed", async () => {
    const { service, taken } = makeItemService()
    taken.add(`${A}|Mocha`)

    await rejectsWith(service.createItem({ name: " Mocha ", price: 1, category: A }), "ITEM_ALREADY_EXISTS")
    assert.equal((await service.createItem({ name: "  Cola ", price: 1, category: A })).name, "Cola")
  })

  it("update: only price/description/availability changes cost a single database call", async () => {
    const { service, calls } = makeItemService()
    await service.updateItem(ITEM, { price: 5 })
    assert.deepEqual(calls, ["updateById"])
  })

  it("update: renaming checks the name against the item's CURRENT category", async () => {
    const { service, taken } = makeItemService()
    taken.add(`${A}|Mocha`)
    await assert.rejects(service.updateItem(ITEM, { name: "Mocha" }), (e) => {
      assert.equal(e.code, "ITEM_ALREADY_EXISTS")
      assert.equal(e.details.category, A)
      return true
    })
  })

  it("update: moving checks the item's CURRENT name in the NEW category", async () => {
    const { service, taken } = makeItemService()
    taken.add(`${B}|Latte`)
    await assert.rejects(service.updateItem(ITEM, { category: B }), (e) => {
      assert.equal(e.code, "ITEM_ALREADY_EXISTS")
      assert.equal(e.details.name, "Latte")
      return true
    })
  })

  it("update: moving to a category that does not exist is refused", async () => {
    const { service } = makeItemService()
    await rejectsWith(service.updateItem(ITEM, { category: "64b7f0a2c3d4e5f607189999" }), "ITEM_CATEGORY_NOT_FOUND")
  })

  it("update: nothing to update is refused", async () => {
    const { service } = makeItemService()
    await rejectsWith(service.updateItem(ITEM, {}), "ITEM_EMPTY_UPDATE")
  })

  it("update: new image replaces the old (file removed after the database update); removeImage clears it", async () => {
    const { service, calls, items } = makeItemService()
    await service.updateItem(ITEM, { image: "new.webp" })
    assert.ok(calls.indexOf("updateById") < calls.indexOf("remove:old.webp"))

    await service.updateItem(ITEM, { removeImage: true })
    assert.equal(items[ITEM].image, null)
    assert.ok(calls.includes("remove:new.webp"))
  })

  it("update: if the database update fails the old image file is NOT deleted", async () => {
    const { service, calls } = makeItemService({ failUpdate: true })
    await assert.rejects(service.updateItem(ITEM, { image: "new.webp" }))
    assert.equal(calls.some((c) => c.startsWith("remove:")), false)
  })

  it("public menu: an inactive or unknown category is a 404 (hidden from customers)", async () => {
    const { service } = makeItemService()
    await rejectsWith(service.getMenuItems(B), "CATEGORY_NOT_FOUND")
    await rejectsWith(service.getMenuItems("64b7f0a2c3d4e5f607189999"), "CATEGORY_NOT_FOUND")
    assert.deepEqual(await service.getMenuItems(A), [])
  })

  it("delete: the image file of the item is removed", async () => {
    const { service, calls } = makeItemService()
    await service.deleteItem(ITEM)
    assert.ok(calls.includes("remove:old.webp"))
  })
})
