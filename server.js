// server.js (ESM Version)
import express from 'express';
import bodyParser from 'body-parser';
import * as aggregator from './aggregator.js';
import * as db from './database.js';
import * as curator from './curator.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.get('/', (req, res) => res.send('Phase Loop Records API is running!'));

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

app.post('/api/share', async (req, res) => {
    console.log("--> Received request for /api/share");
    // ... (rest of your mock share logic) ...
    res.json({ success: true, message: `Successfully simulated sharing!` });
});

async function startApp() {
    try {
        await db.connectDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            aggregator.startScheduler();
        });
    } catch (dbError) {
        console.error("Failed to start server due to DB connection error:", dbError);
        process.exit(1);
    }
}
startApp();
