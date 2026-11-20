// Real multer + real files on disk. Every file these tests create is deleted afterwards.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "@jest/globals"
import fs from "node:fs"
import { startApp } from "../helpers/test-app.js"
import { buildForm, file, webp, svg, png, html, trackUploads, listUploads, pathOfUrl } from "../helpers/files.js"

let app, uploads
beforeAll(async () => { app = await startApp() })
afterAll(() => app.close())
beforeEach(() => { app.fakeDb.reset(); uploads = trackUploads() })
afterEach(() => uploads.cleanup())

const KB = 1024
const postCategory = (fields, files) => app.request("POST", "/api/categories", { form: buildForm(fields, files) })
const patchCategory = (id, fields, files) => app.request("PATCH", `/api/categories/${id}`, { form: buildForm(fields, files) })
const onDisk = (url) => fs.existsSync(pathOfUrl(url))
const icon = (bytes = webp(64), name = "i.webp", type = "image/webp") => ({ icon: file(bytes, name, type) })
const image = (bytes = webp(64), name = "i.webp", type = "image/webp") => ({ image: file(bytes, name, type) })

describe("category icon", () => {
  it("a WebP or SVG icon is saved under a unique generated name and its URL is returned", async () => {
    const first = await postCategory({ name: "A" }, icon())
    const second = await postCategory({ name: "B" }, icon(svg(), "x.svg", "image/svg+xml"))

    expect(first.status).toBe(201)
    expect(first.body.icon).toMatch(/^\/images\/category\/[0-9a-f-]{36}\.webp$/)
    expect(second.body.icon).toMatch(/^\/images\/category\/[0-9a-f-]{36}\.svg$/)
    expect(first.body.icon).not.toBe(second.body.icon)
    expect(onDisk(first.body.icon) && onDisk(second.body.icon)).toBeTruthy()
  })

  it("the icon is optional: JSON, a form without a file and an empty file field all work", async () => {
    expect((await app.request("POST", "/api/categories", { json: { name: "A" } })).body.icon).toBe(null)
    expect((await postCategory({ name: "B" })).body.icon).toBe(null)
    expect((await postCategory({ name: "C" }, icon(Buffer.alloc(0), "", "application/octet-stream"))).body.icon).toBe(null)
    expect(uploads.created("category")).toEqual([])
  })

  it("size limit is 500 KB: exactly 500 KB is accepted, one byte more is 413 'too big' and nothing is saved", async () => {
    expect((await postCategory({ name: "A" }, icon(webp(500 * KB)))).status).toBe(201)
    uploads.cleanup()

    const { status, body } = await postCategory({ name: "B" }, icon(webp(500 * KB + 1)))
    expect(status).toBe(413)
    expect(body.code).toBe("UPLOAD_LIMIT_FILE_SIZE")
    expect(body.message).toBe("The size of this picture is too big")
    expect(uploads.created("category")).toEqual([])
  })

  it("wrong file types and fake content are refused and nothing is saved", async () => {
    const png415 = await postCategory({ name: "A" }, icon(png(), "p.png", "image/png"))
    expect(png415.status).toBe(415)
    expect(png415.body.code).toBe("UPLOAD_INVALID_FILE_TYPE")

    const fakeSvg = await postCategory({ name: "B" }, icon(html(), "f.svg", "image/svg+xml"))
    expect(fakeSvg.status).toBe(415)
    expect(fakeSvg.body.code).toBe("UPLOAD_INVALID_FILE_CONTENT")

    const fakeWebp = await postCategory({ name: "C" }, icon(png(), "f.webp", "image/webp"))
    expect(fakeWebp.status).toBe(415)

    expect(uploads.created("category")).toEqual([])
  })

  it("two files, or a file under the wrong field name, are refused (400) and nothing is saved", async () => {
    const two = await app.request("POST", "/api/categories", { form: (() => { const f = buildForm({ name: "A" }); f.append("icon", file(webp(), "1.webp", "image/webp")); f.append("icon", file(webp(), "2.webp", "image/webp")); return f })() })
    const wrong = await postCategory({ name: "B" }, { picture: file(webp(), "w.webp", "image/webp") })

    expect(two.status).toBe(400)
    expect(wrong.status).toBe(400)
    expect(uploads.created("category")).toEqual([])
  })

  it("if the request fails AFTER the upload, the picture is deleted: missing data and duplicate name", async () => {
    const missing = await postCategory({ description: "no name" }, icon())
    expect(missing.status).toBe(400)
    expect(uploads.created("category")).toEqual([])

    const first = await postCategory({ name: "Coffee" }, icon())
    const duplicate = await postCategory({ name: "Coffee" }, icon())

    expect(duplicate.status).toBe(409)
    expect(uploads.created("category").length).toBe(1)
    expect(onDisk(first.body.icon)).toBeTruthy()
  })

  it("replacing the icon deletes the old file; removeIcon deletes it and sets null", async () => {
    const { body: created } = await postCategory({ name: "Coffee" }, icon())

    const replaced = await patchCategory(created.id, {}, icon(svg(), "n.svg", "image/svg+xml"))
    expect(replaced.status).toBe(200)
    expect(onDisk(created.icon)).toBe(false)
    expect(onDisk(replaced.body.icon)).toBeTruthy()

    const removed = await patchCategory(created.id, { removeIcon: "true" })
    expect(removed.body.icon).toBe(null)
    expect(onDisk(replaced.body.icon)).toBe(false)
    expect(uploads.created("category")).toEqual([])
  })

  it("a failed update keeps the old icon and deletes the new picture", async () => {
    await postCategory({ name: "Tea" })
    const { body: coffee } = await postCategory({ name: "Coffee" }, icon())

    const failed = await patchCategory(coffee.id, { name: "Tea" }, icon(svg(), "n.svg", "image/svg+xml"))

    expect(failed.status).toBe(409)
    expect(onDisk(coffee.icon)).toBeTruthy()
    expect(uploads.created("category").length).toBe(1)
  })
})

