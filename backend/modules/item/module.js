import Item from "./model.js"
import ItemRepository from "./repository.js"
import ItemService from "./service.js"
import ItemController from "./controller.js"
import ItemRoute from "./route.js"
import ItemValidation from "./validate.js"
import validate from "../../middlewares/validate.js"
import upload from "../../middlewares/upload.js"
import multerConfig from "../../config/multer.js"
import FileStorage from "../../utils/file-storage.js"

// Must match IMAGE_PUBLIC_PATH ("/images/item") in dto.js
const IMAGE_FOLDER = "item"

// categoryService comes from the category module.
// itemRepository is optional: pass one in when another module needs the same
// instance (avoids a circular import), otherwise a new one is created.
const createItemModule = ({
  categoryService,
  itemRepository = new ItemRepository(Item),
}) => {
  // The image is optional. When one is sent it must be SVG or WebP, max 200 KB.
  const imageUploader = multerConfig.createUploader({
    folder: IMAGE_FOLDER,
    allowedTypes: { "image/svg+xml": ".svg", "image/webp": ".webp" },
    maxFileSize: 200 * 1024, // 200 KB
  })

  const imageStorage = new FileStorage({
    directory: multerConfig.getUploadDir(IMAGE_FOLDER),
  })

  const itemService = new ItemService({
    itemRepository,
    categoryService,
    imageStorage,
  })

  const itemController = new ItemController({ itemService })

  const itemRoute = new ItemRoute({
    itemController,
    itemValidation: ItemValidation,
    validate,
    uploadImage: upload.uploadSingle(imageUploader, "image"),
    removeUploadedFileOnError: upload.removeUploadedFileOnError,
  })

  return {
    itemRepository,
    itemService,
    itemController,
    itemRouter: itemRoute.router,
  }
}

export default createItemModule