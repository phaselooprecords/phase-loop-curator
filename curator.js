// curator.js (FIXED: Correct Gemini response handling)

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


// --- HELPER FUNCTIONS (escapeXml, wrapText - Unchanged) ---
function escapeXml(unsafe) { /* ... */ }
function wrapText(text, maxCharsPerLine) { /* ... */ }

// --- API FUNCTION 1: GENERATE AI TEXT (*** RESPONSE HANDLING FIXED ***) ---
async function generateAiText(article) {
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

    console.log(`[generateAiText] Starting AI generation for: ${article.title}`);
    try {
        console.log("[generateAiText] Sending prompt to Gemini model:", model);
        const generationResult = await ai.models.generateContent({ // Renamed variable
             model,
             contents: [{ role: 'user', parts: [{ text: prompt }] }],
             generationConfig: { responseMimeType: "application/json" }
         });
        console.log("[generateAiText] Received response from Gemini.");

        // --- *** CORRECT WAY TO ACCESS RESPONSE TEXT *** ---
        // Access the text() method from the response object within the result
        const response = generationResult.response; // Get the actual response object
        const rawResponseText = response?.text();   // Call the text() method
        // --- *** END FIX *** ---

        console.log("[generateAiText] Raw Gemini response text:", rawResponseText); // Log the result of text()

        if (!rawResponseText) { // Check if the raw text is empty/null/undefined
            // Log the full response structure if text is missing, for debugging
            console.error("[generateAiText ERROR] Gemini response structure might be unexpected:", JSON.stringify(generationResult, null, 2));
            throw new Error("Gemini API response text was empty or invalid structure.");
        }

        console.log("[generateAiText] Attempting to parse JSON...");
        const resultJson = JSON.parse(rawResponseText.trim());
        const result = {
            headline: resultJson.image_headline,
            description: resultJson.short_description,
            caption: resultJson.social_caption,
            originalSource: article.source
        };
        console.log("[generateAiText] JSON parsed successfully:", result);

        if (!result.headline || !result.description || !result.caption) {
             console.warn("[generateAiText] Parsed JSON missing expected fields.");
             // Even if fields are missing, try returning what we have, maybe it's partially usable?
             // Or throw error: throw new Error("Parsed JSON missing expected fields.");
         }

        console.log(`[generateAiText] Successfully generated content.`);
        return result;

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

// --- EXPORTS ---
module.exports = {
    generateAiText,
    extractSearchKeywords,
    getAlternativeKeywords,
    searchForRelevantImages,
    findRelatedWebArticles,
    findRelatedVideo,
    generateSimplePreviewImage
};
