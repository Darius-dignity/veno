import { STATUS_CODES } from "node:http"
import env from "../config/env.js"

// What happened and what the client can do about it, per error code
const EXPLANATIONS = {
  VALIDATION_ERROR:
    "One or more fields in your request are missing or have the wrong format. Check the 'details' list, fix each field and send the request again.",
  INVALID_JSON:
    "The request body is not valid JSON. Check for a missing quote, comma or bracket.",
  PAYLOAD_TOO_LARGE:
    "The request body is bigger than the server accepts. Send less data.",
  ROUTE_NOT_FOUND:
    "No API exists for this HTTP method and path. Check the URL and the method (GET, POST, PATCH, DELETE).",
  RATE_LIMIT_EXCEEDED:
    "You sent too many requests from your IP address in a short time. Wait for 'retryAfterSeconds' (also in the Retry-After header) and try again.",
  CORS_ORIGIN_NOT_ALLOWED:
    "This website is not allowed to call the API from a browser. Add its address to CORS_ORIGINS in the server's .env file.",

  UPLOAD_LIMIT_FILE_SIZE:
    "The picture is bigger than the allowed size. Category icons can be up to 500 KB and item images up to 200 KB.",
  UPLOAD_INVALID_FILE_TYPE: "Only SVG and WebP pictures are accepted.",
  UPLOAD_INVALID_FILE_CONTENT:
    "The content of the file does not match its type (for example a renamed file). Upload a real SVG or WebP picture.",
  UPLOAD_LIMIT_UNEXPECTED_FILE:
    "The file was sent under the wrong field name. Use 'icon' for categories and 'image' for items.",
  UPLOAD_LIMIT_FILE_COUNT: "Only one picture can be sent per request.",
  UPLOAD_ERROR: "The picture could not be uploaded. Check the file and try again.",

  CATEGORY_INVALID_ID: "The category id must be a valid 24-character id.",
  CATEGORY_NOT_FOUND:
    "No category with this id exists (or it is not active). Check the id.",
  CATEGORY_ALREADY_EXISTS:
    "Category names must be unique. Choose a different name.",
  CATEGORY_EMPTY_UPDATE:
    "Nothing to update. Send at least one field to change (name, description, isActive, icon or removeIcon).",

  ITEM_INVALID_ID: "The id must be a valid 24-character id.",
  ITEM_NOT_FOUND: "No item with this id exists. Check the id.",
  ITEM_ALREADY_EXISTS:
    "An item name must be unique inside its category. Choose a different name or another category.",
  ITEM_CATEGORY_NOT_FOUND:
    "The category you sent does not exist. Create it first or use the id of an existing category.",
  ITEM_EMPTY_UPDATE:
    "Nothing to update. Send at least one field to change (name, description, price, isAvailable, category, image or removeImage).",

  CATEGORY_DATABASE_ERROR:
    "The server could not complete the database operation. This is not a problem with your request. Try again later.",
  ITEM_DATABASE_ERROR:
    "The server could not complete the database operation. This is not a problem with your request. Try again later.",
  INTERNAL_SERVER_ERROR:
    "Something unexpected went wrong on the server. This is not a problem with your request. Try again later.",
}

// Used when a code has no explanation of its own
const EXPLANATIONS_BY_STATUS = {
  400: "The request is not valid. Check the data you sent.",
  403: "You are not allowed to do this.",
  404: "The requested resource was not found.",
  409: "The request conflicts with data that already exists.",
  413: "The data you sent is too large.",
  415: "The type of data you sent is not supported.",
  429: "You sent too many requests. Wait a moment and try again.",
  500: "Something went wrong on the server. This is not a problem with your request. Try again later.",
}

const isProduction = () => env.node_env === "production"

const toCode = (status) =>
  (STATUS_CODES[status] ?? "Error").toUpperCase().replace(/[^A-Z0-9]+/g, "_")

// Turns any thrown value into { status, code, message, details, known }
const normalize = (error) => {
  // Errors created by express.json() (body-parser)
  if (error.type === "entity.parse.failed") {
    return {
      status: 400,
      code: "INVALID_JSON",
      message: "Request body is not valid JSON",
      details: null,
      known: true,
    }
  }

  if (error.type === "entity.too.large") {
    return {
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large",
      details: { limit: error.limit ?? null },
      known: true,
    }
  }

  const rawStatus = error.statusCode ?? error.status
  const hasStatus =
    Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599

  // "known" = one of our own errors (it has a status and a string code),
  // so its message is written for the client and is safe to show
  const known = hasStatus && typeof error.code === "string"
  const status = hasStatus ? rawStatus : 500

  return {
    status,
    code: known ? error.code : status === 500 ? "INTERNAL_SERVER_ERROR" : toCode(status),
    message:
      status < 500 || known ? error.message : "Internal server error",
    details: error.details ?? null,
    known,
  }
}

// Express recognizes an error handler by its 4 parameters: keep all four.
const errorHandler = (error, req, res, next) => {
  // The response already started: Express must close the connection itself
  if (res.headersSent) {
    return next(error)
  }

  const err = error instanceof Error ? error : new Error(String(error))
  const { status, code, message, details } = normalize(err)

  // Server errors are logged with their real cause; client errors are not
  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} -> ${status} ${code}`, err)
  }

  const body = {
    success: false,
    status,
    code,
    error: STATUS_CODES[status] ?? "Error",
    message,
    explanation:
      EXPLANATIONS[code] ??
      EXPLANATIONS_BY_STATUS[status] ??
      EXPLANATIONS_BY_STATUS[status >= 500 ? 500 : 400],
    path: req.originalUrl.split("?")[0],
    method: req.method,
    timestamp: new Date().toISOString(),
  }

  if (details !== null) {
    body.details = details
  }

  // Real cause of a server error: only while developing, never in production
  if (status >= 500 && !isProduction()) {
    body.debug = {
      name: err.name,
      message: err.message,
      cause: err.cause?.message ?? null,
      stack: err.stack?.split("\n").slice(0, 8),
    }
  }

  res.status(status).json(body)
}

export default errorHandler
