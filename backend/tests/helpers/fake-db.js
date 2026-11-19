// A tiny in-memory MongoDB that sits BEHIND the real Mongoose models.
// Real Mongoose, real models, real hooks (cascade delete) run on top of it;
// only the database server is replaced. The tests never touch your real MongoDB.
import mongoose from "mongoose"
import Category from "../../modules/category/model.js"
import Item from "../../modules/item/model.js"

// A query the fake DB does not know fails fast instead of waiting 10 seconds
mongoose.set("bufferTimeoutMS", 500)

const same = (a, b) => String(a) === String(b)

const matchValue = (docValue, filterValue) => {
  if (filterValue && typeof filterValue === "object" && "$ne" in filterValue) {
    return filterValue.$ne === null
      ? docValue != null
      : !same(docValue, filterValue.$ne)
  }

  return same(docValue, filterValue)
}

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, value]) => matchValue(doc[key], value))

const project = (doc, projection) => {
  if (!projection || Object.keys(projection).length === 0) return { ...doc }

  const result = {}
  if (projection._id !== 0) result._id = doc._id

  for (const key of Object.keys(projection)) {
    if (projection[key] && key in doc) result[key] = doc[key]
  }

  return result
}

const sorter = (sort) => {
  const entries = sort instanceof Map ? [...sort] : Object.entries(sort || {})

  return (a, b) => {
    for (const [key, direction] of entries) {
      const x = String(a[key])
      const y = String(b[key])
      if (x !== y) return (x < y ? -1 : 1) * direction
    }

    return 0
  }
}

// uniqueKeys: the fields of the unique index, e.g. ["name"] or ["category", "name"]
const install = (Model, rows, uniqueKeys) => {
  const assertUnique = (doc, self) => {
    const clash = rows.find(
      (row) => row !== self && uniqueKeys.every((key) => same(row[key], doc[key]))
    )

    if (clash) {
      const error = new Error("E11000 duplicate key error")
      error.code = 11000
      error.keyValue = Object.fromEntries(uniqueKeys.map((key) => [key, doc[key]]))
      throw error
    }
  }

  Object.assign(Model.collection, {
    insertOne: async (doc) => {
      assertUnique(doc, null)
      rows.push({ ...doc })
      return { acknowledged: true, insertedId: doc._id }
    },

    findOne: async (filter, options = {}) => {
      const doc = rows.find((row) => matches(row, filter))
      return doc ? project(doc, options.projection) : null
    },

    find: (filter, options = {}) => ({
      toArray: async () =>
        rows
          .filter((row) => matches(row, filter))
          .sort(sorter(options.sort))
          .map((row) => project(row, options.projection)),
    }),

    findOneAndUpdate: async (filter, update, options = {}) => {
      const doc = rows.find((row) => matches(row, filter))
      if (!doc) return null

      const before = { ...doc }
      const next = { ...doc, ...(update.$set || {}) }
      assertUnique(next, doc)
      Object.assign(doc, next)

      const returnNew = options.returnDocument === "after" || options.new
      return project(returnNew ? doc : before, options.projection)
    },

    findOneAndDelete: async (filter, options = {}) => {
      const index = rows.findIndex((row) => matches(row, filter))
      return index === -1 ? null : project(rows.splice(index, 1)[0], options.projection)
    },

    deleteMany: async (filter) => {
      let deletedCount = 0

      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], filter)) {
          rows.splice(i, 1)
          deletedCount++
        }
      }

      return { deletedCount }
    },
  })
}

const categories = []
const items = []

install(Category, categories, ["name"])
install(Item, items, ["category", "name"])

export const fakeDb = {
  categories,
  items,
  reset() {
    categories.length = 0
    items.length = 0
  },
}
