class CategoryError extends Error {
  constructor(
    message,
    { statusCode = 500, code = "CATEGORY_ERROR", details = null, cause } = {}
  ) {
    super(message, cause ? { cause } : undefined)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

class InvalidCategoryIdError extends CategoryError {
  constructor(id) {
    super("Invalid category id", {
      statusCode: 400,
      code: "CATEGORY_INVALID_ID",
      details: { id },
    })
  }
}

class CategoryNotFoundError extends CategoryError {
  constructor(id) {
    super("Category not found", {
      statusCode: 404,
      code: "CATEGORY_NOT_FOUND",
      details: { id },
    })
  }
}

class CategoryAlreadyExistsError extends CategoryError {
  constructor(name) {
    super("A category with this name already exists", {
      statusCode: 409,
      code: "CATEGORY_ALREADY_EXISTS",
      details: { name },
    })
  }
}

class CategoryHasItemsError extends CategoryError {
  constructor(id) {
    super("Category still has items and cannot be deleted", {
      statusCode: 409,
      code: "CATEGORY_HAS_ITEMS",
      details: { id },
    })
  }
}

class CategoryDatabaseError extends CategoryError {
  constructor(message = "Database operation failed", cause) {
    super(message, {
      statusCode: 500,
      code: "CATEGORY_DATABASE_ERROR",
      cause,
    })
  }
}

export default {
  CategoryError,
  InvalidCategoryIdError,
  CategoryNotFoundError,
  CategoryAlreadyExistsError,
  CategoryHasItemsError,
  CategoryDatabaseError,
}