const toCategoryDTO = (category) => ({
  id: category._id.toString(),
  name: category.name,
  description: category.description,
  isActive: category.isActive,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
})

// Menu list is a covered query: only _id and name exist on these objects
const toMenuCategoryDTO = (category) => ({
  id: category._id.toString(),
  name: category.name,
})

const toCategoryListDTO = (categories) => categories.map(toCategoryDTO)

const toMenuCategoryListDTO = (categories) => categories.map(toMenuCategoryDTO)

export default {
  toCategoryDTO,
  toMenuCategoryDTO,
  toCategoryListDTO,
  toMenuCategoryListDTO,
}