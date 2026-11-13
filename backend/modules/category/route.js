import { Router } from "express"

class CategoryRoute {
  constructor({ categoryController, categoryValidation, validate }) {
    this.controller = categoryController
    this.schemas = categoryValidation
    this.validate = validate
    this.router = Router()

    this.#registerRoutes()
  }

  #registerRoutes() {
    const { controller, schemas, validate, router } = this

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

    router.post(
      "/",
      validate({ body: schemas.createCategoryBody }),
      controller.create
    )

    router.patch(
      "/:id",
      validate({
        params: schemas.categoryIdParams,
        body: schemas.updateCategoryBody,
      }),
      controller.update
    )

    router.delete(
      "/:id",
      validate({ params: schemas.categoryIdParams }),
      controller.delete
    )
  }
}

export default CategoryRoute