import { z } from "zod"

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category id")

const categoryIdParams = z.object({
  id: objectId,
})

// GET /categories?isActive=true
const listCategoriesQuery = z.object({
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
})

// multipart/form-data sends everything as text ("true"), JSON sends real booleans
const booleanField = z.union([z.boolean(), z.stringbool()])

// "icon" is intentionally not here: it comes from the uploaded file (req.file),
// so a client can never set it by sending a file name in the body
const createCategoryBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  description: z.string().trim().max(300).optional(),
  isActive: booleanField.optional(),
})

// Every field optional. "Nothing to update" is checked in the service,
// because a request with only a new icon file has an empty body.
const updateCategoryBody = createCategoryBody.partial().extend({
  removeIcon: booleanField.optional(),
})

export default {
  categoryIdParams,
  listCategoriesQuery,
  createCategoryBody,
  updateCategoryBody
}