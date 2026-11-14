import { z } from "zod"

const objectId = (message) =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, message)

const itemIdParams = z.object({
  id: objectId("Invalid item id"),
})

// GET /items/menu/:categoryId
const menuCategoryParams = z.object({
  categoryId: objectId("Invalid category id"),
})

// GET /items?category=<id>&isAvailable=true
const listItemsQuery = z.object({
  category: objectId("Invalid category id").optional(),
  isAvailable: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
})

// multipart/form-data sends everything as text ("true", "4.5"), JSON sends real types
const booleanField = z.union([z.boolean(), z.stringbool()])

// Accepts 4.5 or "4.5", never "" or "abc" (z.coerce.number would turn "" into 0).
// Max 2 decimals, between 0 and 1,000,000.
const priceField = z
  .union([
    z.number(),
    z.string().trim().regex(/^\d+(\.\d+)?$/, "Price must be a number"),
  ])
  .transform((value) => Number(value))
  .pipe(
    z
      .number()
      .min(0, "Price cannot be negative")
      .max(1_000_000, "Price is too high")
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, {
        message: "Price can have at most 2 decimal places",
      })
  )

// "image" is intentionally not here: it comes from the uploaded file (req.file),
// so a client can never set it by sending a file name in the body
const createItemBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).optional(),
  price: priceField,
  isAvailable: booleanField.optional(),
  category: objectId("Invalid category id"),
})

// Every field optional. "Nothing to update" is checked in the service,
// because a request with only a new image file has an empty body.
const updateItemBody = createItemBody.partial().extend({
  removeImage: booleanField.optional(),
})

export default {
  itemIdParams,
  menuCategoryParams,
  listItemsQuery,
  createItemBody,
  updateItemBody,
}