// curator.js (Further enhanced generateSimplePreviewImage with more logging)

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

// --- HELPER FUNCTION: Escape XML/HTML characters ---
function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') {
        console.warn('[escapeXml] Input was not a string:', unsafe); // Add warning
        return ''; // Return empty string if input is not a string
    }
    // Replace characters problematic for XML/SVG
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}

// --- API FUNCTION 1: GENERATE AI TEXT (Unchanged) ---
async function generateAiText(article) {
    // ... (This function remains the same as before)
    const prompt = `
        You are a content curator for "Phase Loop Records," focused on deep, technical electronic/rock music news.
        TASK: Synthesize the news based on the title. Generate:
        1. HEADLINE (5-7 words, bold, technical style).
        2. SHORT DESCRIPTION (max 40 words, MUST include key artists/subjects mentioned in the text).
        3. SOCIAL MEDIA CAPTION (max 100 words). Include #PhaseLoopRecords and mention source (${article.source}).
        NEWS TITLE: "${article.title}"
        FORMAT RESPONSE STRICTLY AS JSON: { "headline": "...", "description": "...", "caption": "..." }`;

    try {
        const response = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }], config: { responseMimeType: "application/json" } });
        if (!response || !response.text) { throw new Error("API response text invalid."); }
        const result = JSON.parse(response.text.trim());
        result.originalSource = article.source;
        console.log(`[AI] Successfully generated content for: ${article.title}`);
        return result;
    } catch (error) {
        console.error("[AI ERROR]", error.message);
        return { headline: "AI Failed", description: "Try again.", caption: "Error.", originalSource: article.source };
    }
}

// --- API FUNCTION 2: SEARCH FOR IMAGES (Unchanged) ---
async function searchForRelevantImages(title, source) {
    // ... (This function remains the same as before)
    const query = `${title} ${source}`;
    console.log(`[Image Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({
            auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, searchType: 'image', num: 9, safe: 'high', imgType: 'photo', imgSize: 'medium'
        });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No images found.'); }
        const imageUrls = response.data.items.map(item => item.link);
        console.log(`[Image Search] Found ${imageUrls.length} URLs.`);
        return imageUrls;
    } catch (error) { console.error(`[Image Search ERROR]`, error.message); return []; }
}

// --- API FUNCTION 3: FIND RELATED WEB ARTICLES (Unchanged) ---
async function findRelatedWebArticles(title, source) {
    // ... (This function remains the same as before)
     const query = `${title} ${source}`;
    console.log(`[Web Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({
            auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, num: 5
        });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No related articles found.'); }
        const articles = response.data.items.map(item => ({ title: item.title, link: item.link, source: item.displayLink }));
        console.log(`[Web Search] Found ${articles.length} related articles.`);
        return articles;
    } catch (error) { console.error(`[Web Search ERROR]`, error.message); return []; }
}


// --- UTILITY FUNCTION: GENERATE PREVIEW IMAGE (*** ADDED MORE CHECKS & LOGGING ***) ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview generation.`);
    console.log(`[Simple Preview] Image URL: ${imageUrl}`);
    console.log(`[Simple Preview] Raw Headline:`, headline); // Log raw input
    console.log(`[Simple Preview] Raw Description:`, description); // Log raw input

    try {
        // --- Input Validation ---
        if (!imageUrl || typeof imageUrl !== 'string') {
             throw new Error('Invalid or missing imageUrl');
        }
         const headlineText = typeof headline === 'string' ? headline : '';
         const descText = typeof description === 'string' ? description : '';
        // --- End Input Validation ---

        console.log(`[Simple Preview] Fetching image...`);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed for ${imageUrl}: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        console.log(`[Simple Preview] Image fetched successfully.`);

        // Extract and escape the first sentence
        const firstSentenceRaw = descText.split(/[.!?]/)[0]; // Get segment before first ., !, or ?
        const firstSentence = escapeXml(firstSentenceRaw ? firstSentenceRaw.trim() + '.' : ''); // Add period back, trim whitespace
        console.log(`[Simple Preview] Escaped First Sentence: ${firstSentence}`); // Log escaped result

        // Clean and escape the headline
        const cleanedHeadlineRaw = headlineText.replace(/^\*\*|\*\*$/g, '').trim(); // Remove markdown, trim whitespace
        const cleanedHeadline = escapeXml(cleanedHeadlineRaw);
        console.log(`[Simple Preview] Escaped Headline: ${cleanedHeadline}`); // Log escaped result

        const overlayHeight = 90;
        // Use the escaped text variables in the SVG
        const svgOverlay = `<svg width="800" height="${overlayHeight}">
            <rect x="0" y="0" width="800" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            <text x="15" y="35" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 22px; font-weight: 900;" fill="#FFFFFF">${cleanedHeadline}</text>
            <text x="15" y="65" style="font-family: Arial, sans-serif; font-size: 14px;" fill="#DDDDDD">${firstSentence}</text>
        </svg>`;
        console.log(`[Simple Preview] Generated SVG Overlay string.`);

        console.log(`[Simple Preview] Processing image with Sharp...`);
        const previewImageBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: 'cover' })
            .composite([{ input: Buffer.from(svgOverlay), top: 800 - overlayHeight - 20, left: 0 }])
            .png().toBuffer();
        console.log(`[Simple Preview] Image processing complete.`);

        const filename = `preview_${Date.now()}.png`;
        const imagePath = path.join(process.cwd(), 'public', filename);
        await fs.writeFile(imagePath, previewImageBuffer);
        console.log(`[Simple Preview] Success: Image saved to ${imagePath}`);
        return `/${filename}`; // Return relative path for the browser

    } catch (error) {
        // Log the detailed error
        console.error(`[Simple Preview ERROR] Failed to generate preview:`, error);
        return '/fallback.png'; // Return fallback path on error
    }
}

// --- EXPORTS ---
module.exports = {
    generateAiText,
    searchForRelevantImages,
    findRelatedWebArticles,
    generateSimplePreviewImage
};