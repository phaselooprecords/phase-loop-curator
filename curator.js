// curator.js (CommonJS Version)

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { google } = require('googleapis');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs/promises');
const fetch = require('node-fetch');

// --- API CLIENTS SETUP (v0.2.2 Syntax) ---
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY); // Main client
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

async function searchForRelevantImages(query) {
    console.log(`[Image Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, searchType: 'image', num: 9, safe: 'high' });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No images found.'); }
        const imageUrls = response.data.items.map(item => item.link);
        console.log(`[Image Search] Found ${imageUrls.length} URLs.`);
        return imageUrls;
    } catch (error) { console.error(`[Image Search ERROR]`, error.message); return []; }
}

async function curateArticle(article) {
    const searchQuery = `${article.title} ${article.source}`;
    const relevantImages = await searchForRelevantImages(searchQuery);
    const prompt = `
        You are a content curator for "Phase Loop Records," focused on deep, technical electronic/rock music news.
        TASK: Synthesize the news based on the title. Generate:
        1. HEADLINE (5-7 words, bold, technical style).
        2. SHORT DESCRIPTION (max 40 words).
        3. SOCIAL MEDIA CAPTION (max 100 words). Include #PhaseLoopRecords and mention source (${article.source}).
        NEWS TITLE: "${article.title}"
        
        This response MUST be in valid JSON format: { "headline": "...", "description": "...", "caption": "..." }`;

    try {
        // --- CORRECTED AI SYNTAX (v0.2.2) ---
        const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // Get model
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        // ---------------------------------

        if (!text) { throw new Error("API response text invalid."); }

        // Clean the text to ensure it's valid JSON
        const jsonText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const aiResult = JSON.parse(jsonText);
        
        console.log(`[AI] Successfully generated content for: ${article.title}`);
        
        aiResult.images = relevantImages;
        aiResult.originalSource = article.source;
        return aiResult;

    } catch (error) {
        console.error("[AI ERROR]", error.message);
        return { headline: "AI Failed", description: "Try again.", caption: "Error.", images: relevantImages };
    }
}

async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview for: ${imageUrl}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        const firstSentence = description.split(/[.!?]/)[0] + '.';
        const cleanedHeadline = headline.replace(/^\*\*|\*\*$/g, '');
        const overlayHeight = 90;
        const svgOverlay = `<svg width="800" height="${overlayHeight}"><rect x="0" y="0" width="800" height="${overlayHeight}" fill="#000000" opacity="0.7"/><text x="15" y="35" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 22px; font-weight: 900;" fill="#FFFFFF">${cleanedHeadline}</text><text x="15" y="65" style="font-family: Arial, sans-serif; font-size: 14px;" fill="#DDDDDD">${firstSentence}</text></svg>`;
        const previewImageBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: 'cover' })
            .composite([{ input: Buffer.from(svgOverlay), top: 800 - overlayHeight - 20, left: 0 }])
            .png().toBuffer();
        
        const filename = `preview_${Date.now()}.png`;
        const imagePath = path.join(process.cwd(), 'public', filename); 
        await fs.writeFile(imagePath, previewImageBuffer);
        
        console.log(`[Simple Preview] Success: ${imagePath}`);
        return `/${filename}`;
    } catch (error) {
        console.error(`[Simple Preview ERROR]`, error.message);
        return '/fallback.png';
    }
}

// --- EXPORTS (CommonJS Syntax) ---
module.exports = {
    curateArticle,
    generateSimplePreviewImage
};
