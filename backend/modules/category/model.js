import mongoose from "mongoose"
import Item from "../item/model.js"

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // File name only (e.g. "3f2c...c9.svg"); the folder is known to the app
    icon: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false
  }
)

// Covers the public menu query: filter isActive, sort name, return name + icon + _id
categorySchema.index({ isActive: 1, name: 1, icon: 1, _id: 1 })

// Cascade delete: removing a category also removes every item that points to it.
// Items are deleted first, so a failure leaves the category in place and the
// delete can simply be retried (the reverse order could leave orphaned items).
// This runs for findByIdAndDelete / findOneAndDelete, which the repository uses.
categorySchema.pre("findOneAndDelete", async function () {
  const category = await this.model
    .findOne(this.getFilter())
    .select({ _id: 1 })
    .lean()

  if (category) {
    await Item.deleteMany({ category: category._id })
  }
})

// Same rule when a loaded document is deleted with doc.deleteOne()
categorySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function () {
    await Item.deleteMany({ category: this._id })
  }
)

const Category = mongoose.model("Category", categorySchema)

export default Category