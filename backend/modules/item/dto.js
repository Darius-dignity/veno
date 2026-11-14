const IMAGE_PUBLIC_PATH = "/images/item"

const toImageUrl = (image) => (image ? `${IMAGE_PUBLIC_PATH}/${image}` : null)

const toItemDTO = (item) => ({
  id: item._id.toString(),
  name: item.name,
  description: item.description,
  price: item.price,
  image: toImageUrl(item.image),
  isAvailable: item.isAvailable,
  category: item.category.toString(),
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
})

// Menu list reads only the menu fields (no category, no isAvailable, no dates)
const toMenuItemDTO = (item) => ({
  id: item._id.toString(),
  name: item.name,
  description: item.description,
  price: item.price,
  image: toImageUrl(item.image),
})

const toItemListDTO = (items) => items.map(toItemDTO)

const toMenuItemListDTO = (items) => items.map(toMenuItemDTO)

export default {
  toItemDTO,
  toMenuItemDTO,
  toItemListDTO,
  toMenuItemListDTO,
}