describe("item image", () => {
  let categoryId
  beforeEach(async () => { categoryId = (await app.request("POST", "/api/categories", { json: { name: "Coffee" } })).body.id })

  const postItem = (fields, files) => app.request("POST", "/api/items", { form: buildForm({ price: "4", category: categoryId, ...fields }, files) })

  it("an item image is saved in the item folder; the image is optional", async () => {
    const withImage = await postItem({ name: "Latte" }, image())
    const without = await postItem({ name: "Mocha" })

    expect(withImage.body.image).toMatch(/^\/images\/item\/[0-9a-f-]{36}\.webp$/)
    expect(onDisk(withImage.body.image)).toBeTruthy()
    expect(without.body.image).toBe(null)
  })

  it("size limit is 200 KB: exactly 200 KB is accepted, one byte more is 413", async () => {
    expect((await postItem({ name: "A" }, image(webp(200 * KB)))).status).toBe(201)
    uploads.cleanup()

    const { status, body } = await postItem({ name: "B" }, image(webp(200 * KB + 1)))
    expect(status).toBe(413)
    expect(body.message).toBe("The size of this picture is too big")
    expect(uploads.created("item")).toEqual([])
  })

  it("wrong type and fake content are refused; a failure after the upload deletes the picture", async () => {
    expect((await postItem({ name: "A" }, image(png(), "p.png", "image/png"))).status).toBe(415)
    expect((await postItem({ name: "B" }, image(html(), "f.svg", "image/svg+xml"))).status).toBe(415)

    const noPrice = await app.request("POST", "/api/items", { form: buildForm({ name: "C", category: categoryId }, image()) })
    expect(noPrice.status).toBe(400)

    const noCategory = await postItem({ name: "D", category: "64b7f0a2c3d4e5f607189999" }, image())
    expect(noCategory.body.code).toBe("ITEM_CATEGORY_NOT_FOUND")

    expect(uploads.created("item")).toEqual([])
  })

  it("replace, remove and delete all clean up the files", async () => {
    const { body: created } = await postItem({ name: "Latte" }, image())

    const replaced = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({}, image(svg(), "n.svg", "image/svg+xml")) })
    expect(onDisk(created.image)).toBe(false)
    expect(onDisk(replaced.body.image)).toBeTruthy()

    const removed = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({ removeImage: "true" }) })
    expect(removed.body.image).toBe(null)
    expect(onDisk(replaced.body.image)).toBe(false)

    const again = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({}, image()) })
    expect((await app.request("DELETE", `/api/items/${created.id}`)).status).toBe(204)
    expect(onDisk(again.body.image)).toBe(false)
    expect(uploads.created("item")).toEqual([])
  })
})

describe("deleting a category cleans up every picture that belonged to it", () => {
  it("removes the category icon, its items AND the items' image files", async () => {
    const { body: coffee } = await postCategory({ name: "Coffee" }, icon())
    const { body: tea } = await postCategory({ name: "Tea" }, icon())
    const item = (name, category, files) => app.request("POST", "/api/items", { form: buildForm({ name, price: "1", category }, files) })

    const latte = (await item("Latte", coffee.id, image())).body
    const green = (await item("Green tea", tea.id, image())).body

    expect((await app.request("DELETE", `/api/categories/${coffee.id}`)).status).toBe(204)

    expect(onDisk(coffee.icon)).toBe(false)
    expect(onDisk(latte.image)).toBe(false)
    expect(onDisk(tea.icon)).toBeTruthy()
    expect(onDisk(green.image)).toBeTruthy()
    expect(listUploads("item").includes(pathOfUrl(green.image).split(/[\\/]/).pop())).toBe(true)
  })
})
