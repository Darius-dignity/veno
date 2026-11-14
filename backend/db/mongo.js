import mongoose from "mongoose"
import colors from "colors"

async function connectToMongoDB(uri) {
    const isAtlas = uri.includes("mongodb+srv")
    try {
        const conn = await mongoose.connect(uri);
        isAtlas 
        ? console.log(`Successfully Connected to Atlas Mongo Cloud ${(conn.connection.host)}`.blue)
        : console.log(`Successfully Connected to Local MongoDB ${(conn.connection.host)}`.blue);
    } catch (error) {
        console.error(`Failed Connecting to Database! : ${error.message}`.red);
        process.exit(1);
    }
}

export default connectToMongoDB