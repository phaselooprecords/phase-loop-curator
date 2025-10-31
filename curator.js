// curator.js (UPDATED: Image generation streams buffer, no filesystem)

require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { google } = require('googleapis');
// const path = require('path'); // <-- REMOVED
const sharp = require('sharp');
// const fs = require('fs/promises'); // <-- REMOVED
const fetch = require('node-fetch');

// --- API CLIENTS SETUP ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const model = 'gemini-2.5-flash';
const customsearch = google.customsearch('v1');
const GOOGLE_API_KEY = process.env.GEMINI_API_KEY; // Using one key for both
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// ... (keep escapeXml and wrapText helper functions exactly as they are) ...
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
function wrapText(text, maxCharsPerLine, maxLines = 2) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    words.forEach(word => {
        if (lines.length >= maxLines) return;
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length > maxCharsPerLine && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word;
            if (lines.length >= maxLines) return;
        } else {
            currentLine = testLine;
        }
    });
    if (currentLine.trim().length > 0 && lines.length < maxLines) {
        lines.push(currentLine.trim());
    }
    return lines.slice(0, maxLines);
}
// ... (keep generateAiText, extractSearchKeywords, getAlternativeKeywords, searchForRelevantImages, findRelatedWebArticles, findRelatedVideo exactly as they are) ...
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

        let rawResponseText = null;
        try {
            if (generationResult?.candidates?.[0]?.content?.parts?.[0]?.text && typeof generationResult.candidates[0].content.parts[0].text === 'string') {
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

        console.log("[generateAiText] Raw Gemini response text:", rawResponseText);
        if (!rawResponseText || rawResponseText.trim() === '') { console.error("[generateAiText ERROR] Extracted Gemini response text is invalid or empty."); throw new Error("Extracted Gemini response text was invalid or empty."); }

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
async function extractSearchKeywords(headline, description) {
    console.log(`[AI Keywords] Extracting keywords from: "${headline}" / "${description}"`);
    const inputText = `Headline: ${headline}\nDescription: ${description}`;
    const prompt = `
        Analyze the following text about a music news item:
        ---
        ${inputText}
        ---
        Identify the main subject(s) (artist, event, topic) from the text above.
        Based ONLY on the main subject(s), provide the BEST concise keyword phrase (max 4 words) suitable for a Google Image Search.
        OUTPUT ONLY the keyword phrase.`;
    try {
        const generationResult = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        console.log("[AI Keywords] Received response from Gemini.");
        let keywords = null;
        try {
            if (generationResult?.candidates?.[0]?.content?.parts?.[0]?.text && typeof generationResult.candidates[0].content.parts[0].text === 'string') {
                 keywords = generationResult.candidates[0].content.parts[0].text.trim().replace(/[\*\"]/g, '');
            } else {
                 console.error("[AI Keywords ERROR] Unexpected Gemini response structure:", JSON.stringify(generationResult, null, 2));
                 throw new Error("Unexpected Gemini response structure for keywords.");
            }
        } catch (accessError) {
              console.error("[AI Keywords ERROR] Error accessing nested keyword response text:", accessError);
              throw new Error("Error processing Gemini keyword response structure.");
         }
        console.log(`[AI Keywords] Extracted Keywords: "${keywords}"`);
        if (!keywords || keywords.toLowerCase().includes('cannot fulfill') || keywords.toLowerCase().includes('please provide')) {
            console.warn('[AI Keywords] Extraction failed or returned invalid keywords.');
            return null;
        }
        return keywords;
    } catch (error) {
        console.error("[AI Keywords CATCH BLOCK ERROR]", error.message);
        return null;
    }
}
async function getAlternativeKeywords(headline, description, previousKeywords = []) {
    const inputText = `Headline: ${headline}\nDescription: ${description}`;
    const previousKeywordsString = previousKeywords.length > 0 ? `The user has already tried searching with: ${previousKeywords.map(kw => `"${kw}"`).join(', ')}.` : "This is the first request for alternative keywords.";
    console.log(`[AI AltKeywords] Requesting alternative keywords, avoiding: ${previousKeywordsString}`);
    const prompt = `
        Analyze the following music news headline and description: "${inputText}"
        ${previousKeywordsString}
        The user needs a DIFFERENT, concise keyword phrase (max 4 words) suitable for a Google Image Search...
        OUTPUT ONLY the new alternative keyword phrase. Do not include quotation marks.`;

    try {
        const generationResult = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        console.log("[AI AltKeywords] Received response from Gemini.");
        let newKeywords = null;
        try {
            if (generationResult?.candidates?.[0]?.content?.parts?.[0]?.text && typeof generationResult.candidates[0].content.parts[0].text === 'string') {
                   newKeywords = generationResult.candidates[0].content.parts[0].text.trim().replace(/[\*\"]/g, '');
              } else {
                  console.error("[AI AltKeywords ERROR] Unexpected Gemini response structure:", JSON.stringify(generationResult, null, 2));
                  throw new Error("Unexpected Gemini response structure for alt keywords.");
              }
          } catch (accessError) {
               console.error("[AI AltKeywords ERROR] Error accessing nested alt keyword response text:", accessError);
               throw new Error("Error processing Gemini alt keyword response structure.");
          }
        console.log(`[AI AltKeywords] Raw Extracted Text: "${newKeywords}"`);
        if (!newKeywords || newKeywords.toLowerCase().includes('cannot fulfill') || previousKeywords.includes(newKeywords)) {
            console.warn('[AI AltKeywords] Extraction failed, returned invalid, or repeated keywords.');
            return null;
        }
        console.log(`[AI AltKeywords] Valid Alternative Keywords: "${newKeywords}"`);
        return newKeywords;
    } catch (error) {
        console.error("[AI AltKeywords CATCH BLOCK ERROR]", error.message);
        return null;
    }
}
async function searchForRelevantImages(query, startIndex = 0) {
    console.log(`[Image Search] Searching for: "${query}" starting at index ${startIndex}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const apiStartIndex = startIndex + 1;
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, searchType: 'image', num: 9, start: apiStartIndex, safe: 'high', imgType: 'photo', imgSize: 'medium' });
        if (!response.data.items || response.data.items.length === 0) { if (startIndex === 0) { throw new Error('No images found.'); } else { console.log(`[Image Search] No more images found.`); return []; } }
        const imagesData = response.data.items.map(item => ({ imageUrl: item.link, contextUrl: item.image?.contextLink, query: query, width: item.image?.width, height: item.image?.height }));
        console.log(`[Image Search] Found ${imagesData.length} images.`);
        return imagesData;
    } catch (error) { console.error(`[Image Search ERROR]`, error.message); return []; }
}
async function findRelatedWebArticles(title, source) {
    const query = `${title} ${source}`;
    console.log(`[Web Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, num: 5 });
        if (!response.data.items || response.data.items.length === 0) { throw new Error('No related articles found.'); }
        const articles = response.data.items.map(item => ({ title: item.title, link: item.link, source: item.displayLink }));
        console.log(`[Web Search] Found ${articles.length} related articles.`);
        return articles;
    } catch (error) { console.error(`[Web Search ERROR]`, error.message); return []; }
}
async function findRelatedVideo(title, source) {
    const query = `${title} video`; // Search using title only
    console.log(`[Video Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, num: 1 });
        if (response.data.items && response.data.items.length > 0) { const firstResult = response.data.items[0]; if (firstResult.link && (firstResult.link.includes('youtube.com/watch') || firstResult.link.includes('youtu.be/') || firstResult.link.includes('vimeo.com/'))) { console.log(`[Video Search] Found video: ${firstResult.link}`); return firstResult.link; } else { console.log(`[Video Search] Top result not video link: ${firstResult.link}`); } }
        else { console.log('[Video Search] No video results.'); }
        return null;
    } catch (error) { console.error(`[Video Search ERROR]`, error.message); return null; }
}


// --- *** CRITICAL FIX: Image Generation Function *** ---
// This function no longer saves to disk. It returns a buffer.
async function generateSimplePreviewImage(imageUrl, overlayTextString) {
    console.log(`[Simple Preview] Starting preview generation.`);
    console.log(`[Simple Preview] Image URL: ${imageUrl}`);
    console.log(`[Simple Preview] Raw Overlay Text:`, overlayTextString ? overlayTextString : 'N/A');

    try {
        if (!imageUrl || typeof imageUrl !== 'string') { throw new Error('Invalid imageUrl'); }
        const cleanOverlayText = typeof overlayTextString === 'string' ? overlayTextString.replace(/^\*\*|\*\*$/g, '').trim() : '';

        console.log(`[Simple Preview] Fetching image: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        console.log(`[Simple Preview] Image fetched.`);

        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;
        if (!originalWidth || !originalHeight) throw new Error('Could not read dimensions.');
        console.log(`[Simple Preview] Original Dimensions: ${originalWidth}x${originalHeight}`);

        const maxWidth = 800;
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        if (originalWidth > maxWidth) {
            targetWidth = maxWidth;
            targetHeight = Math.round(originalHeight * (maxWidth / originalWidth));
        }

        let processedImageBuffer = imageBuffer;
        if (originalWidth > maxWidth) {
             processedImageBuffer = await sharp(imageBuffer).resize({ width: targetWidth, height: targetHeight, fit: 'inside' }).toBuffer();
        }
        console.log(`[Simple Preview] Final Image Dimensions: ${targetWidth}x${targetHeight}`);

        let overlayText = cleanOverlayText || " ";

        let dynamicFontSize = Math.round(targetWidth * 0.028);
        if (dynamicFontSize < 16) dynamicFontSize = 16;
        if (dynamicFontSize > 36) dynamicFontSize = 36;
        
        const overlayFontSize = dynamicFontSize;
        const overlayCharsPerLine = Math.round(targetWidth / (overlayFontSize * 0.65));
        const overlayLines = wrapText(overlayText, overlayCharsPerLine, 2);
        const escapedOverlayText = overlayLines.map(line => escapeXml(line));
        console.log(`[Simple Preview] Text for overlay:`, escapedOverlayText);

        const lineSpacing = 1.3;
        const padding = Math.round(overlayFontSize * 0.75);
        const textBlockHeight = overlayLines.length * overlayFontSize + (overlayLines.length > 1 ? (overlayLines.length - 1) * overlayFontSize * (lineSpacing - 1) : 0) ;
        const overlayHeight = Math.max(40, textBlockHeight + padding * 2);

        let textTspans = '';
        escapedOverlayText.forEach((line, index) => {
            const dy = index === 0 ? 0 : `${lineSpacing}em`;
            textTspans += `<tspan x="${padding}" dy="${dy}">${line}</tspan>`;
        });

        const textStartY = padding + overlayFontSize;

        const svgOverlay = `<svg width="${targetWidth}" height="${overlayHeight}">
            <rect x="0" y="0" width="${targetWidth}" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            <text y="${textStartY}" style="font-family: Arial, 'Helvetica Neue', sans-serif; font-size: ${overlayFontSize}px; font-weight: 900;" fill="#FFFFFF">
                ${textTspans}
            </text>
        </svg>`;
        console.log(`[Simple Preview] Generated SVG Overlay (${targetWidth}x${overlayHeight}).`);

        console.log(`[Simple Preview] Compositing overlay...`);
        const compositeTop = Math.round(targetHeight - overlayHeight - 10);

        const finalImageBuffer = await sharp(processedImageBuffer)
            .composite([{ input: Buffer.from(svgOverlay), top: compositeTop < 0 ? 0 : compositeTop, left: 0 }])
            .png().toBuffer(); // <-- Convert to buffer
        console.log("[Simple Preview] Image processing complete.");

        // --- Return Buffer ---
        console.log(`[Simple Preview] Success: Returning image buffer.`);
        return finalImageBuffer; // <-- RETURN THE BUFFER

    } catch (error) {
        console.error("--- generateSimplePreviewImage: CATCH BLOCK ENTERED ---");
        console.error("[generateSimplePreviewImage ERROR RAW]", error);
        console.error(`[generateSimplePreviewImage ERROR Message]: ${error.message}`);
        console.log("--- generateSimplePreviewImage: Function END (Error) ---");
        return null; // <-- RETURN NULL ON FAILURE
    }
}
// --- END UPDATED FUNCTION ---


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