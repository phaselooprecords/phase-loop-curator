// curator.js (UPDATED with XML escaping for SVG text)

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
        return ''; // Return empty string if input is not a string
    }
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c; // Should not happen with the regex
        }
    });
}


// --- API FUNCTION 1: GENERATE AI TEXT (Unchanged) ---
async function generateAiText(article) {
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
        result.originalSource = article.source; // Pass this back too
        console.log(`[AI] Successfully generated content for: ${article.title}`);
        return result;
    } catch (error) {
        console.error("[AI ERROR]", error.message);
        return { headline: "AI Failed", description: "Try again.", caption: "Error.", originalSource: article.source };
    }
}

// --- API FUNCTION 2: SEARCH FOR IMAGES (WITH FILTERS) (Unchanged) ---
async function searchForRelevantImages(title, source) {
    const query = `${title} ${source}`; // SMARTER QUERY: e.g., "Meric Long..." + "Pitchfork"
    console.log(`[Image Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({
            auth: GOOGLE_API_KEY,
            cx: GOOGLE_SEARCH_CX,
            q: query,
            searchType: 'image',
            num: 9,
            safe: 'high',
            imgType: 'photo',   // NEW FILTER: No clip art or line drawings
            imgSize: 'medium'   // NEW FILTER: No tiny icons
        });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No images found.'); }
        const imageUrls = response.data.items.map(item => item.link);
        console.log(`[Image Search] Found ${imageUrls.length} URLs.`);
        return imageUrls;
    } catch (error) { console.error(`[Image Search ERROR]`, error.message); return []; }
}

// --- API FUNCTION 3: FIND RELATED WEB ARTICLES (UPDATED QUERY) (Unchanged) ---
async function findRelatedWebArticles(title, source) {
    const query = `${title} ${source}`;
    console.log(`[Web Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({
            auth: GOOGLE_API_KEY,
            cx: GOOGLE_SEARCH_CX,
            q: query,
            num: 5 // Get 5 related links
        });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No related articles found.'); }
        
        const articles = response.data.items.map(item => ({
            title: item.title,
            link: item.link,
            source: item.displayLink
        }));
        console.log(`[Web Search] Found ${articles.length} related articles.`);
        return articles;
    } catch (error) { console.error(`[Web Search ERROR]`, error.message); return []; }
}


// --- UTILITY FUNCTION: GENERATE PREVIEW IMAGE (*** UPDATED ***) ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview for: ${imageUrl}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();

        // Ensure description is a string before splitting
        const descText = typeof description === 'string' ? description : '';
        // Extract and escape the first sentence
        const firstSentenceRaw = descText.split(/[.!?]/)[0];
        const firstSentence = escapeXml(firstSentenceRaw ? firstSentenceRaw + '.' : ''); // Add period back if sentence exists
        
        // Clean and escape the headline
        const cleanedHeadlineRaw = (typeof headline === 'string' ? headline : '').replace(/^\*\*|\*\*$/g, '');
        const cleanedHeadline = escapeXml(cleanedHeadlineRaw);


        const overlayHeight = 90;
        // Use the escaped text variables in the SVG
        const svgOverlay = `<svg width="800" height="${overlayHeight}">
            <rect x="0" y="0" width="800" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            <text x="15" y="35" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: 22px; font-weight: 900;" fill="#FFFFFF">${cleanedHeadline}</text>
            <text x="15" y="65" style="font-family: Arial, sans-serif; font-size: 14px;" fill="#DDDDDD">${firstSentence}</text>
        </svg>`;

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
        console.error(`[Simple Preview ERROR]`, error); // Log the full error
        return '/fallback.png';
    }
}

// --- EXPORTS ---
module.exports = {
    generateAiText,
    searchForRelevantImages,
    findRelatedWebArticles,
    generateSimplePreviewImage
};