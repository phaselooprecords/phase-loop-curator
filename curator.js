// curator.js (FINAL VERSION - Stylish Text Overlays)

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { google } = require('googleapis');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs/promises');
const fetch = require('node-fetch');

// --- API CLIENTS SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// --- HELPER FUNCTION: REAL IMAGE SEARCH ---
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

// --- CORE FUNCTION 1: CURATE ARTICLE ---
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
        FORMAT RESPONSE STRICTLY AS JSON: { "headline": "...", "description": "...", "caption": "..." }`;
    try {
        const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: "application/json" } });
        if (!response || !response.text) { throw new Error("API response text invalid."); }
        const result = JSON.parse(response.text.trim());
        console.log(`[AI] Successfully generated content for: ${article.title}`);
        result.images = relevantImages;
        result.originalSource = article.source;
        return result;
    } catch (error) { console.error("[AI ERROR]", error.message); return { headline: "AI Failed", description: "Try again.", caption: "Error.", images: relevantImages }; }
}

// curator.js (UPDATED functions for text fit)

// --- CORE FUNCTION 3: GENERATE SIMPLE PREVIEW IMAGE (Final Text Fit) ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview for: ${imageUrl}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        const firstSentence = description.split(/[.!?]/)[0] + '.';
        const cleanedHeadline = headline.replace(/^\*\*|\*\*$/g, '');

        // **REDUCED HEADLINE FONT SIZE**
        const overlayHeight = 90;
        const svgOverlay = `<svg width="800" height="${overlayHeight}">
            <rect x="0" y="0" width="800" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            {/* Headline: Reduced font size to 22px */}
            <text x="15" y="35" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 22px; font-weight: 900;" fill="#FFFFFF">${cleanedHeadline}</text>
            {/* First sentence */}
            <text x="15" y="65" style="font-family: Arial, sans-serif; font-size: 14px;" fill="#DDDDDD">${firstSentence}</text>
        </svg>`;

        const previewImageBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: 'cover' })
            .composite([{ input: Buffer.from(svgOverlay), top: 800 - overlayHeight - 20, left: 0 }]) // Positioned 20px from bottom
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


// --- EXPORTS ---
// (Ensure exports include curateArticle and generateSimplePreviewImage)
module.exports = {
    curateArticle,
    // generateBrandedImage, // This should be removed if you simplified
    generateSimplePreviewImage
};
