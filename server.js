// server.js (Ensuring app = express() is present)

// 1. Import modules
const express = require('express');
const path = require('path');
const { startNewsFetch } = require('./aggregator.js');
const bodyParser = require('body-parser');
const aggregator = require('./aggregator');
const db = require('./database');
const curator = require('./curator');
const cluster = require('cluster');
const os =require('os');
const numCPUs = os.cpus().length;

// 2. Initialize the app and set the port
const app = express(); // <<<--- THIS LINE MUST BE PRESENT AND UNCOMMENTED
const PORT = process.env.PORT || 3000;


// --- MIDDLEWARE SETUP ---
app.use(bodyParser.json());
app.use(express.static('public')); // This should serve index.html

// --- API ROUTES (Endpoints) ---

// Root route (No longer needed if express.static serves index.html)
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'public', 'index.html'));
// });

// Fetch all stored news articles
app.get('/api/news', async (req, res) => { // <<<--- Error was happening here
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


// Simple Preview Image Generation (with detailed logging and error handling)
app.post('/api/generate-simple-preview', async (req, res) => {
    // --- Log Entry and Inputs ---
    console.log("--- /api/generate-simple-preview: Endpoint START ---");
    // Updated to expect socialCaption based on latest curator.js change
    const { imageUrl, socialCaption } = req.body;
    console.log(`[/api/generate-simple-preview] INPUT imageUrl: ${imageUrl}`);
    // Log start of caption, handle potential undefined/null
    console.log(`[/api/generate-simple-preview] INPUT socialCaption: ${socialCaption ? socialCaption.substring(0, 80) + '...' : 'N/A'}`);
    // --- End Log ---

    // Updated validation to check for socialCaption
    if (!imageUrl || !socialCaption) {
        console.log("[/api/generate-simple-preview] Validation Failed: Missing imageUrl or socialCaption."); // Log validation fail
        // Send a specific error response including the fallback path
        return res.status(400).json({ error: 'Missing data for preview (imageUrl or socialCaption).', previewImagePath: '/fallback.png' });
    }

    try {
        console.log("[/api/generate-simple-preview] Calling curator.generateSimplePreviewImage..."); // Log before call
        // Pass socialCaption to the curator function
        const previewImagePath = await curator.generateSimplePreviewImage(imageUrl, socialCaption);
        console.log(`[/api/generate-simple-preview] curator function returned: ${previewImagePath}`); // Log return value

        // --- Explicitly handle fallback path ---
        if (previewImagePath === '/fallback.png') {
            console.log("[/api/generate-simple-preview] Curator returned fallback path. Sending error indicator response.");
            // Send back the fallback path with a 200 status, frontend interprets this as an error
             res.status(200).json({ previewImagePath: '/fallback.png', error: 'Preview generation failed on server.' });
        } else if (previewImagePath && typeof previewImagePath === 'string' && previewImagePath.startsWith('/preview_')) {
             console.log("[/api/generate-simple-preview] Curator returned valid path. Sending success response.");
             res.status(200).json({ previewImagePath: previewImagePath }); // Send successful path
        } else {
             // Handle unexpected return values (null, undefined, etc.)
             console.error("[/api/generate-simple-preview] Curator returned unexpected value:", previewImagePath);
             throw new Error('Unexpected return value from image generator.'); // Trigger catch block
        }
        // --- End Handling ---
        console.log("--- /api/generate-simple-preview: Endpoint END (Success Path) ---"); // Log end success

    } catch (error) {
        // --- Log Error Explicitly ---
        console.error("--- /api/generate-simple-preview: CATCH BLOCK ERROR ---"); // Log Catch Entry
        console.error("[/api/generate-simple-preview ERROR RAW]", error); // Log raw error
        console.error(`[/api/generate-simple-preview ERROR Message]: ${error.message}`); // Log message
        console.log("--- /api/generate-simple-preview: Endpoint END (Error Path) ---"); // Log Error End
        // --- End Log ---
        // Send a 500 status and the fallback path in case of unexpected errors
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
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });

} else {
  startApp();
}
