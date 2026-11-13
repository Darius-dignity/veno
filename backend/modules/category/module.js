import CategoryRepository from "./repository.js"
import CategoryService from "./service.js"
import CategoryController from "./controller.js"
import CategoryRoute from "./route.js"
import CategoryValidation from "./validate.js"
import validate from "../../middlewares/validate.js"

// itemRepository comes from outside (see notes below)
const createCategoryModule = ({ itemRepository }) => {
  const categoryRepository = new CategoryRepository()

  const categoryService = new CategoryService({
    categoryRepository,
    itemRepository,
  })

  const categoryController = new CategoryController({ categoryService })

  const categoryRoute = new CategoryRoute({
    categoryController,
    categoryValidation: CategoryValidation,
    validate,
  })

  return {
    categoryRepository,
    categoryService,
    categoryController,
    categoryRouter: categoryRoute.router
  }
}

export default createCategoryModule