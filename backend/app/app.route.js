import app from "./app.preware.js"
import createCategoryModule from "../modules/category/module.js"

const categoryModule = createCategoryModule()

app.use("/api/categories", categoryModule.categoryRouter)

export default app