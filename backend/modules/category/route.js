import { Router } from "express"

class CategoryRoute {
  constructor({
    categoryController,
    categoryValidation,
    validate,
    uploadIcon,
    removeUploadedFileOnError,
  }) {
    this.controller = categoryController
    this.schemas = categoryValidation
    this.validate = validate
    this.uploadIcon = uploadIcon
    this.removeUploadedFileOnError = removeUploadedFileOnError
    this.router = Router()

    this.#registerRoutes()
  }

  #registerRoutes() {
    const { controller, schemas, validate, uploadIcon, router } = this

    // Static path first, so "menu" is not read as an :id
    router.get("/menu", controller.getMenu)

    router.get(
      "/",
      validate({ query: schemas.listCategoriesQuery }),
      controller.getAll
    )

    router.get(
      "/:id",
      validate({ params: schemas.categoryIdParams }),
      controller.getById
    )

    // multer must run before body validation: the body is multipart/form-data
    router.post(
      "/",
      uploadIcon,
      validate({ body: schemas.createCategoryBody }),
      controller.create
    )

    // params are validated first, so a bad id never causes a file to be written
    router.patch(
      "/:id",
      validate({ params: schemas.categoryIdParams }),
      uploadIcon,
      validate({ body: schemas.updateCategoryBody }),
      controller.update
    )

    router.delete(
      "/:id",
      validate({ params: schemas.categoryIdParams }),
      controller.delete
    )

    // Must stay last: deletes the uploaded file if any handler above failed
    router.use(this.removeUploadedFileOnError)
  }
}

export default CategoryRoute