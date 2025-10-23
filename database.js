// database.js (ESM Version)
import { config } from 'dotenv';
import { MongoClient } from 'mongodb';
config();

const uri = process.env.MONGO_URI;
const dbName = "musiccuratorDB";

if (!uri) { throw new Error("MONGO_URI not set."); }

const client = new MongoClient(uri);
let db;

export async function connectDB() {
    try {
        console.log("Connecting to MongoDB Atlas...");
        await client.connect();
        db = client.db(dbName);
        console.log(`Successfully connected to MongoDB: ${dbName}!`);
    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1);
    }
}

export async function insertArticles(articles) {
    if (!db) { throw new Error("Database not connected."); }
    const collection = db.collection('articles');
    const operations = articles.map(article => ({
        updateOne: {
            filter: { link: article.link },
            update: { $set: { ...article, fetchedAt: new Date() } },
            upsert: true
        }
    }));
    if (operations.length > 0) {
        try {
            const result = await collection.bulkWrite(operations);
            console.log(`[DB] Inserted/Updated: ${result.upsertedCount + result.modifiedCount} articles.`);
        } catch (error) {
            console.error("[DB ERROR] Failed to perform bulk write:", error.message);
        }
    }
}

export async function getAllArticles() {
    if (!db) { throw new Error("Database not connected."); }
    const collection = db.collection('articles');
    return await collection.find({}).sort({ pubDate: -1 }).toArray();
}
