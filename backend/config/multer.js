import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"
import multer from "multer"
import UploadError from "../utils/upload-error.js"

const currentDir = path.dirname(fileURLToPath(import.meta.url))

// backend/config -> frontend/public/images (independent of process.cwd())
const IMAGES_ROOT = path.resolve(currentDir, "../../frontend/public/images")

const DEFAULT_MAX_FILE_SIZE = 500 * 1024 // 500 KB

const getUploadDir = (folder) => path.join(IMAGES_ROOT, folder)

// allowedTypes: { "<mimetype>": "<extension>" }, e.g. { "image/webp": ".webp" }
const createUploader = ({
  folder,
  allowedTypes,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
}) => {
  const directory = getUploadDir(folder)

  fs.mkdirSync(directory, { recursive: true })

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, directory),

    // Unique name generated here; the client's file name is never used.
    // The extension comes from our own map, not from the upload.
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype]}`),
  })

  const fileFilter = (req, file, cb) => {
    const isAllowedType = Object.hasOwn(allowedTypes, file.mimetype)
    const extension = path.extname(file.originalname).toLowerCase()

    if (!isAllowedType || extension !== allowedTypes[file.mimetype]) {
      return cb(
        new UploadError(
          `Only these file types are allowed: ${Object.values(allowedTypes).join(", ")}`,
          {
            statusCode: 415,
            code: "UPLOAD_INVALID_FILE_TYPE",
            details: { field: file.fieldname, mimetype: file.mimetype },
          }
        )
      )
    }

    cb(null, true)
  }

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxFileSize, files: 1 },
  })
}

export default {
  getUploadDir,
  createUploader,
}
