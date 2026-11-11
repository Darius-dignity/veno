import colors from "colors"
import app from "./app/app.js"
import env from "./config/env.js"

app.listen(env.port, () => console.log(`App is Running on Port ${env.port}`.blue))