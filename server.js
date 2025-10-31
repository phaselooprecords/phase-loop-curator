// server.js (UPDATED with correct /admin file path)

// 1. Import modules
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const basicAuth = require('express-basic-auth'); // For password
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');

// 2. Initialize the app and set the port
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE SETUP ---
app.use(bodyParser.json());
// This serves homepage.html, fallback-thumbnail.png etc.
app.use(express.static('public')); 

// --- Basic Authentication Middleware ---
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASSWORD;

if (!adminPass) {
    console.error("CRITICAL: ADMIN_PASSWORD environment variable is not set. Admin panel will not be accessible.");
}

const adminAuth = basicAuth({
    users: { [adminUser]: adminPass },
    challenge: true,
    unauthorizedResponse: 'Access Denied. Please check your credentials.'
});

// --- API ROUTES (Endpoints) ---
// (All your API routes like /api/news, /api/generate-text, etc. remain unchanged)
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

// Endpoint 1: Generate AI Text
app.post('/api/generate-text', async (req, res) => {
    const article = req.body;
    if (!article || !article.title) {
        return res.status(400).json({ error: 'Missing article data.' });
    }
    try {
        const curatedText = await curator.generateAiText(article);
        res.json(curatedText);
    } catch (error) {
        console.error("Error during text generation:", error);
        res.status(500).json({ error: 'Text generation failed.' });
    }
});

// Endpoint 2: Extract Keywords
app.post('/api/extract-keywords', async (req, res) => {
    const { headline, description } = req.body;
    if (!headline || !description) {
        return res.status(400).json({ error: 'Missing headline or description for keyword extraction.' });
    }
    try {
        const keywords = await curator.extractSearchKeywords(headline, description);
        res.json({ keywords });
    } catch (error) {
        console.error("Error during keyword extraction:", error);
        res.status(500).json({ error: 'Keyword extraction failed.' });
    }
});

// Endpoint 3: Get Alternative Keywords
app.post('/api/get-alternative-keywords', async (req, res) => {
    const { headline, description, previousKeywords } = req.body;
    if (!headline || !description) {
        return res.status(400).json({ error: 'Missing headline or description for alternative keyword extraction.' });
    }
    const prevKeywordsArray = Array.isArray(previousKeywords) ? previousKeywords : [];

    try {
        const keywords = await curator.getAlternativeKeywords(headline, description, prevKeywordsArray);
        res.json({ keywords });
    } catch (error) {
        console.error("Error during alternative keyword extraction:", error);
        res.status(500).json({ error: 'Alternative keyword extraction failed.' });
    }
});

// Endpoint 4: Search for Images
app.post('/api/search-images', async (req, res) => {
    const { query, startIndex } = req.body;
    if (!query) {
        return res.status(400).json({ error: 'Missing query for image search.' });
    }
    const index = parseInt(startIndex, 10) || 0;

    try {
        const imagesData = await curator.searchForRelevantImages(query, index);
        res.json({ images: imagesData });
    } catch (error) {
        console.error("Error during image search:", error);
        res.status(500).json({ error: 'Image search failed.' });
    }
});

// Endpoint 5: Find Related Articles
app.post('/api/find-related-articles', async (req, res) => {
    const { title, source } = req.body;
    if (!title || !source) {
        return res.status(400).json({ error: 'Missing title or source for related search.' });
    }
    try {
        const relatedArticles = await curator.findRelatedWebArticles(title, source);
        res.json({ relatedArticles });
    } catch (error) {
        console.error("Error during related article search:", error);
        res.status(500).json({ error: 'Related article search failed.' });
    }
});

// Endpoint 6: Find Video
app.post('/api/find-video', async (req, res) => {
    const { title, source } = req.body;
    if (!title || !source) {
        return res.status(400).json({ error: 'Missing title or source for video search.' });
    }
    try {
        const videoUrl = await curator.findRelatedVideo(title, source);
        res.json({ videoUrl });
    } catch (error) {
        console.error("Error during video search:", error);
        res.status(500).json({ error: 'Video search failed.' });
    }
});

// Image Streaming Endpoint
app.post('/api/generate-simple-preview', async (req, res) => {
    console.log("--- /api/generate-simple-preview: Endpoint START ---");
    const { imageUrl, overlayText } = req.body;

    if (!imageUrl || !overlayText) {
        console.log("[/api/generate-simple-preview] Validation Failed: Missing data.");
        return res.status(400).json({ error: 'Missing data for preview.' });
    }
    try {
        const imageBuffer = await curator.generateSimplePreviewImage(imageUrl, overlayText); 
        
        if (imageBuffer) {
            console.log("[/api/generate-simple-preview] Success, streaming image buffer.");
            res.set('Content-Type', 'image/png');
            res.send(imageBuffer);
        } else {
            console.log("[/api/generate-simple-preview] Curator returned null buffer.");
            res.status(500).json({ error: 'Preview generation failed on server.' });
        }
    } catch (error) {
        console.error("--- /api/generate-simple-preview: CATCH BLOCK ERROR ---", error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Social Media Sharing (MOCK-UP)
app.post('/api/share', async (req, res) => {
    console.log("--> Received request for /api/share");
    res.json({ success: true, message: `Successfully simulated sharing!` });
});

// API Endpoints for Public Link Page
app.post('/api/links/add', adminAuth, async (req, res) => {
    console.log("--> Received request for /api/links/add");
    const { title, link } = req.body;
    if (!title || !link) {
        return res.status(400).json({ success: false, error: 'Missing title or link.' });
    }
    try {
        await db.addLink(title, link);
        res.json({ success: true, message: 'Link added!' });
    } catch (error) {
        console.error("!!! ERROR in /api/links/add:", error);
        res.status(500).json({ success: false, error: 'Failed to add link.' });
    }
});

app.get('/api/links/get', async (req, res) => {
    console.log("--> Received request for /api/links/get");
    try {
        const links = await db.getAllLinks();
        res.json(links);
    } catch (error) {
        console.error("!!! ERROR in /api/links/get:", error);
        res.status(500).json({ error: 'Failed to retrieve links.' });
    }
});


// --- PAGE ROUTING (UPDATED) ---

// Public root: Serves the new public homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'homepage.html'));
});

// *** THIS IS THE FIX ***
// Admin panel: Serves index.html from the 'admin' folder, protected by password
app.get('/admin', adminAuth, (req, res) => {
    if (!adminPass) {
        return res.status(500).send("Server is not configured with an ADMIN_PASSWORD. Access denied.");
    }
    // This path now correctly points to 'admin/index.html'
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});


// --- SERVER START FUNCTION (REFACTORED) ---
async function startApp() {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT} and listening for connections.`);
        (async () => {
            try {
                await db.connectDB();
                aggregator.startScheduler();
            } catch (dbError) {
                console.error("!!! CRITICAL: Server is LIVE but DB connection FAILED:", dbError);
            }
        })();
    });
}

// --- INITIATE SERVER START ---
startApp();