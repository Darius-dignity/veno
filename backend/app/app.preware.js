import express from "express"
import logger from "../middlewares/logger.js"

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(logger)

export default app