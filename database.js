// database.js (UPDATED with 'links' collection functions)

require('dotenv').config(); 
const { MongoClient } = require('mongodb');

// Get variables from .env file
const uri = process.env.MONGO_URI; 
const dbName = "musiccuratorDB"; 

if (!uri) {
    throw new Error("MONGO_URI environment variable not set. Check your .env file.");
}

const client = new MongoClient(uri);
let db; 

// --- CONNECTION FUNCTION ---
async function connectDB() {
    try {
        console.log("Connecting to MongoDB Atlas...");
        await client.connect();
        db = client.db(dbName); 
        console.log(`Successfully connected to MongoDB database: ${dbName}!`);

    } catch (error) {
        console.error("Database connection failed:", error.message);
        process.exit(1); 
    }
}

// --- CORE OPERATIONS ('articles' collection) ---

// Function to save an array of news articles to the 'articles' collection
async function insertArticles(articles) {
    if (!db) {
        throw new Error("Database not connected.");
    }
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

// Function to fetch all stored articles for the frontend display
async function getAllArticles() {
    if (!db) {
        throw new Error("Database not connected.");
    }
    const collection = db.collection('articles');
    return await collection.find({}).sort({ pubDate: -1 }).toArray();
}

// --- NEW: OPERATIONS for 'links' collection ---

/**
 * Adds a new link to the 'links' collection.
 * Uses upsert to prevent duplicate links.
 */
async function addLink(title, link) {
    if (!db) {
        throw new Error("Database not connected.");
    }
    const collection = db.collection('links');
    try {
        const result = await collection.updateOne(
            { link: link }, // Filter by link to prevent duplicates
            { $set: { title: title, link: link, createdAt: new Date() } }, // Set the data
            { upsert: true } // Add if it doesn't exist
        );
        if (result.upsertedCount > 0) {
            console.log(`[DB] Added new link: ${title}`);
        } else {
            console.log(`[DB] Updated existing link: ${title}`);
        }
    } catch (error) {
        console.error("[DB ERROR] Failed to add link:", error.message);
        throw error; // Re-throw error to be caught by server.js
    }
}

/**
 * Gets all links from the 'links' collection, sorted newest first.
 */
async function getAllLinks() {
    if (!db) {
        throw new Error("Database not connected.");
    }
    const collection = db.collection('links');
    return await collection.find({}).sort({ createdAt: -1 }).toArray();
}


// --- EXPORTS ---
module.exports = {
    connectDB,
    insertArticles,
    getAllArticles,
    addLink,       // <-- NEW EXPORT
    getAllLinks    // <-- NEW EXPORT
};