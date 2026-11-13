const ICON_PUBLIC_PATH = "/images/category"

const toIconUrl = (icon) => (icon ? `${ICON_PUBLIC_PATH}/${icon}` : null)

const toCategoryDTO = (category) => ({
  id: category._id.toString(),
  name: category.name,
  description: category.description,
  isActive: category.isActive,
  icon: toIconUrl(category.icon),
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
})

// Menu list is a covered query: only _id, name and icon exist on these objects
const toMenuCategoryDTO = (category) => ({
  id: category._id.toString(),
  name: category.name,
  icon: toIconUrl(category.icon),
})

const toCategoryListDTO = (categories) => categories.map(toCategoryDTO)

const toMenuCategoryListDTO = (categories) => categories.map(toMenuCategoryDTO)

export default {
  toCategoryDTO,
  toMenuCategoryDTO,
  toCategoryListDTO,
  toMenuCategoryListDTO,
}