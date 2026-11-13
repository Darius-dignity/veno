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

const createCategoryBody = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  description: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
})

// Every field optional, but at least one must be sent
const updateCategoryBody = createCategoryBody
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })

export default {
  categoryIdParams,
  listCategoriesQuery,
  createCategoryBody,
  updateCategoryBody
}