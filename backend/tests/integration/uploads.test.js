// Real multer + real files on disk. Every file these tests create is deleted afterwards.
import { describe, it, before, beforeEach, afterEach, after } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { startApp } from "../helpers/test-app.js"
import { buildForm, file, webp, svg, png, html, trackUploads, listUploads, pathOfUrl } from "../helpers/files.js"

let app, uploads
before(async () => { app = await startApp() })
after(() => app.close())
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

    assert.equal(first.status, 201)
    assert.match(first.body.icon, /^\/images\/category\/[0-9a-f-]{36}\.webp$/)
    assert.match(second.body.icon, /^\/images\/category\/[0-9a-f-]{36}\.svg$/)
    assert.notEqual(first.body.icon, second.body.icon)
    assert.ok(onDisk(first.body.icon) && onDisk(second.body.icon))
  })

  it("the icon is optional: JSON, a form without a file and an empty file field all work", async () => {
    assert.equal((await app.request("POST", "/api/categories", { json: { name: "A" } })).body.icon, null)
    assert.equal((await postCategory({ name: "B" })).body.icon, null)
    assert.equal((await postCategory({ name: "C" }, icon(Buffer.alloc(0), "", "application/octet-stream"))).body.icon, null)
    assert.deepEqual(uploads.created("category"), [])
  })

  it("size limit is 500 KB: exactly 500 KB is accepted, one byte more is 413 'too big' and nothing is saved", async () => {
    assert.equal((await postCategory({ name: "A" }, icon(webp(500 * KB)))).status, 201)
    uploads.cleanup()

    const { status, body } = await postCategory({ name: "B" }, icon(webp(500 * KB + 1)))
    assert.equal(status, 413)
    assert.equal(body.code, "UPLOAD_LIMIT_FILE_SIZE")
    assert.equal(body.message, "The size of this picture is too big")
    assert.deepEqual(uploads.created("category"), [])
  })

  it("wrong file types and fake content are refused and nothing is saved", async () => {
    const png415 = await postCategory({ name: "A" }, icon(png(), "p.png", "image/png"))
    assert.equal(png415.status, 415)
    assert.equal(png415.body.code, "UPLOAD_INVALID_FILE_TYPE")

    const fakeSvg = await postCategory({ name: "B" }, icon(html(), "f.svg", "image/svg+xml"))
    assert.equal(fakeSvg.status, 415)
    assert.equal(fakeSvg.body.code, "UPLOAD_INVALID_FILE_CONTENT")

    const fakeWebp = await postCategory({ name: "C" }, icon(png(), "f.webp", "image/webp"))
    assert.equal(fakeWebp.status, 415)

    assert.deepEqual(uploads.created("category"), [])
  })

  it("two files, or a file under the wrong field name, are refused (400) and nothing is saved", async () => {
    const two = await app.request("POST", "/api/categories", { form: (() => { const f = buildForm({ name: "A" }); f.append("icon", file(webp(), "1.webp", "image/webp")); f.append("icon", file(webp(), "2.webp", "image/webp")); return f })() })
    const wrong = await postCategory({ name: "B" }, { picture: file(webp(), "w.webp", "image/webp") })

    assert.equal(two.status, 400)
    assert.equal(wrong.status, 400)
    assert.deepEqual(uploads.created("category"), [])
  })

  it("if the request fails AFTER the upload, the picture is deleted: missing data and duplicate name", async () => {
    const missing = await postCategory({ description: "no name" }, icon())
    assert.equal(missing.status, 400)
    assert.deepEqual(uploads.created("category"), [])

    const first = await postCategory({ name: "Coffee" }, icon())
    const duplicate = await postCategory({ name: "Coffee" }, icon())

    assert.equal(duplicate.status, 409)
    assert.equal(uploads.created("category").length, 1, "only the first icon may remain")
    assert.ok(onDisk(first.body.icon))
  })

  it("replacing the icon deletes the old file; removeIcon deletes it and sets null", async () => {
    const { body: created } = await postCategory({ name: "Coffee" }, icon())

    const replaced = await patchCategory(created.id, {}, icon(svg(), "n.svg", "image/svg+xml"))
    assert.equal(replaced.status, 200)
    assert.equal(onDisk(created.icon), false)
    assert.ok(onDisk(replaced.body.icon))

    const removed = await patchCategory(created.id, { removeIcon: "true" })
    assert.equal(removed.body.icon, null)
    assert.equal(onDisk(replaced.body.icon), false)
    assert.deepEqual(uploads.created("category"), [])
  })

  it("a failed update keeps the old icon and deletes the new picture", async () => {
    await postCategory({ name: "Tea" })
    const { body: coffee } = await postCategory({ name: "Coffee" }, icon())

    const failed = await patchCategory(coffee.id, { name: "Tea" }, icon(svg(), "n.svg", "image/svg+xml"))

    assert.equal(failed.status, 409)
    assert.ok(onDisk(coffee.icon), "the old icon must still exist")
    assert.equal(uploads.created("category").length, 1)
  })
})

