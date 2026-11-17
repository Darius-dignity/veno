import colors from "colors"

async function logger(req, res, next) {

    const colorMap = {
        GET: "green",
        POST: "yellow",
        PATCH: "cyan",
        DELETE: "magenta"
    }

    const color = colorMap[req.method.toString()]

    console.log(`${req.method} => ${req.protocol}://${req.get("host")}${req.originalUrl}`.bold[color])
    next()
}

export default logger