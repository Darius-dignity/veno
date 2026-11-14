import colors from "colors"
import app from "./app/app.afterware.js"
import connectToMongoDB from "./db/mongo.js"
import env from "./config/env.js"

await connectToMongoDB(env.db_uri)

app.listen(env.port, () => console.log(`App is Running on Port ${env.port}`.blue))