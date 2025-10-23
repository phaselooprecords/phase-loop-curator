// server.js (Verified Final Version)

// 1. Import modules
const express = require('express');
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');

// 2. Initialize the app and set the port
const app = express();
const PORT = 3000;

// --- MIDDLEWARE SETUP ---
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend files

// --- API ROUTES (Endpoints) ---
// All routes must be defined BEFORE app.listen is called inside startApp

// Root route (serves frontend or a simple message)
app.get('/', (req, res) => {
    res.send('Phase Loop Records API is running!');
});

// Fetch all stored news articles
app.get('/api/news', async (req, res) => {
    console.log("--> Received request for /api/news");
    try {
        const articles = await db.getAllArticles();
        console.log(`--> Found ${articles.length} articles in DB.`);
        res.json(articles);
    } catch (error) {
        console.error("!!! ERROR in /api/news:", error);
        res.status(500).json({ error: 'Failed to retrieve articles.' });
    }
});

// Content Curation Endpoint (AI Text + Image Search)
app.post('/api/curate', async (req, res) => {
    const article = req.body;
    if (!article || !article.title) {
        return res.status(400).json({ error: 'Missing article data.' });
    }
    try {
        const curatedContent = await curator.curateArticle(article);
        res.json(curatedContent);
    } catch (error) {
        console.error("Error during content curation:", error);
        res.status(500).json({ error: 'Content curation failed.' });
    }
});

// Simple Preview Image Generation
app.post('/api/generate-simple-preview', async (req, res) => {
    console.log("--> Received request for /api/generate-simple-preview"); // Added log
    const { imageUrl, headline, description } = req.body;
    if (!imageUrl || !headline || !description) {
        return res.status(400).json({ error: 'Missing data for preview.' });
    }
    try {
        const previewImagePath = await curator.generateSimplePreviewImage(imageUrl, headline, description);
        res.json({ previewImagePath });
    } catch (error) {
        console.error("!!! ERROR generating simple preview:", error);
        res.status(500).json({ error: 'Failed to generate simple preview.' });
    }
});


// Social Media Sharing (MOCK-UP)
app.post('/api/share', async (req, res) => {
    console.log("--> Received request for /api/share"); // Added log
    const { imagePath, caption, platform } = req.body;
    console.log(`\n*** MOCK SHARE REQUEST ***`);
    console.log(`Platform: ${platform}`);
    console.log(`Image Path: ${imagePath}`);
    console.log(`Caption: ${(caption || '').substring(0, 80)}...`);
    console.log(`**************************\n`);

    if (platform === 'Instagram Story') {
        return res.status(403).json({ error: 'Instagram Story posting via API is restricted.' });
    }
    res.json({ success: true, message: `Successfully simulated sharing to ${platform}!` });
});


// --- SERVER START FUNCTION ---
async function startApp() {
    try {
        await db.connectDB();
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
            aggregator.startScheduler();
        });
    } catch (dbError) {
        console.error("Failed to start server due to DB connection error:", dbError);
        process.exit(1);
    }
}

// --- INITIATE SERVER START ---
startApp();

