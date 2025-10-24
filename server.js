// server.js (UPDATED to pass 'source' to search functions)

// 1. Import modules (unchanged)
const express = require('express');
const { startNewsFetch } = require('./aggregator.js'); 
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');
const cluster = require('cluster');
const os = require('os');
const numCPUs = os.cpus().length;

// 2. Initialize the app and set the port (unchanged)
const app = express();
const PORT = process.env.PORT || 3000;


// --- MIDDLEWARE SETUP (unchanged) ---
app.use(bodyParser.json());
app.use(express.static('public'));

// --- API ROUTES (Endpoints) ---

// Root route (unchanged)
app.get('/', (req, res) => {
    res.send('Phase Loop Records API is running!');
});

// Fetch all stored news articles (unchanged)
app.get('/api/news', async (req, res) => {
    // ... (unchanged)
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

// --- REFACTORED ENDPOINTS ---

// Endpoint 1: Generate AI Text (Unchanged)
// This only needs the 'article' object
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

// Endpoint 2: Search for Images (*** UPDATED ***)
// Now accepts 'title' and 'source'
app.post('/api/search-images', async (req, res) => {
    const { title, source } = req.body; // <-- Updated
    if (!title || !source) {
        return res.status(400).json({ error: 'Missing title or source for search.' });
    }
    try {
        const images = await curator.searchForRelevantImages(title, source); // <-- Updated
        res.json({ images });
    } catch (error) {
        console.error("Error during image search:", error);
        res.status(500).json({ error: 'Image search failed.' });
    }
});

// Endpoint 3: Find Related Articles (*** UPDATED ***)
// Now accepts 'title' and 'source'
app.post('/api/find-related-articles', async (req, res) => {
    const { title, source } = req.body; // <-- Updated
    if (!title) {
        return res.status(400).json({ error: 'Missing title or source for related search.' });
    }
    try {
        const relatedArticles = await curator.findRelatedWebArticles(title, source); // <-- Updated
        res.json({ relatedArticles });
    } catch (error) {
        console.error("Error during related article search:", error);
        res.status(500).json({ error: 'Related article search failed.' });
    }
});

// Simple Preview Image Generation (unchanged)
app.post('/api/generate-simple-preview', async (req, res) => {
    // ... (this endpoint is unchanged)
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

// Social Media Sharing (MOCK-UP) (unchanged)
app.post('/api/share', async (req, res) => {
    // ... (this endpoint is unchanged)
    const { imagePath, caption, platform } = req.body;
    // ... (rest of the function)
    res.json({ success: true, message: `Successfully simulated sharing to ${platform}!` });
});


// --- SERVER START FUNCTION (unchanged) ---
async function startApp() {
    // ... (this function is unchanged)
    try {
        await db.connectDB();
        app.listen(PORT,'0.0.0.0', () => {
            console.log(`Server running at http://localhost:${PORT}`);
            aggregator.startScheduler();
        });
    } catch (dbError) {
        console.error("Failed to start server due to DB connection error:", dbError);
        process.exit(1);
    }
}

// --- INITIATE SERVER START (unchanged) ---
if (cluster.isPrimary) {
  // ... (this logic is unchanged)
  console.log(`Primary ${process.pid} is running`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  startApp();
}