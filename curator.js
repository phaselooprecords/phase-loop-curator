// curator.js (FIXED: Round compositeTop value to integer)

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
        console.warn('[escapeXml] Input was not a string:', unsafe);
        return '';
    }
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

// --- HELPER FUNCTION: Wrap text for SVG ---
function wrapText(text, maxCharsPerLine) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
        if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) { // Added check for empty currentLine
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    lines.push(currentLine.trim());
    return lines.slice(0, 2); // Limit to 2 lines
}


// --- API FUNCTION 1: GENERATE AI TEXT (Unchanged) ---
async function generateAiText(article) {
    // ... (This function remains the same) ...
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
    // ... (This function remains the same) ...
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
    // ... (This function remains the same) ...
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


// --- UTILITY FUNCTION: GENERATE PREVIEW IMAGE (*** UPDATED: Round compositeTop ***) ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview generation.`);
    console.log(`[Simple Preview] Image URL: ${imageUrl}`);
    console.log(`[Simple Preview] Raw Headline:`, headline);
    console.log(`[Simple Preview] Raw Description:`, description);

    try {
        if (!imageUrl || typeof imageUrl !== 'string') {
             throw new Error('Invalid or missing imageUrl');
        }
         const headlineText = typeof headline === 'string' ? headline : '';
         const descText = typeof description === 'string' ? description : '';

        console.log(`[Simple Preview] Fetching image...`);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed for ${imageUrl}: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        console.log(`[Simple Preview] Image fetched successfully.`);

        // --- Text Preparation ---
        const cleanedHeadlineRaw = headlineText.replace(/^\*\*|\*\*$/g, '').trim();
        const headlineLines = wrapText(cleanedHeadlineRaw, 40);
        const escapedHeadlineLines = headlineLines.map(line => escapeXml(line));
        console.log(`[Simple Preview] Escaped Headline Lines:`, escapedHeadlineLines);

        const firstSentenceRaw = descText.split(/[.!?]/)[0];
        const fullFirstSentence = firstSentenceRaw ? firstSentenceRaw.trim() + '.' : '';
        const sentenceLines = wrapText(fullFirstSentence, 80);
        const escapedSentenceLines = sentenceLines.map(line => escapeXml(line));
        console.log(`[Simple Preview] Escaped Sentence Lines:`, escapedSentenceLines);
        // --- End Text Preparation ---


        // --- SVG Generation ---
        const headlineFontSize = 28;
        const sentenceFontSize = 18;
        const lineSpacing = 1.2; // Multiplier for line height (adjusts vertical space between lines)
        const textBlockSpacing = 10; // Pixels between headline block and sentence block
        const padding = 15; // Padding inside the overlay box

        // Calculate needed height based on lines
        // Add (lines.length - 1) * fontSize * (lineSpacing - 1) for inter-line spacing within a block
        const headlineHeight = escapedHeadlineLines.length * headlineFontSize + (escapedHeadlineLines.length > 1 ? (escapedHeadlineLines.length - 1) * headlineFontSize * (lineSpacing - 1) : 0);
        const sentenceHeight = escapedSentenceLines.length * sentenceFontSize + (escapedSentenceLines.length > 1 ? (escapedSentenceLines.length - 1) * sentenceFontSize * (lineSpacing - 1) : 0);
        const totalTextHeight = headlineHeight + sentenceHeight + textBlockSpacing;
        const overlayHeight = Math.max(110, totalTextHeight + padding * 2); // Ensure min height, add top/bottom padding

        // Generate TSPAN elements for headline
        let headlineTspans = '';
        escapedHeadlineLines.forEach((line, index) => {
            // dy controls vertical shift *relative* to the previous tspan or the text element's y
            const dy = index === 0 ? 0 : `${lineSpacing}em`; // Use em for relative spacing
            headlineTspans += `<tspan x="${padding}" dy="${dy}">${line}</tspan>`;
        });

        // Generate TSPAN elements for sentence
        let sentenceTspans = '';
        escapedSentenceLines.forEach((line, index) => {
            const dy = index === 0 ? 0 : `${lineSpacing}em`;
            sentenceTspans += `<tspan x="${padding}" dy="${dy}">${line}</tspan>`;
        });

        // Calculate starting Y positions (baseline of the first line)
        const headlineStartY = padding + headlineFontSize; // Start Y for first line of headline
        const sentenceStartY = headlineStartY + headlineHeight + textBlockSpacing; // Start Y for first line of sentence

        const svgOverlay = `<svg width="800" height="${overlayHeight}">
            <rect x="0" y="0" width="800" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            <text y="${headlineStartY}" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: ${headlineFontSize}px; font-weight: 900;" fill="#FFFFFF">
                ${headlineTspans}
            </text>
            <text y="${sentenceStartY}" style="font-family: Arial, sans-serif; font-size: ${sentenceFontSize}px;" fill="#DDDDDD">
                ${sentenceTspans}
            </text>
        </svg>`;
        console.log(`[Simple Preview] Generated SVG Overlay string.`);
        // --- End SVG Generation ---


        console.log(`[Simple Preview] Processing image with Sharp...`);
        // *** THIS IS THE FIX: Round the calculated top position ***
        const compositeTop = Math.round(800 - overlayHeight - 15); // Position from bottom, rounded
        console.log(`[Simple Preview] Overlay height: ${overlayHeight}, Composite top: ${compositeTop}`); // Log the rounded value

        const previewImageBuffer = await sharp(imageBuffer)
            .resize({ width: 800, height: 800, fit: 'cover' })
            // Use the rounded integer value here
            .composite([{ input: Buffer.from(svgOverlay), top: compositeTop, left: 0 }])
            .png().toBuffer();
        console.log(`[Simple Preview] Image processing complete.`);

        const filename = `preview_${Date.now()}.png`;
        const imagePath = path.join(process.cwd(), 'public', filename);
        await fs.writeFile(imagePath, previewImageBuffer);
        console.log(`[Simple Preview] Success: Image saved to ${imagePath}`);
        return `/${filename}`;

    } catch (error) {
        console.error(`[Simple Preview ERROR] Failed to generate preview:`, error);
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
