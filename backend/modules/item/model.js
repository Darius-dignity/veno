import mongoose from "mongoose"

const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    // Foreign key: every item belongs to exactly one category
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

// Same item name is allowed in different categories, but not twice in one category.
// Its first key is "category", so it also serves Item.find({ category }) queries
// and the cascade delete when a category is removed (no extra index needed).
itemSchema.index({ category: 1, name: 1 }, { unique: true })

const Item = mongoose.model("Item", itemSchema)

export default Item