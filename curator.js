// curator.js (UPDATED: Added keyword extraction, search returns query)

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { google } = require('googleapis');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs/promises');
const fetch = require('node-fetch');

// --- API CLIENTS SETUP ---
// ... (unchanged)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash'; // Ensure this model is suitable or use a more advanced one if needed
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// --- HELPER FUNCTIONS (escapeXml, wrapText - Unchanged) ---
// ... (unchanged)
function escapeXml(unsafe) { /* ... */ }
function wrapText(text, maxCharsPerLine) { /* ... */ }

// --- API FUNCTION 1: GENERATE AI TEXT (Unchanged) ---
async function generateAiText(article) { /* ... unchanged ... */ }

// --- *** NEW API FUNCTION: EXTRACT SEARCH KEYWORDS *** ---
async function extractSearchKeywords(headline, description) {
    console.log(`[AI Keywords] Extracting keywords from: "${headline}" / "${description}"`);
    // Combine headline and description for better context
    const inputText = `Headline: ${headline}\nDescription: ${description}`;
    const prompt = `
        Analyze the following text about a music news item. Identify the main subject(s) (artist, event, topic).
        Based ONLY on the main subject(s), provide the BEST concise keyword phrase (max 4 words) suitable for a Google Image Search to find relevant photos of that subject.
        Examples:
        - Input: Headline: **Taylor Swift's Eras Tour Continues** Description: Taylor Swift performed her latest hits... Output: Taylor Swift Eras Tour
        - Input: Headline: **New Aphex Twin EP Announced** Description: Aphex Twin is releasing a new EP... Output: Aphex Twin
        - Input: Headline: **Festival Lineup Revealed** Description: The Coachella festival announced headliners including... Output: Coachella lineup
        - Input: Headline: **BOYNEXTDOOR: Authenticity Algorithm Calibrated** Description: BOYNEXTDOOR details their commitment... Output: BOYNEXTDOOR band

        TEXT TO ANALYZE:
        "${inputText}"

        OUTPUT ONLY the keyword phrase.`;

    try {
        const response = await ai.models.generateContent({
            model: model, // Or consider a model better suited for extraction if needed
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
            // No specific JSON format needed here, just the text response
        });
        if (!response || !response.text) { throw new Error("AI keyword extraction API response invalid."); }
        const keywords = response.text.trim().replace(/[\*\"]/g, ''); // Clean up response
        console.log(`[AI Keywords] Extracted Keywords: "${keywords}"`);
        // Basic validation: return null if keywords are empty or seem like boilerplate error
        if (!keywords || keywords.toLowerCase().includes('cannot fulfill')) {
            console.warn('[AI Keywords] Extraction failed or returned invalid keywords.');
            return null;
        }
        return keywords;
    } catch (error) {
        console.error("[AI Keywords ERROR]", error.message);
        return null; // Return null on error
    }
}


// --- API FUNCTION 2: SEARCH FOR IMAGES (*** UPDATED to return query ***) ---
async function searchForRelevantImages(query, startIndex = 0) {
    console.log(`[Image Search] Searching for: "${query}" starting at index ${startIndex}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const apiStartIndex = startIndex + 1;

        const response = await customsearch.cse.list({
            auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, searchType: 'image',
            num: 9, start: apiStartIndex, safe: 'high', imgType: 'photo', imgSize: 'medium'
        });

        if (!response.data.items || response.data.items.length === 0) {
             if (startIndex === 0) { throw new Error('No images found for initial search.'); }
             else { console.log(`[Image Search] No more images found starting at index ${startIndex}.`); return []; }
        }

        // Map results to include image URL, context URL, AND the query used
        const imagesData = response.data.items.map(item => ({
            imageUrl: item.link,
            contextUrl: item.image?.contextLink,
            query: query // <-- Include the query used for this result
        }));

        console.log(`[Image Search] Found ${imagesData.length} images using query "${query}" starting at index ${startIndex}.`);
        return imagesData;

    } catch (error) {
        console.error(`[Image Search ERROR for query "${query}" at index ${startIndex}]`, error.message);
        return [];
    }
}

// --- API FUNCTION 3: FIND RELATED WEB ARTICLES (Unchanged) ---
async function findRelatedWebArticles(title, source) { /* ... unchanged ... */ }

// --- API FUNCTION 4: FIND RELATED VIDEO (Unchanged) ---
async function findRelatedVideo(title, source) { /* ... unchanged ... */ }

// --- UTILITY FUNCTION: GENERATE PREVIEW IMAGE (Unchanged) ---
async function generateSimplePreviewImage(imageUrl, headline, description) { /* ... unchanged ... */ }

// --- EXPORTS (UPDATED) ---
module.exports = {
    generateAiText,
    extractSearchKeywords, // <-- Export new function
    searchForRelevantImages,
    findRelatedWebArticles,
    findRelatedVideo,
    generateSimplePreviewImage
};
