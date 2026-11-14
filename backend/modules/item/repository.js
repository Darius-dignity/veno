import mongoose from "mongoose"
import ItemErrors from "./error.js"

const {
  ItemError,
  InvalidItemIdError,
  ItemNotFoundError,
  ItemAlreadyExistsError,
  ItemDatabaseError,
} = ItemErrors

// Public menu: only what the menu card shows
const MENU_PROJECTION = { name: 1, description: 1, price: 1, image: 1 }

// Admin / detail view: every real field (no __v)
const DETAIL_PROJECTION = {
  name: 1,
  description: 1,
  price: 1,
  image: 1,
  isAvailable: 1,
  category: 1,
  createdAt: 1,
  updatedAt: 1,
}

class ItemRepository {
  constructor(model) {
    this.model = model
  }

  #assertValidId(id, field = "id") {
    if (!mongoose.isObjectIdOrHexString(id)) {
      throw new InvalidItemIdError(id, field)
    }
  }

  #handleError(error, context = {}) {
    if (error instanceof ItemError) {
      return error
    }

    // Duplicate key on the unique index { category, name }.
    // keyValue is preferred: on updates, name or category may not be in the payload.
    if (error?.code === 11000) {
      return new ItemAlreadyExistsError(
        error.keyValue?.name ?? context.name,
        String(error.keyValue?.category ?? context.category)
      )
    }

    return new ItemDatabaseError("Database operation failed", error)
  }

  async create(data) {
    try {
      const item = await this.model.create(data)
      return item.toObject()
    } catch (error) {
      throw this.#handleError(error, data)
    }
  }

  // Public menu: available items of one category, sorted by name.
  // Uses the { category, name } index for both the filter and the sort,
  // so there is no in-memory sort. Only the menu fields are read.
  async findAvailableByCategory(categoryId) {
    this.#assertValidId(categoryId, "category")

    try {
      return await this.model
        .find({ category: categoryId, isAvailable: true })
        .select(MENU_PROJECTION)
        .sort({ name: 1 })
        .lean()
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  // Admin list: optional filters, ordered by category then name (same index)
  async findAll({ category, isAvailable } = {}) {
    const filter = {}

    if (category !== undefined) {
      this.#assertValidId(category, "category")
      filter.category = category
    }

    if (typeof isAvailable === "boolean") {
      filter.isAvailable = isAvailable
    }

    try {
      return await this.model
        .find(filter)
        .select(DETAIL_PROJECTION)
        .sort({ category: 1, name: 1 })
        .lean()
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async findById(id) {
    this.#assertValidId(id)

    try {
      const item = await this.model
        .findById(id)
        .select(DETAIL_PROJECTION)
        .lean()

      if (!item) {
        throw new ItemNotFoundError(id)
      }

      return item
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async existsById(id) {
    this.#assertValidId(id)

    try {
      const found = await this.model.exists({ _id: id })
      return Boolean(found)
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  // Duplicate check inside one category (excludeId lets an update keep its own name)
  async existsByNameInCategory(name, categoryId, excludeId = null) {
    this.#assertValidId(categoryId, "category")

    const filter = { category: categoryId, name: name.trim() }

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

  // File names of all item images in a category. The category service can use
  // this before a category is deleted, to remove the image files of its items.
  async findImagesByCategoryId(categoryId) {
    this.#assertValidId(categoryId, "category")

    try {
      const items = await this.model
        .find({ category: categoryId, image: { $ne: null } })
        .select({ image: 1 })
        .lean()

      return items.map((item) => item.image)
    } catch (error) {
      throw this.#handleError(error)
    }
  }

  async updateById(id, data) {
    this.#assertValidId(id)

    try {
      const item = await this.model
        .findByIdAndUpdate(
          id,
          { $set: data },
          { new: true, runValidators: true }
        )
        .select(DETAIL_PROJECTION)
        .lean()

      if (!item) {
        throw new ItemNotFoundError(id)
      }

      return item
    } catch (error) {
      throw this.#handleError(error, data)
    }
  }

  // Returns { _id, image } so the service can delete the image file
  async deleteById(id) {
    this.#assertValidId(id)

    try {
      const deleted = await this.model
        .findByIdAndDelete(id)
        .select({ image: 1 })
        .lean()

      if (!deleted) {
        throw new ItemNotFoundError(id)
      }

      return deleted
    } catch (error) {
      throw this.#handleError(error)
    }
  }
}

export default ItemRepository