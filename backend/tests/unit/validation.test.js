import { describe, it, expect } from "@jest/globals"
import CategoryValidation from "../../modules/category/validate.js"
import ItemValidation from "../../modules/item/validate.js"

const ID = "64b7f0a2c3d4e5f607182931"

// multer gives the body as an object without a prototype, with every value as text
const multipart = (fields) => Object.assign(Object.create(null), fields)

describe("category validation", () => {
  const { createCategoryBody, updateCategoryBody, categoryIdParams, listCategoriesQuery } =
    CategoryValidation

  it("name is required, trimmed and limited to 50 characters", () => {
    expect(createCategoryBody.safeParse({}).success).toBe(false)
    expect(createCategoryBody.safeParse({ name: "   " }).success).toBe(false)
    expect(createCategoryBody.safeParse({ name: "x".repeat(51) }).success).toBe(false)
    expect(createCategoryBody.safeParse({ name: 5 }).success).toBe(false)
    expect(createCategoryBody.parse({ name: "  Coffee  " }).name).toBe("Coffee")
  })

  it("isActive accepts real booleans (JSON) and 'true'/'false' text (form-data)", () => {
    expect(createCategoryBody.parse({ name: "A", isActive: false }).isActive).toBe(false)
    expect(createCategoryBody.parse(multipart({ name: "A", isActive: "false" })).isActive).toBe(false)
    expect(createCategoryBody.parse(multipart({ name: "A", isActive: "true" })).isActive).toBe(true)
    expect(createCategoryBody.safeParse({ name: "A", isActive: "maybe" }).success).toBe(false)
  })

  it("a client can never set the icon through the body (it comes only from the file)", () => {
    const parsed = createCategoryBody.parse({ name: "A", icon: "../../evil.svg" })
    expect("icon" in parsed).toBe(false)
  })

  it("update: every field optional, removeIcon understands form text", () => {
    expect(updateCategoryBody.parse({})).toEqual({})
    expect(updateCategoryBody.parse(multipart({ removeIcon: "true" })).removeIcon).toBe(true)
    expect(updateCategoryBody.safeParse({ name: "" }).success).toBe(false)
  })

  it("ids must be 24 hex characters; isActive filter must be true/false", () => {
    expect(categoryIdParams.safeParse({ id: ID }).success).toBe(true)
    expect(categoryIdParams.safeParse({ id: "abc" }).success).toBe(false)
    expect(listCategoriesQuery.parse({ isActive: "true" }).isActive).toBe(true)
    expect(listCategoriesQuery.safeParse({ isActive: "maybe" }).success).toBe(false)
  })
})

describe("item validation", () => {
  const { createItemBody, updateItemBody, itemIdParams, menuCategoryParams, listItemsQuery } =
    ItemValidation

  const item = (price) => ({ name: "Latte", price, category: ID })

  it("price accepts numbers and numeric text (form-data), including 0", () => {
    expect(createItemBody.parse(item(4.5)).price).toBe(4.5)
    expect(createItemBody.parse(item("4.5")).price).toBe(4.5)
    expect(createItemBody.parse(item("5.25")).price).toBe(5.25)
    expect(createItemBody.parse(item(0)).price).toBe(0)
    expect(createItemBody.parse(item(0.3)).price).toBe(0.3)
  })

  it("price rejects empty, text, negative, too many decimals, too high and wrong types", () => {
    const bad = ["", "abc", "-5", "1e3", "4,5", -1, 4.567, 1000001, null, true, undefined]
    const wronglyAccepted = bad.filter((price) => createItemBody.safeParse(item(price)).success)

    expect(wronglyAccepted).toEqual([]) // a value listed here was accepted but must be refused
  })

  it("an empty price is refused, not silently turned into 0", () => {
    expect(createItemBody.safeParse(multipart({ name: "A", price: "", category: ID })).success).toBe(false)
  })

  it("name, description and category rules", () => {
    expect(createItemBody.safeParse({ price: 1, category: ID }).success).toBe(false)
    expect(createItemBody.safeParse({ name: "x".repeat(81), price: 1, category: ID }).success).toBe(false)
    expect(createItemBody.safeParse({ name: "A", price: 1, category: ID, description: "x".repeat(501) }).success).toBe(false)
    expect(createItemBody.safeParse({ name: "A", price: 1 }).success).toBe(false)
    expect(createItemBody.safeParse({ name: "A", price: 1, category: "abc" }).success).toBe(false)
  })

  it("a client can never set the image through the body", () => {
    const parsed = createItemBody.parse({ ...item(1), image: "../../evil.webp" })
    expect("image" in parsed).toBe(false)
  })

  it("update: partial, price still checked, removeImage understands form text", () => {
    expect(updateItemBody.parse({})).toEqual({})
    expect(updateItemBody.parse(multipart({ price: "6.5" })).price).toBe(6.5)
    expect(updateItemBody.safeParse({ price: "x" }).success).toBe(false)
    expect(updateItemBody.parse(multipart({ removeImage: "true" })).removeImage).toBe(true)
  })

  it("params and list filters", () => {
    expect(itemIdParams.safeParse({ id: "abc" }).success).toBe(false)
    expect(menuCategoryParams.safeParse({ categoryId: ID }).success).toBe(true)
    expect(listItemsQuery.parse({ category: ID, isAvailable: "false" }).isAvailable).toBe(false)
    expect(listItemsQuery.safeParse({ category: "abc" }).success).toBe(false)
  })
})
