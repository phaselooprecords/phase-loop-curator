require('dotenv').config();
// --- *** THIS LINE MUST BE PRESENT AND CORRECT *** ---
const { GoogleGenAI } = require('@google/genai');
// --- *** END CHECK *** ---
const { google } = require('googleapis');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs/promises');
const fetch = require('node-fetch');

// --- API CLIENTS SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }); // This line needs GoogleGenAI
const model = 'gemini-2.5-flash';
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY;
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// ... (Rest of the file remains the same) ...

// --- HELPER FUNCTIONS ---
function escapeXml(unsafe) { /* ... */ }
function wrapText(text, maxCharsPerLine) { /* ... */ }


// --- API FUNCTION 1: GENERATE AI TEXT (*** RESPONSE ACCESS FIXED ***) ---
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
        const generationResult = await ai.models.generateContent({
             model,
             contents: [{ role: 'user', parts: [{ text: prompt }] }],
             generationConfig: { responseMimeType: "application/json" }
         });
        console.log("[generateAiText] Received response from Gemini.");

        // --- *** CORRECT WAY TO ACCESS RESPONSE TEXT *** ---
        // Navigate through the structure shown in the logs
        let rawResponseText = null;
        try {
            // Use optional chaining to safely access nested properties
            rawResponseText = generationResult?.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        } catch (accessError) {
             console.error("[generateAiText ERROR] Error accessing nested response text:", accessError);
             // Log the structure again if access fails
             console.error("[generateAiText ERROR] Unexpected Gemini response structure:", JSON.stringify(generationResult, null, 2));
             throw new Error("Gemini API response structure was unexpected.");
        }
        // --- *** END FIX *** ---

        console.log("[generateAiText] Raw Gemini response text:", rawResponseText); // Log the extracted text

        if (typeof rawResponseText !== 'string' || rawResponseText.trim() === '') { // Check if it's a non-empty string
            console.error("[generateAiText ERROR] Extracted Gemini response text is invalid or empty.");
            // Log the structure again if text is invalid
             console.error("[generateAiText ERROR] Gemini response structure:", JSON.stringify(generationResult, null, 2));
            throw new Error("Gemini API response text was invalid or empty.");
        }

        console.log("[generateAiText] Attempting to parse JSON...");
        // --- Clean potential markdown code block fences before parsing ---
        const cleanedJsonString = rawResponseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        // --- End clean ---

        const resultJson = JSON.parse(cleanedJsonString); // Parse the cleaned string
        const result = {
            headline: resultJson.image_headline,
            description: resultJson.short_description,
            caption: resultJson.social_caption,
            originalSource: article.source
        };
        console.log("[generateAiText] JSON parsed successfully:", result);

        if (!result.headline || !result.description || !result.caption) {
             console.warn("[generateAiText] Parsed JSON missing expected fields.");
             // Consider throwing error here if fields are absolutely required
             // throw new Error("Parsed JSON missing expected fields.");
         }

        console.log(`[generateAiText] Successfully generated content.`);
        return result;

    } catch (error) {
        // Log the specific error
        console.error("[generateAiText CATCH BLOCK ERROR]", error);
        return { headline: "AI Failed", description: "Generation Error. See server logs.", caption: "Error.", originalSource: article.source };
    }
}


// ... (rest of curator.js functions: extractSearchKeywords, searchForRelevantImages, etc.) ...

// --- EXPORTS ---
module.exports = {
    generateAiText,
    // ... other exports
};
