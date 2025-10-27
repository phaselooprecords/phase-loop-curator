// curator.js (UPDATED: Revised generateAiText prompt)

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
const model = 'gemini-2.5-flash';
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;


// --- HELPER FUNCTIONS (escapeXml, wrapText - Unchanged) ---
function escapeXml(unsafe) { /* ... */ }
function wrapText(text, maxCharsPerLine) { /* ... */ }

// --- API FUNCTION 1: GENERATE AI TEXT (*** PROMPT UPDATED ***) ---
async function generateAiText(article) {
    // --- UPDATED PROMPT ---
    const prompt = `
        You are a content curator for "Phase Loop Records," focused on deep, technical electronic/rock music news, adhering to journalistic best practices (clarity, accuracy, conciseness).
        TASK: Analyze the news based ONLY on the provided title. Generate the following content:
        1.  **image_headline**: A very concise headline (5-7 words, technical style, suitable for an image overlay). Make this bold using markdown (**headline**).
        2.  **short_description**: A brief description (max 40 words, MUST include key artists/subjects mentioned in the title, suitable for an image overlay).
        3.  **social_caption**: A social media post caption (max 100 words total) ready for platforms like Instagram/Twitter, structured precisely as follows:
            * First line: An attention-grabbing social media headline (different from image_headline, avoid markdown bolding).
            * Second line: Start a new paragraph. Write one informative paragraph that uniquely summarizes the core news inferred from the source article title. Use an engaging, journalistic tone. Avoid repeating phrases from the input title or the social media headline.
            * End the paragraph by mentioning the news source: (Source: ${article.source}).
            * Include the hashtag #PhaseLoopRecords.

        NEWS TITLE: "${article.title}"

        Ensure the generated text avoids repetition and presents the information clearly. The social_caption MUST follow the two-part structure (headline, then paragraph with source/hashtag).
        FORMAT RESPONSE STRICTLY AS JSON: { "image_headline": "...", "short_description": "...", "social_caption": "..." }`;
    // --- END UPDATED PROMPT ---

    console.log(`[generateAiText] Starting AI generation for: ${article.title}`);
    try {
        console.log("[generateAiText] Sending prompt to Gemini model:", model);
        const response = await ai.models.generateContent({
             model,
             contents: [{ role: 'user', parts: [{ text: prompt }] }],
             generationConfig: { responseMimeType: "application/json" }
         });
        console.log("[generateAiText] Received response from Gemini.");

        const rawResponseText = response?.response?.text();
        console.log("[generateAiText] Raw Gemini response text:", rawResponseText);

        if (!rawResponseText) { throw new Error("Gemini API response text was empty or invalid structure."); }

        console.log("[generateAiText] Attempting to parse JSON...");
        // --- RENAME OUTPUT VARIABLES TO MATCH NEW JSON KEYS ---
        const resultJson = JSON.parse(rawResponseText.trim());
        const result = {
            headline: resultJson.image_headline, // Map image_headline back to headline
            description: resultJson.short_description, // Map short_description back to description
            caption: resultJson.social_caption, // Map social_caption back to caption
            originalSource: article.source // Keep original source
        };
        // --- END RENAME ---
        console.log("[generateAiText] JSON parsed successfully:", result); // Log the mapped result

        // Basic validation on the *expected* output fields
        if (!result.headline || !result.description || !result.caption) {
             console.warn("[generateAiText] Parsed JSON missing expected fields (headline, description, caption).");
             throw new Error("Parsed JSON missing expected fields.");
         }


        console.log(`[generateAiText] Successfully generated content.`);
        return result; // Return the object with the original key names

    } catch (error) {
        console.error("[generateAiText ERROR]", error);
        return { headline: "AI Failed", description: "Generation Error. See server logs.", caption: "Error.", originalSource: article.source };
    }
}


// --- API FUNCTION 2: EXTRACT SEARCH KEYWORDS (Unchanged) ---
async function extractSearchKeywords(headline, description) { /* ... unchanged ... */ }

// --- API FUNCTION 3: GET ALTERNATIVE KEYWORDS (Unchanged) ---
async function getAlternativeKeywords(headline, description, previousKeywords = []) { /* ... unchanged ... */ }

// --- API FUNCTION 4: SEARCH FOR IMAGES (Unchanged) ---
async function searchForRelevantImages(query, startIndex = 0) { /* ... unchanged ... */ }

// --- API FUNCTION 5: FIND RELATED WEB ARTICLES (Unchanged) ---
async function findRelatedWebArticles(title, source) { /* ... unchanged ... */ }

// --- API FUNCTION 6: FIND RELATED VIDEO (Unchanged) ---
async function findRelatedVideo(title, source) { /* ... unchanged ... */ }

// --- UTILITY FUNCTION: GENERATE PREVIEW IMAGE (Unchanged) ---
async function generateSimplePreviewImage(imageUrl, headline, description) { /* ... unchanged ... */ }

// --- EXPORTS (Unchanged) ---
module.exports = {
    generateAiText,
    extractSearchKeywords,
    getAlternativeKeywords,
    searchForRelevantImages,
    findRelatedWebArticles,
    findRelatedVideo,
    generateSimplePreviewImage
};
