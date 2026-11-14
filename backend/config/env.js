import dotenv from "dotenv"

dotenv.config()

export default {
    port: process.env.PORT,
    db_uri: process.env.DB_URI
}