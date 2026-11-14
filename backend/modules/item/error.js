class ItemError extends Error {
  constructor(
    message,
    { statusCode = 500, code = "ITEM_ERROR", details = null, cause } = {}
  ) {
    super(message, cause ? { cause } : undefined)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

// field tells which id was wrong: "id" (the item) or "category" (a filter)
class InvalidItemIdError extends ItemError {
  constructor(id, field = "id") {
    super(field === "id" ? "Invalid item id" : `Invalid ${field} id`, {
      statusCode: 400,
      code: "ITEM_INVALID_ID",
      details: { field, id },
    })
  }
}

class ItemNotFoundError extends ItemError {
  constructor(id) {
    super("Item not found", {
      statusCode: 404,
      code: "ITEM_NOT_FOUND",
      details: { id },
    })
  }
}

class ItemAlreadyExistsError extends ItemError {
  constructor(name, category) {
    super("An item with this name already exists in this category", {
      statusCode: 409,
      code: "ITEM_ALREADY_EXISTS",
      details: { name, category },
    })
  }
}

// MongoDB has no foreign key check, so the service throws this
// when the category sent with an item does not exist
class ItemCategoryNotFoundError extends ItemError {
  constructor(category) {
    super("The category of this item does not exist", {
      statusCode: 400,
      code: "ITEM_CATEGORY_NOT_FOUND",
      details: { category },
    })
  }
}

class ItemEmptyUpdateError extends ItemError {
  constructor() {
    super("Nothing to update", {
      statusCode: 400,
      code: "ITEM_EMPTY_UPDATE",
    })
  }
}

class ItemDatabaseError extends ItemError {
  constructor(message = "Database operation failed", cause) {
    super(message, {
      statusCode: 500,
      code: "ITEM_DATABASE_ERROR",
      cause,
    })
  }
}

export default {
  ItemError,
  InvalidItemIdError,
  ItemNotFoundError,
  ItemAlreadyExistsError,
  ItemCategoryNotFoundError,
  ItemEmptyUpdateError,
  ItemDatabaseError,
}