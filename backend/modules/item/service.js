import ItemErrors from "./error.js"
import CategoryErrors from "../category/error.js"

const { ItemAlreadyExistsError, ItemCategoryNotFoundError, ItemEmptyUpdateError } =
  ItemErrors

const { CategoryNotFoundError } = CategoryErrors

class ItemService {
  // itemRepository: ItemRepository instance
  // categoryService: CategoryService instance (getCategoryById, assertCategoryExists)
  // imageStorage: anything that exposes remove(filename) (FileStorage)
  constructor({ itemRepository, categoryService, imageStorage }) {
    this.itemRepository = itemRepository
    this.categoryService = categoryService
    this.imageStorage = imageStorage
  }

  // MongoDB has no foreign keys, so we check that the category exists.
  // The category module answers; we turn its "not found" into the item error.
  async #assertCategoryExists(categoryId) {
    try {
      await this.categoryService.assertCategoryExists(categoryId)
    } catch (error) {
      if (error instanceof CategoryNotFoundError) {
        throw new ItemCategoryNotFoundError(categoryId)
      }

      throw error
    }
  }

  // data: name, description, price, isAvailable, category, image (file name)
  async createItem(data) {
    const name = data.name.trim()

    await this.#assertCategoryExists(data.category)

    if (await this.itemRepository.existsByNameInCategory(name, data.category)) {
      throw new ItemAlreadyExistsError(name, data.category)
    }

    return this.itemRepository.create({ ...data, name })
  }

  // Public menu: available items of one ACTIVE category
  async getMenuItems(categoryId) {
    // throws 404 if the category does not exist
    const category = await this.categoryService.getCategoryById(categoryId)

    // The public menu hides inactive categories, so their items are hidden too
    if (!category.isActive) {
      throw new CategoryNotFoundError(categoryId)
    }

    return this.itemRepository.findAvailableByCategory(categoryId)
  }

  // Admin list: optional filters { category, isAvailable }
  async getAllItems(filters = {}) {
    return this.itemRepository.findAll(filters)
  }

  async getItemById(id) {
    return this.itemRepository.findById(id)
  }

  // data may contain: name, description, price, isAvailable, category,
  // image (new file name), removeImage
  async updateItem(id, data) {
    const { removeImage, ...payload } = data

    // A new file wins over removeImage
    if (removeImage && payload.image === undefined) {
      payload.image = null
    }

    if (Object.keys(payload).length === 0) {
      throw new ItemEmptyUpdateError()
    }

    if (payload.name !== undefined) {
      payload.name = payload.name.trim()
    }

    // The current item is needed only when the name, the category or the image
    // changes (duplicate check, old file). It also gives a 404 early.
    const needsCurrent =
      payload.name !== undefined ||
      payload.category !== undefined ||
      payload.image !== undefined

    const current = needsCurrent ? await this.itemRepository.findById(id) : null

    if (payload.category !== undefined) {
      await this.#assertCategoryExists(payload.category)
    }

    // The unique rule is "name inside one category", so check the final pair
    if (payload.name !== undefined || payload.category !== undefined) {
      const name = payload.name ?? current.name
      const category = payload.category ?? String(current.category)

      if (await this.itemRepository.existsByNameInCategory(name, category, id)) {
        throw new ItemAlreadyExistsError(name, category)
      }
    }

    const updated = await this.itemRepository.updateById(id, payload)

    // DB is updated first; then the old file is removed (a leftover file is harmless)
    if (current?.image && current.image !== updated.image) {
      await this.imageStorage.remove(current.image)
    }

    return updated
  }

  async deleteItem(id) {
    // throws 400 / 404 by itself and returns { _id, image }
    const deleted = await this.itemRepository.deleteById(id)

    await this.imageStorage.remove(deleted.image)
  }
}

export default ItemService