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

// --- API FUNCTION 1: GENERATE AI TEXT (*** RESPONSE ACCESS PATH FIXED ***) ---
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

        // --- *** CORRECTED RESPONSE ACCESS PATH *** ---
        let rawResponseText = null;
        try {
            // Check structure more carefully, starting directly from generationResult.candidates
            if (generationResult &&
                generationResult.candidates &&
                generationResult.candidates.length > 0 &&
                generationResult.candidates[0].content &&
                generationResult.candidates[0].content.parts &&
                generationResult.candidates[0].content.parts.length > 0 &&
                typeof generationResult.candidates[0].content.parts[0].text === 'string'
            ) {
                 // Access as a property, directly under generationResult
                 rawResponseText = generationResult.candidates[0].content.parts[0].text;
            } else {
                 console.error("[generateAiText ERROR] Unexpected Gemini response structure (Candidates/Content/Parts):", JSON.stringify(generationResult, null, 2));
                 throw new Error("Unexpected Gemini response structure (Candidates/Content/Parts).");
            }
        } catch (accessError) {
             console.error("[generateAiText ERROR] Error accessing nested response text:", accessError);
             console.error("[generateAiText ERROR] Full Gemini Response on Access Error:", JSON.stringify(generationResult, null, 2));
             throw new Error("Error processing Gemini response structure.");
        }
        // --- *** END CORRECTION *** ---

        console.log("[generateAiText] Raw Gemini response text:", rawResponseText);

        if (!rawResponseText || rawResponseText.trim() === '') {
            console.error("[generateAiText ERROR] Extracted Gemini response text is invalid or empty.");
            throw new Error("Extracted Gemini response text was invalid or empty.");
        }

        console.log("[generateAiText] Attempting to parse JSON...");
        const cleanedJsonString = rawResponseText.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
        const resultJson = JSON.parse(cleanedJsonString);
        const result = {
            headline: resultJson.image_headline,
            description: resultJson.short_description,
            caption: resultJson.social_caption,
            originalSource: article.source
        };
        console.log("[generateAiText] JSON parsed successfully:", result);

        if (!result.headline || !result.description || !result.caption) {
             console.warn("[generateAiText] Parsed JSON missing expected fields.");
             throw new Error("Parsed JSON missing expected fields (headline, description, caption).");
         }

        console.log(`[generateAiText] Successfully generated content.`);
        return result;

    } catch (error) {
        console.error("[generateAiText CATCH BLOCK ERROR]", error.message);
        return { headline: "AI Failed", description: "Generation Error. See server logs.", caption: "Error.", originalSource: article.source };
    }
}
// ... (rest of curator.js functions: extractSearchKeywords, searchForRelevantImages, etc.) ...

// --- EXPORTS ---
module.exports = {
    generateAiText,
    // ... other exports
};
