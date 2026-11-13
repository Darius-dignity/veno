import mongoose from "mongoose"
import Category from "./model.js"
import CategoryErrors from "./error.js"

const {
  CategoryError,
  InvalidCategoryIdError,
  CategoryNotFoundError,
  CategoryAlreadyExistsError,
  CategoryDatabaseError,
} = CategoryErrors

// Public menu list: only what the menu needs (covered by the compound index)
const MENU_PROJECTION = { name: 1, icon: 1 }

// Admin / detail view: no __v, only real fields
const DETAIL_PROJECTION = {
  name: 1,
  description: 1,
  isActive: 1,
  icon: 1,
  createdAt: 1,
  updatedAt: 1,
}

class CategoryRepository {
  constructor(model) {
    this.model = model
  }

  #assertValidId(id) {
    if (!mongoose.isObjectIdOrHexString(id)) {
      throw new InvalidCategoryIdError(id)
    }
  }

  #handleError(error, context = {}) {
    if (error instanceof CategoryError) {
      return error
    }

    if (error?.code === 11000) {
      return new CategoryAlreadyExistsError(
        context.name ?? error.keyValue?.name
      )
    }

    return new CategoryDatabaseError("Database operation failed", error)
  }

  async create(data) {
    try {
      const category = await this.model.create(data)
      return category.toObject()
    } catch (error) {
      throw this.#handleError(error, data)
    }
  }

  // Public menu: active categories, only _id + name, sorted by name
  async findAllForMenu() {
    try {
      return await this.model
        .find({ isActive: true })
        .select(MENU_PROJECTION)
        .sort({ name: 1 })
        .lean()
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  // Admin list: optional isActive filter
  async findAll({ isActive } = {}) {
    const filter = typeof isActive === "boolean" ? { isActive } : {}

    try {
      return await this.model
        .find(filter)
        .select(DETAIL_PROJECTION)
        .sort({ name: 1 })
        .lean()
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async findById(id) {
    this.#assertValidId(id)

    try {
      const category = await this.model
        .findById(id)
        .select(DETAIL_PROJECTION)
        .lean()

      if (!category) {
        throw new CategoryNotFoundError(id)
      }

      return category
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  // Cheap existence check (used by the item module before attaching an item)
  async existsById(id) {
    this.#assertValidId(id)

    try {
      const found = await this.model.exists({ _id: id })
      return Boolean(found)
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async existsByName(name, excludeId = null) {
    const filter = { name: name.trim() }

    if (excludeId) {
      this.#assertValidId(excludeId)
      filter._id = { $ne: excludeId }
    }

    try {
      const found = await this.model.exists(filter)
      return Boolean(found)
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async updateById(id, data) {
    this.#assertValidId(id)

    try {
      const category = await this.model
        .findByIdAndUpdate(
          id,
          { $set: data },
          { new: true, runValidators: true }
        )
        .select(DETAIL_PROJECTION)
        .lean()

      if (!category) {
        throw new CategoryNotFoundError(id)
      }

      return category
    } catch (error) {
      throw this.#handleError(error, data)
    }
  }

  async deleteById(id) {
    this.#assertValidId(id)

    try {
      const deleted = await this.model
        .findByIdAndDelete(id)
        .select({ _id: 1 })
        .lean()

      if (!deleted) {
        throw new CategoryNotFoundError(id)
      }

      return deleted
    } catch (error) {
      throw this.#handleError(error)
    }
  }
}

export default CategoryRepository