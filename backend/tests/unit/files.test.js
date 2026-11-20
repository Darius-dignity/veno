import { describe, it, expect, beforeEach, afterEach, jest } from "@jest/globals"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import multer from "multer"
import FileStorage from "../../utils/file-storage.js"
import UploadError from "../../utils/upload-error.js"
import upload from "../../middlewares/upload.js"
import { webp, svg, png, html } from "../helpers/files.js"

let dir

beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "veno-test-")) })
afterEach(() => {
  jest.restoreAllMocks()
  fs.rmSync(dir, { recursive: true, force: true })
})

describe("FileStorage.remove", () => {
  it("deletes an existing file", async () => {
    fs.writeFileSync(path.join(dir, "a.webp"), "x")
    await new FileStorage({ directory: dir }).remove("a.webp")
    expect(fs.existsSync(path.join(dir, "a.webp"))).toBe(false)
  })

  it("never throws for a missing file, null or undefined", async () => {
    const storage = new FileStorage({ directory: dir })
    await storage.remove("missing.webp")
    await storage.remove(null)
    await storage.remove(undefined)
  })

  it("cannot delete files outside its folder (path traversal)", async () => {
    const uploads = path.join(dir, "uploads")
    fs.mkdirSync(uploads)
    fs.writeFileSync(path.join(dir, "secret.txt"), "keep me")

    await new FileStorage({ directory: uploads }).remove("../secret.txt")

    expect(fs.existsSync(path.join(dir, "secret.txt"))).toBe(true)
  })

  it("a failing delete does not throw (a leftover file must not break a successful request)", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {})
    fs.mkdirSync(path.join(dir, "folder")) // deleting a directory with unlink fails

    await new FileStorage({ directory: dir }).remove("folder")

    expect(log.mock.calls.length).toBe(1)
  })
})

// A fake multer: writes the file like multer would and sets req.file
const runUpload = async (filename, bytes) => {
  const filePath = path.join(dir, filename)
  fs.writeFileSync(filePath, bytes)

  const uploader = { single: () => (req, res, cb) => { req.file = { path: filePath, filename }; cb() } }
  const req = {}

  const error = await new Promise((resolve) => upload.uploadSingle(uploader, "icon")(req, {}, resolve))
  return { error, exists: fs.existsSync(filePath), req }
}

describe("upload content check (the file must really be what its name says)", () => {
  it("accepts a real WebP and a real SVG", async () => {
    expect((await runUpload("a.webp", webp(64))).error).toBe(undefined)
    expect((await runUpload("a.svg", svg())).error).toBe(undefined)
  })

  it("accepts an SVG with a long comment before <svg> (50 KB)", async () => {
    const bytes = Buffer.from("<!-- " + "x".repeat(50000) + " -->" + svg())
    expect((await runUpload("long.svg", bytes)).error).toBe(undefined)
  })

  for (const [label, name, bytes] of [
    ["a PNG renamed .webp", "fake.webp", png()],
    ["HTML renamed .svg", "fake.svg", html()],
    ["an empty .svg", "empty.svg", Buffer.alloc(0)],
    ["a truncated .webp", "cut.webp", Buffer.from("RIFF")],
  ]) {
    it(`rejects ${label} with 415 and deletes the file`, async () => {
      const { error, exists } = await runUpload(name, bytes)

      expect(error.statusCode).toBe(415)
      expect(error.code).toBe("UPLOAD_INVALID_FILE_CONTENT")
      expect(exists).toBe(false)
    })
  }

  it("a request without a file passes straight through (the image is optional)", async () => {
    const uploader = { single: () => (req, res, cb) => cb() }
    const error = await new Promise((resolve) => upload.uploadSingle(uploader, "icon")({}, {}, resolve))
    expect(error).toBe(undefined)
  })

  it("maps multer's size error to 413 'The size of this picture is too big'", async () => {
    const uploader = { single: () => (req, res, cb) => cb(new multer.MulterError("LIMIT_FILE_SIZE", "icon")) }
    const error = await new Promise((resolve) => upload.uploadSingle(uploader, "icon")({}, {}, resolve))

    expect(error.statusCode).toBe(413)
    expect(error.code).toBe("UPLOAD_LIMIT_FILE_SIZE")
    expect(error.message).toBe("The size of this picture is too big")
  })

  it("passes our own upload errors (wrong file type) on unchanged", async () => {
    const original = new UploadError("wrong type", { statusCode: 415, code: "UPLOAD_INVALID_FILE_TYPE" })
    const uploader = { single: () => (req, res, cb) => cb(original) }
    const error = await new Promise((resolve) => upload.uploadSingle(uploader, "icon")({}, {}, resolve))

    expect(error).toBe(original)
  })
})

describe("removeUploadedFileOnError", () => {
  it("deletes the uploaded file BEFORE the error continues (no leftover picture)", async () => {
    const filePath = path.join(dir, "up.webp")
    fs.writeFileSync(filePath, "x")
    let existedWhenNextCalled = null
    const failure = new Error("validation failed")

    await upload.removeUploadedFileOnError(failure, { file: { path: filePath } }, {}, (error) => {
      existedWhenNextCalled = fs.existsSync(filePath)
      expect(error).toBe(failure)
    })

    expect(existedWhenNextCalled).toBe(false)
  })

  it("without an uploaded file it just passes the error on", async () => {
    const failure = new Error("x")
    let passed = null
    await upload.removeUploadedFileOnError(failure, {}, {}, (error) => { passed = error })
    expect(passed).toBe(failure)
  })
})
