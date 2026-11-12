import CategoryErrors from "./error.js"

const { CategoryNotFoundError, CategoryAlreadyExistsError, CategoryHasItemsError } =
  CategoryErrors

class CategoryService {
  // categoryRepository: CategoryRepository instance
  // itemRepository: anything that exposes existsByCategoryId(categoryId)
  constructor({ categoryRepository, itemRepository }) {
    this.categoryRepository = categoryRepository
    this.itemRepository = itemRepository
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

  async updateCategory(id, data) {
    const payload = { ...data }

    if (payload.name !== undefined) {
      payload.name = payload.name.trim()

      if (await this.categoryRepository.existsByName(payload.name, id)) {
        throw new CategoryAlreadyExistsError(payload.name)
      }
    }

    return this.categoryRepository.updateById(id, payload)
  }

  async deleteCategory(id) {
    // existsById also validates the id format
    if (!(await this.categoryRepository.existsById(id))) {
      throw new CategoryNotFoundError(id)
    }

    if (await this.itemRepository.existsByCategoryId(id)) {
      throw new CategoryHasItemsError(id)
    }

    await this.categoryRepository.deleteById(id)
  }

  // Used by the item module before creating or moving an item
  async assertCategoryExists(id) {
    if (!(await this.categoryRepository.existsById(id))) {
      throw new CategoryNotFoundError(id)
    }
  }
}

export default CategoryService