class ValidationError extends Error {
  constructor(source, issues) {
    super("Validation failed")
    this.name = "ValidationError"
    this.statusCode = 400
    this.code = "VALIDATION_ERROR"
    this.details = issues.map((issue) => ({
      source,
      path: issue.path.join("."),
      message: issue.message,
    }))
  }
}

// validate({ params: schema, query: schema, body: schema })
const validate = (schemas) => (req, res, next) => {
  for (const source of ["params", "query", "body"]) {
    if (!schemas[source]) continue

    const result = schemas[source].safeParse(req[source])

    if (!result.success) {
      return next(new ValidationError(source, result.error.issues))
    }

    // defineProperty because req.query is read-only on Express 5
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
  }

  next()
}

export default validate