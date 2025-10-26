// server.js (FIXED: 5t00 -> 500)

// 1. Import modules
const express = require('express');
const path = require('path'); // <-- ADDED THIS LINE
const { startNewsFetch } = require('./aggregator.js'); 
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');
const cluster = require('cluster');
const os =require('os');
const numCPUs = os.cpus().length;

// 2. Initialize the app and set the port
const app = express();
const PORT = process.env.PORT || 3000;


// --- MIDDLEWARE SETUP ---
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend files

// --- API ROUTES (Endpoints) ---

// Root route (*** UPDATED TO SEND YOUR FILE ***)
app.get('/', (req, res) => {
    // This now sends your index.js file as the main page
    // (This assumes your HTML/JS is in a file named 'index.js' in the 'public' folder)
    res.sendFile(path.join(__dirname, 'public', 'index.js'));
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

// Endpoint 2: Search for Images
app.post('/api/search-images', async (req, res) => {
    const { title, source } = req.body;
    if (!title || !source) {
        return res.status(400).json({ error: 'Missing title or source for search.' });
    }
    try {
        const images = await curator.searchForRelevantImages(title, source);
        res.json({ images });
    } catch (error) {
        console.error("Error during image search:", error);
        res.status(500).json({ error: 'Image search failed.' });
    }
});

// Endpoint 3: Find Related Articles
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
        // --- THIS IS THE FIX ---
        res.status(500).json({ error: 'Related article search failed.' }); 
    }
});


// Simple Preview Image Generation
app.post('/api/generate-simple-preview', async (req, res) => {
    console.log("--> Received request for /api/generate-simple-preview");
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


// --- SERVER START FUNCTION ---
async function startApp() {
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

// --- INITIATE SERVER START ---

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers for each CPU.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Log when a worker dies
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
  
} else {
  // This is a worker process.
  startApp();
}
