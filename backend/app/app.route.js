import app from "./app.preware.js"
import createCategoryModule from "../modules/category/module.js"
import createItemModule from "../modules/item/module.js"

const categoryModule = createCategoryModule()
const itemModule = createItemModule({
  categoryService: categoryModule.categoryService,
})

app.use("/api/categories", categoryModule.categoryRouter)
app.use("/api/items", itemModule.itemRouter)

export default app