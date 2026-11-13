class UploadError extends Error {
  constructor(
    message,
    { statusCode = 400, code = "UPLOAD_ERROR", details = null } = {}
  ) {
    super(message)
    this.name = "UploadError"
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }
}

export default UploadError
