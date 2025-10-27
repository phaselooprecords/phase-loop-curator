k// server.js (UPDATED with /api/extract-keywords endpoint)

// 1. Import modules (unchanged)
// ... (rest of imports)
const curator = require('./curator'); // curator now exports extractSearchKeywords

// ... (other setup code)

// --- MIDDLEWARE SETUP (unchanged) ---
// ...

// --- API ROUTES (Endpoints) ---

// Root route (unchanged)
// ...

// Fetch all stored news articles (unchanged)
app.get('/api/news', async (req, res) => { /* ... unchanged ... */ });

// Endpoint 1: Generate AI Text (Unchanged)
app.post('/api/generate-text', async (req, res) => { /* ... unchanged ... */ });

// --- *** NEW ENDPOINT: EXTRACT KEYWORDS *** ---
app.post('/api/extract-keywords', async (req, res) => {
    const { headline, description } = req.body;
    if (!headline || !description) {
        return res.status(400).json({ error: 'Missing headline or description for keyword extraction.' });
    }
    try {
        const keywords = await curator.extractSearchKeywords(headline, description);
        res.json({ keywords }); // Send back the keyword string or null
    } catch (error) {
        console.error("Error during keyword extraction:", error);
        res.status(500).json({ error: 'Keyword extraction failed.' });
    }
});


// Endpoint 2: Search for Images (Unchanged - already takes query)
app.post('/api/search-images', async (req, res) => { /* ... unchanged ... */ });

// Endpoint 3: Find Related Articles (Unchanged)
app.post('/api/find-related-articles', async (req, res) => { /* ... unchanged ... */ });

// Endpoint 4: Find Video (Unchanged)
app.post('/api/find-video', async (req, res) => { /* ... unchanged ... */ });

// Simple Preview Image Generation (Unchanged)
app.post('/api/generate-simple-preview', async (req, res) => { /* ... unchanged ... */ });

// Social Media Sharing (Unchanged)
app.post('/api/share', async (req, res) => { /* ... unchanged ... */ });


// --- SERVER START FUNCTION (unchanged) ---
async function startApp() { /* ... unchanged ... */ }

// --- INITIATE SERVER START (unchanged) ---
if (cluster.isPrimary) { /* ... unchanged ... */ } else { startApp(); }