describe("item image", () => {
  let categoryId
  beforeEach(async () => { categoryId = (await app.request("POST", "/api/categories", { json: { name: "Coffee" } })).body.id })

  const postItem = (fields, files) => app.request("POST", "/api/items", { form: buildForm({ price: "4", category: categoryId, ...fields }, files) })

  it("an item image is saved in the item folder; the image is optional", async () => {
    const withImage = await postItem({ name: "Latte" }, image())
    const without = await postItem({ name: "Mocha" })

    assert.match(withImage.body.image, /^\/images\/item\/[0-9a-f-]{36}\.webp$/)
    assert.ok(onDisk(withImage.body.image))
    assert.equal(without.body.image, null)
  })

  it("size limit is 200 KB: exactly 200 KB is accepted, one byte more is 413", async () => {
    assert.equal((await postItem({ name: "A" }, image(webp(200 * KB)))).status, 201)
    uploads.cleanup()

    const { status, body } = await postItem({ name: "B" }, image(webp(200 * KB + 1)))
    assert.equal(status, 413)
    assert.equal(body.message, "The size of this picture is too big")
    assert.deepEqual(uploads.created("item"), [])
  })

  it("wrong type and fake content are refused; a failure after the upload deletes the picture", async () => {
    assert.equal((await postItem({ name: "A" }, image(png(), "p.png", "image/png"))).status, 415)
    assert.equal((await postItem({ name: "B" }, image(html(), "f.svg", "image/svg+xml"))).status, 415)

    const noPrice = await app.request("POST", "/api/items", { form: buildForm({ name: "C", category: categoryId }, image()) })
    assert.equal(noPrice.status, 400)

    const noCategory = await postItem({ name: "D", category: "64b7f0a2c3d4e5f607189999" }, image())
    assert.equal(noCategory.body.code, "ITEM_CATEGORY_NOT_FOUND")

    assert.deepEqual(uploads.created("item"), [])
  })

  it("replace, remove and delete all clean up the files", async () => {
    const { body: created } = await postItem({ name: "Latte" }, image())

    const replaced = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({}, image(svg(), "n.svg", "image/svg+xml")) })
    assert.equal(onDisk(created.image), false)
    assert.ok(onDisk(replaced.body.image))

    const removed = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({ removeImage: "true" }) })
    assert.equal(removed.body.image, null)
    assert.equal(onDisk(replaced.body.image), false)

    const again = await app.request("PATCH", `/api/items/${created.id}`, { form: buildForm({}, image()) })
    assert.equal((await app.request("DELETE", `/api/items/${created.id}`)).status, 204)
    assert.equal(onDisk(again.body.image), false)
    assert.deepEqual(uploads.created("item"), [])
  })
})

describe("deleting a category cleans up every picture that belonged to it", () => {
  it("removes the category icon, its items AND the items' image files", async () => {
    const { body: coffee } = await postCategory({ name: "Coffee" }, icon())
    const { body: tea } = await postCategory({ name: "Tea" }, icon())
    const item = (name, category, files) => app.request("POST", "/api/items", { form: buildForm({ name, price: "1", category }, files) })

    const latte = (await item("Latte", coffee.id, image())).body
    const green = (await item("Green tea", tea.id, image())).body

    assert.equal((await app.request("DELETE", `/api/categories/${coffee.id}`)).status, 204)

    assert.equal(onDisk(coffee.icon), false, "category icon")
    assert.equal(onDisk(latte.image), false, "image of its item")
    assert.ok(onDisk(tea.icon), "other category's icon stays")
    assert.ok(onDisk(green.image), "other category's item image stays")
    assert.equal(listUploads("item").includes(pathOfUrl(green.image).split(/[\\/]/).pop()), true)
  })
})
