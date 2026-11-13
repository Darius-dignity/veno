import CategoryErrors from "./error.js"

const {
  CategoryNotFoundError,
  CategoryAlreadyExistsError,
  CategoryEmptyUpdateError,
} = CategoryErrors

class CategoryService {
  // categoryRepository: CategoryRepository instance
  // iconStorage: anything that exposes remove(filename) (FileStorage)
  constructor({ categoryRepository, iconStorage }) {
    this.categoryRepository = categoryRepository
    this.iconStorage = iconStorage
  }

  async createCategory(data) {
    const name = data.name.trim()

    if (await this.categoryRepository.existsByName(name)) {
      throw new CategoryAlreadyExistsError(name)
    }

    return this.categoryRepository.create({ ...data, name })
  }

  // Public menu: active categories only, _id + name (covered query)
  async getMenuCategories() {
    return this.categoryRepository.findAllForMenu()
  }

  // Admin list: optional isActive filter
  async getAllCategories(filters = {}) {
    return this.categoryRepository.findAll(filters)
  }

  async getCategoryById(id) {
    return this.categoryRepository.findById(id)
  }

  // data may contain: name, description, isActive, icon (new file name), removeIcon
  async updateCategory(id, data) {
    const { removeIcon, ...payload } = data

    // A new file wins over removeIcon
    if (removeIcon && payload.icon === undefined) {
      payload.icon = null
    }

    if (Object.keys(payload).length === 0) {
      throw new CategoryEmptyUpdateError()
    }

    if (payload.name !== undefined) {
      payload.name = payload.name.trim()

      if (await this.categoryRepository.existsByName(payload.name, id)) {
        throw new CategoryAlreadyExistsError(payload.name)
      }
    }

    // Only look up the current icon when the icon is about to change
    const current =
      payload.icon !== undefined
        ? await this.categoryRepository.findById(id)
        : null

    const updated = await this.categoryRepository.updateById(id, payload)

    // DB is updated first; then the old file is removed (a leftover file is harmless)
    if (current?.icon && current.icon !== updated.icon) {
      await this.iconStorage.remove(current.icon)
    }

    return updated
  }

  async deleteCategory(id) {
    // findById validates the id format and throws if the category does not exist
    const category = await this.categoryRepository.findById(id)

    // The Mongoose middleware in model.js also deletes all items of this category
    await this.categoryRepository.deleteById(id)
    await this.iconStorage.remove(category.icon)
  }

  // Used by the item module before creating or moving an item
  async assertCategoryExists(id) {
    if (!(await this.categoryRepository.existsById(id))) {
      throw new CategoryNotFoundError(id)
    }
  }
}

export default CategoryService