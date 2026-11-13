import app from "./app.preware.js"
import createCategoryModule from "../modules/category/module.js"

// Temporary stub until the item module exists
const itemRepository = { existsByCategoryId: async () => false }

const categoryModule = createCategoryModule({ itemRepository })

app.use("/api/categories", categoryModule.categoryRouter)

export default app