import fs from "node:fs/promises"
import path from "node:path"
import multer from "multer"
import UploadError from "../utils/upload-error.js"

const MULTER_ERRORS = {
  LIMIT_FILE_SIZE: { statusCode: 413, message: "The size of this picture is too big" },
  LIMIT_FILE_COUNT: { statusCode: 400, message: "Too many files" },
  LIMIT_UNEXPECTED_FILE: { statusCode: 400, message: "Unexpected file field" },
}

const toUploadError = (error) => {
  const known = MULTER_ERRORS[error.code]

  return new UploadError(known?.message ?? error.message, {
    statusCode: known?.statusCode ?? 400,
    code: `UPLOAD_${error.code}`,
    details: { field: error.field },
  })
}

// The mimetype and file name come from the client and can be faked,
// so we also look at the real content of the saved file.
const HEAD_LENGTH = 4096

const CONTENT_CHECKS = {
  // WebP files start with "RIFF", 4 size bytes, then "WEBP"
  ".webp": (head) =>
    head.length >= 12 &&
    head.toString("ascii", 0, 4) === "RIFF" &&
    head.toString("ascii", 8, 12) === "WEBP",

  // SVG is XML text that contains an <svg> element
  ".svg": (head) => /<svg[\s>]/i.test(head.toString("utf8")),
}

const readHead = async (filePath) => {
  const handle = await fs.open(filePath, "r")

  try {
    const buffer = Buffer.alloc(HEAD_LENGTH)
    const { bytesRead } = await handle.read(buffer, 0, HEAD_LENGTH, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const hasValidContent = async (file) => {
  const check = CONTENT_CHECKS[path.extname(file.filename).toLowerCase()]

  if (!check) return true

  return check(await readHead(file.path))
}

// uploadSingle(uploader, "icon") -> puts the saved file on req.file
const uploadSingle = (uploader, fieldName) => (req, res, next) => {
  uploader.single(fieldName)(req, res, async (error) => {
    if (error) {
      if (error instanceof multer.MulterError) {
        return next(toUploadError(error))
      }

      return next(error)
    }

    if (!req.file) return next()

    try {
      if (!(await hasValidContent(req.file))) {
        await fs.unlink(req.file.path).catch(() => {})
        req.file = undefined

        return next(
          new UploadError("The file content does not match its file type", {
            statusCode: 415,
            code: "UPLOAD_INVALID_FILE_CONTENT",
            details: { field: fieldName },
          })
        )
      }

      next()
    } catch (readError) {
      next(readError)
    }
  })
}

// Error middleware: if anything fails after the file was saved
// (validation, duplicate name, DB error), delete the orphaned file.
const removeUploadedFileOnError = (error, req, res, next) => {
  if (req.file?.path) {
    fs.unlink(req.file.path).catch(() => {})
  }

  next(error)
}

export default {
  uploadSingle,
  removeUploadedFileOnError,
}
