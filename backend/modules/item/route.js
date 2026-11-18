import { Router } from "express"

class ItemRoute {
  constructor({
    itemController,
    itemValidation,
    validate,
    uploadImage,
    removeUploadedFileOnError,
    publicLimiter,
    adminLimiter,
  }) {
    this.controller = itemController
    this.schemas = itemValidation
    this.validate = validate
    this.uploadImage = uploadImage
    this.removeUploadedFileOnError = removeUploadedFileOnError
    this.publicLimiter = publicLimiter
    this.adminLimiter = adminLimiter
    this.router = Router()

    this.#registerRoutes()
  }

  #registerRoutes() {
    const {
      controller,
      schemas,
      validate,
      uploadImage,
      publicLimiter,
      adminLimiter,
      router,
    } = this

    // The limiter always comes first: a blocked request is stopped before it
    // can upload a file, be validated or reach the database

    // Public: available items of one active category
    router.get(
      "/menu/:categoryId",
      publicLimiter,
      validate({ params: schemas.menuCategoryParams }),
      controller.getMenu
    )

    router.get(
      "/",
      adminLimiter,
      validate({ query: schemas.listItemsQuery }),
      controller.getAll
    )

    router.get(
      "/:id",
      adminLimiter,
      validate({ params: schemas.itemIdParams }),
      controller.getById
    )

    // The image is optional: without a file, uploadImage just calls next().
    // multer must run before body validation: the body is multipart/form-data
    router.post(
      "/",
      adminLimiter,
      uploadImage,
      validate({ body: schemas.createItemBody }),
      controller.create
    )

    // params are validated first, so a bad id never causes a file to be written
    router.patch(
      "/:id",
      adminLimiter,
      validate({ params: schemas.itemIdParams }),
      uploadImage,
      validate({ body: schemas.updateItemBody }),
      controller.update
    )

    router.delete(
      "/:id",
      adminLimiter,
      validate({ params: schemas.itemIdParams }),
      controller.delete
    )

    // Must stay last: deletes the uploaded file if any handler above failed
    router.use(this.removeUploadedFileOnError)
  }
}

export default ItemRoute