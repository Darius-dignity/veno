import app from "./app.preware.js"
import createCategoryModule from "../modules/category/module.js"
import createItemModule from "../modules/item/module.js"
import Item from "../modules/item/model.js"
import ItemRepository from "../modules/item/repository.js"

// One shared instance: the category module needs it (delete item images when a
// category is deleted) and the item module needs the category service.
// Creating it here avoids a circular dependency.
const itemRepository = new ItemRepository(Item)

const categoryModule = createCategoryModule({ itemRepository })
const itemModule = createItemModule({
  categoryService: categoryModule.categoryService,
  itemRepository,
})

app.use("/api/categories", categoryModule.categoryRouter)
app.use("/api/items", itemModule.itemRouter)

export default app