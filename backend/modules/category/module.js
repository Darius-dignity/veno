import Category from "./model.js"
import CategoryRepository from "./repository.js"
import CategoryService from "./service.js"
import CategoryController from "./controller.js"
import CategoryRoute from "./route.js"
import CategoryValidation from "./validate.js"
import validate from "../../middlewares/validate.js"
import upload from "../../middlewares/upload.js"
import multerConfig from "../../config/multer.js"
import FileStorage from "../../utils/file-storage.js"

const ICON_FOLDER = "category"

const createCategoryModule = () => {
  const iconUploader = multerConfig.createUploader({
    folder: ICON_FOLDER,
    allowedTypes: { "image/svg+xml": ".svg", "image/webp": ".webp" },
    maxFileSize: 500 * 1024, // 500 KB
  })

  const iconStorage = new FileStorage({
    directory: multerConfig.getUploadDir(ICON_FOLDER),
  })

  const categoryRepository = new CategoryRepository(Category)

  const categoryService = new CategoryService({
    categoryRepository,
    iconStorage,
  })

  const categoryController = new CategoryController({ categoryService })

  const categoryRoute = new CategoryRoute({
    categoryController,
    categoryValidation: CategoryValidation,
    validate,
    uploadIcon: upload.uploadSingle(iconUploader, "icon"),
    removeUploadedFileOnError: upload.removeUploadedFileOnError,
  })

  return {
    categoryRepository,
    categoryService,
    categoryController,
    categoryRouter: categoryRoute.router,
  }
}

export default createCategoryModule
