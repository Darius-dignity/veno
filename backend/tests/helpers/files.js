import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { File } from "node:buffer"

// A real WebP starts with "RIFF", 4 size bytes, then "WEBP". `size` = total bytes.
export const webp = (size = 64) => {
  const header = Buffer.concat([
    Buffer.from("RIFF"),
    Buffer.from([0x24, 0, 0, 0]),
    Buffer.from("WEBPVP8 "),
  ])

  return Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length))])
}

export const svg = () =>
  Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>'
  )

export const png = () =>
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(32),
  ])

export const html = () =>
  Buffer.from("<html><script>alert(1)</script></html>")

export const file = (bytes, name, type) => new File([bytes], name, { type })

// buildForm({ name: "Coffee" }, { icon: file(...) })
export const buildForm = (fields = {}, files = {}) => {
  const form = new FormData()

  for (const [key, value] of Object.entries(fields)) form.append(key, value)
  for (const [key, value] of Object.entries(files)) form.append(key, value)

  return form
}

// ---- the folders where uploaded pictures are saved ----
const here = path.dirname(fileURLToPath(import.meta.url))
const imagesRoot = path.resolve(here, "../../../frontend/public/images")

export const uploadDir = (folder) => path.join(imagesRoot, folder)

export const listUploads = (folder) => {
  const dir = uploadDir(folder)
  fs.mkdirSync(dir, { recursive: true })
  return fs.readdirSync(dir).filter((name) => name !== ".gitkeep")
}

// Remembers the files that exist now; cleanup() deletes every file created after that
export const trackUploads = () => {
  const before = { category: listUploads("category"), item: listUploads("item") }

  return {
    created: (folder) => listUploads(folder).filter((n) => !before[folder].includes(n)),
    cleanup() {
      for (const folder of ["category", "item"]) {
        for (const name of listUploads(folder)) {
          if (!before[folder].includes(name)) {
            fs.rmSync(path.join(uploadDir(folder), name), { force: true })
          }
        }
      }
    },
  }
}

// "/images/category/abc.webp" -> the real file path on disk
export const pathOfUrl = (url) => path.join(imagesRoot, ...url.replace("/images/", "").split("/"))
