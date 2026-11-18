import dotenv from "dotenv"

dotenv.config()

export default {
    port: process.env.PORT,
    db_uri: process.env.DB_URI,
    node_env: process.env.NODE_ENV,
    cors: process.env.CORES_ORIGINS,
    trust_proxy: process.env.TRUST_PROXY,
    rate_limit_window: process.env.RATE_LIMIT_WINDOW_MS,
    rate_limit_public: process.env.RATE_LIMIT_PUBLIC_MAX,
    rate_limit_admin: process.env.RATE_LIMIT_ADMIN_MAX
}