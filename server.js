// server.js (UPDATED AND FIXED)

// 1. Import modules
const express = require('express');
const path = require('path');
const { startNewsFetch } = require('./aggregator.js');
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');
// const cluster = require('cluster'); // <-- REMOVED
// const os = require('os'); // <-- REMOVED

// 2. Initialize the app and set the port
const app = express();
const PORT = process.env.PORT || 3000;

// --- MIDDLEWARE SETUP ---
app.use(bodyParser.json());
app.use(express.static('public')); // This should serve index.html

// --- API ROUTES (Endpoints) ---

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

// Simple Preview Image Generation
app.post('/api/generate-simple-preview', async (req, res) => {
    console.log("--- /api/generate-simple-preview: Endpoint START ---");
    const { imageUrl, overlayText } = req.body;
    console.log(`[/api/generate-simple-preview] INPUT imageUrl: ${imageUrl}`);
    console.log(`[/api/generate-simple-preview] INPUT overlayText: ${overlayText}`);

    if (!imageUrl || !overlayText) {
        console.log("[/api/generate-simple-preview] Validation Failed: Missing imageUrl or overlayText.");
        return res.status(400).json({ error: 'Missing data for preview (imageUrl or overlayText).', previewImagePath: '/fallback.png' });
    }

    try {
        console.log("[/api/generate-simple-preview] Calling curator.generateSimplePreviewImage...");
        const previewImagePath = await curator.generateSimplePreviewImage(imageUrl, overlayText);
        console.log(`[/api/generate-simple-preview] curator function returned: ${previewImagePath}`);

        if (previewImagePath === '/fallback.png') {
            console.log("[/api/generate-simple-preview] Curator returned fallback path. Sending error indicator response.");
             res.status(200).json({ previewImagePath: '/fallback.png', error: 'Preview generation failed on server.' });
        } else if (previewImagePath && typeof previewImagePath === 'string' && previewImagePath.startsWith('/preview_')) {
             console.log("[/api/generate-simple-preview] Curator returned valid path. Sending success response.");
             res.status(200).json({ previewImagePath: previewImagePath });
        } else {
             console.error("[/api/generate-simple-preview] Curator returned unexpected value:", previewImagePath);
             throw new Error('Unexpected return value from image generator.');
        }
        console.log("--- /api/generate-simple-preview: Endpoint END (Success Path) ---");

    } catch (error) {
        console.error("--- /api/generate-simple-preview: CATCH BLOCK ERROR ---");
        console.error("[/api/generate-simple-preview ERROR RAW]", error);
        console.error(`[/api/generate-simple-preview ERROR Message]: ${error.message}`);
        console.log("--- /api/generate-simple-preview: Endpoint END (Error Path) ---");
        res.status(500).json({ error: 'Internal server error during preview generation.', previewImagePath: '/fallback.png' });
    }
});

// Social Media Sharing (MOCK-UP)
app.post('/api/share', async (req, res) => {
    console.log("--> Received request for /api/share");
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


// --- SERVER START FUNCTION (REFACTORED) ---
async function startApp() {
    // 1. Start listening for HTTP requests *immediately*
    // This responds to Railway's health checks.
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running at http://localhost:${PORT} and listening for connections.`);
        
        // 2. Now, connect to the database and start the scheduler in the background.
        // This is wrapped in an IIFE (Immediately Invoked Function Expression)
        (async () => {
            try {
                await db.connectDB();
                aggregator.startScheduler();
            } catch (dbError) {
                console.error("!!! CRITICAL: Server is LIVE but DB connection FAILED:", dbError);
                // The server is running, but API calls will fail.
                // This is better than the whole app failing to start.
            }
        })();
    });
}

// --- INITIATE SERVER START ---
startApp(); // Just call the function directly. No more cluster logic.
