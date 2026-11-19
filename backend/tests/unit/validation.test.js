import { describe, it } from "node:test"
import assert from "node:assert/strict"
import CategoryValidation from "../../modules/category/validate.js"
import ItemValidation from "../../modules/item/validate.js"

const ID = "64b7f0a2c3d4e5f607182931"

// multer gives the body as an object without a prototype, with every value as text
const multipart = (fields) => Object.assign(Object.create(null), fields)

describe("category validation", () => {
  const { createCategoryBody, updateCategoryBody, categoryIdParams, listCategoriesQuery } =
    CategoryValidation

  it("name is required, trimmed and limited to 50 characters", () => {
    assert.equal(createCategoryBody.safeParse({}).success, false)
    assert.equal(createCategoryBody.safeParse({ name: "   " }).success, false)
    assert.equal(createCategoryBody.safeParse({ name: "x".repeat(51) }).success, false)
    assert.equal(createCategoryBody.safeParse({ name: 5 }).success, false)
    assert.equal(createCategoryBody.parse({ name: "  Coffee  " }).name, "Coffee")
  })

  it("isActive accepts real booleans (JSON) and 'true'/'false' text (form-data)", () => {
    assert.equal(createCategoryBody.parse({ name: "A", isActive: false }).isActive, false)
    assert.equal(createCategoryBody.parse(multipart({ name: "A", isActive: "false" })).isActive, false)
    assert.equal(createCategoryBody.parse(multipart({ name: "A", isActive: "true" })).isActive, true)
    assert.equal(createCategoryBody.safeParse({ name: "A", isActive: "maybe" }).success, false)
  })

  it("a client can never set the icon through the body (it comes only from the file)", () => {
    const parsed = createCategoryBody.parse({ name: "A", icon: "../../evil.svg" })
    assert.equal("icon" in parsed, false)
  })

  it("update: every field optional, removeIcon understands form text", () => {
    assert.deepEqual(updateCategoryBody.parse({}), {})
    assert.equal(updateCategoryBody.parse(multipart({ removeIcon: "true" })).removeIcon, true)
    assert.equal(updateCategoryBody.safeParse({ name: "" }).success, false)
  })

  it("ids must be 24 hex characters; isActive filter must be true/false", () => {
    assert.equal(categoryIdParams.safeParse({ id: ID }).success, true)
    assert.equal(categoryIdParams.safeParse({ id: "abc" }).success, false)
    assert.equal(listCategoriesQuery.parse({ isActive: "true" }).isActive, true)
    assert.equal(listCategoriesQuery.safeParse({ isActive: "maybe" }).success, false)
  })
})

describe("item validation", () => {
  const { createItemBody, updateItemBody, itemIdParams, menuCategoryParams, listItemsQuery } =
    ItemValidation

  const item = (price) => ({ name: "Latte", price, category: ID })

  it("price accepts numbers and numeric text (form-data), including 0", () => {
    assert.equal(createItemBody.parse(item(4.5)).price, 4.5)
    assert.equal(createItemBody.parse(item("4.5")).price, 4.5)
    assert.equal(createItemBody.parse(item("5.25")).price, 5.25)
    assert.equal(createItemBody.parse(item(0)).price, 0)
    assert.equal(createItemBody.parse(item(0.3)).price, 0.3)
  })

  it("price rejects empty, text, negative, too many decimals, too high and wrong types", () => {
    for (const bad of ["", "abc", "-5", "1e3", "4,5", -1, 4.567, 1000001, null, true, undefined]) {
      assert.equal(createItemBody.safeParse(item(bad)).success, false, `price ${JSON.stringify(bad)} must be refused`)
    }
  })

  it("an empty price is refused, not silently turned into 0", () => {
    assert.equal(createItemBody.safeParse(multipart({ name: "A", price: "", category: ID })).success, false)
  })

  it("name, description and category rules", () => {
    assert.equal(createItemBody.safeParse({ price: 1, category: ID }).success, false)
    assert.equal(createItemBody.safeParse({ name: "x".repeat(81), price: 1, category: ID }).success, false)
    assert.equal(createItemBody.safeParse({ name: "A", price: 1, category: ID, description: "x".repeat(501) }).success, false)
    assert.equal(createItemBody.safeParse({ name: "A", price: 1 }).success, false)
    assert.equal(createItemBody.safeParse({ name: "A", price: 1, category: "abc" }).success, false)
  })

  it("a client can never set the image through the body", () => {
    const parsed = createItemBody.parse({ ...item(1), image: "../../evil.webp" })
    assert.equal("image" in parsed, false)
  })

  it("update: partial, price still checked, removeImage understands form text", () => {
    assert.deepEqual(updateItemBody.parse({}), {})
    assert.equal(updateItemBody.parse(multipart({ price: "6.5" })).price, 6.5)
    assert.equal(updateItemBody.safeParse({ price: "x" }).success, false)
    assert.equal(updateItemBody.parse(multipart({ removeImage: "true" })).removeImage, true)
  })

  it("params and list filters", () => {
    assert.equal(itemIdParams.safeParse({ id: "abc" }).success, false)
    assert.equal(menuCategoryParams.safeParse({ categoryId: ID }).success, true)
    assert.equal(listItemsQuery.parse({ category: ID, isAvailable: "false" }).isAvailable, false)
    assert.equal(listItemsQuery.safeParse({ category: "abc" }).success, false)
  })
})
