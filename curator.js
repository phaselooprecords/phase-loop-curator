// curator.js (Ensuring exports are at the end)

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
        if ((currentLine + word).length > maxCharsPerLine && currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine += word + ' ';
        }
    });
    lines.push(currentLine.trim());
    return lines.slice(0, 2);
}


// --- API FUNCTION 1: GENERATE AI TEXT ---
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

// --- API FUNCTION 2: EXTRACT SEARCH KEYWORDS (*** RESPONSE ACCESS FIXED ***) ---
async function extractSearchKeywords(headline, description) {
    console.log(`[AI Keywords] Extracting keywords from: "${headline}" / "${description}"`);
    const inputText = `Headline: ${headline}\nDescription: ${description}`;
    const prompt = `
        Analyze the following text about a music news item. Identify the main subject(s) (artist, event, topic).
        Based ONLY on the main subject(s), provide the BEST concise keyword phrase (max 4 words) suitable for a Google Image Search to find relevant photos of that subject.
        Examples: ...
        TEXT TO ANALYZE: "${inputText}"
        OUTPUT ONLY the keyword phrase.`;

    try {
        const generationResult = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        console.log("[AI Keywords] Received response from Gemini.");

        // --- *** CORRECTED ACCESS PATH *** ---
        let keywords = null;
        try {
            if (generationResult &&
                generationResult.candidates &&
                generationResult.candidates.length > 0 &&
                generationResult.candidates[0].content &&
                generationResult.candidates[0].content.parts &&
                generationResult.candidates[0].content.parts.length > 0 &&
                typeof generationResult.candidates[0].content.parts[0].text === 'string'
            ) {
                 keywords = generationResult.candidates[0].content.parts[0].text.trim().replace(/[\*\"]/g, '');
            } else {
                 console.error("[AI Keywords ERROR] Unexpected Gemini response structure:", JSON.stringify(generationResult, null, 2));
                 throw new Error("Unexpected Gemini response structure for keywords.");
            }
        } catch (accessError) {
              console.error("[AI Keywords ERROR] Error accessing nested keyword response text:", accessError);
              throw new Error("Error processing Gemini keyword response structure.");
         }
         // --- *** END CORRECTION *** ---

        console.log(`[AI Keywords] Extracted Keywords: "${keywords}"`);
        if (!keywords || keywords.toLowerCase().includes('cannot fulfill')) {
            console.warn('[AI Keywords] Extraction failed or returned invalid keywords.');
            return null;
        }
        return keywords;
    } catch (error) {
        console.error("[AI Keywords CATCH BLOCK ERROR]", error.message);
        return null;
    }
}

// --- API FUNCTION 3: GET ALTERNATIVE KEYWORDS (*** RESPONSE ACCESS FIXED ***) ---
async function getAlternativeKeywords(headline, description, previousKeywords = []) {
    const inputText = `Headline: ${headline}\nDescription: ${description}`;
    const previousKeywordsString = previousKeywords.length > 0
        ? `The user has already tried searching with: ${previousKeywords.map(kw => `"${kw}"`).join(', ')}.`
        : "This is the first request for alternative keywords.";
    console.log(`[AI AltKeywords] Requesting alternative keywords, avoiding: ${previousKeywordsString}`);
    const prompt = `
        Analyze the following music news headline and description: "${inputText}"
        ${previousKeywordsString}
        The user needs a DIFFERENT, concise keyword phrase (max 4 words) suitable for a Google Image Search...
        OUTPUT ONLY the new alternative keyword phrase. Do not include quotation marks.`;

    try {
        const generationResult = await ai.models.generateContent({ model, contents: [{ role: 'user', parts: [{ text: prompt }] }] });
        console.log("[AI AltKeywords] Received response from Gemini.");

        // --- *** CORRECTED ACCESS PATH *** ---
        let newKeywords = null;
        try {
            if (generationResult &&
                generationResult.candidates &&
                generationResult.candidates.length > 0 &&
                generationResult.candidates[0].content &&
                generationResult.candidates[0].content.parts &&
                generationResult.candidates[0].content.parts.length > 0 &&
                typeof generationResult.candidates[0].content.parts[0].text === 'string'
            ) {
                   newKeywords = generationResult.candidates[0].content.parts[0].text.trim().replace(/[\*\"]/g, '');
              } else {
                  console.error("[AI AltKeywords ERROR] Unexpected Gemini response structure:", JSON.stringify(generationResult, null, 2));
                  throw new Error("Unexpected Gemini response structure for alt keywords.");
              }
          } catch (accessError) {
               console.error("[AI AltKeywords ERROR] Error accessing nested alt keyword response text:", accessError);
               throw new Error("Error processing Gemini alt keyword response structure.");
          }
          // --- *** END CORRECTION *** ---

        console.log(`[AI AltKeywords] Raw Extracted Text: "${newKeywords}"`); // Log before validation

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

// --- API FUNCTION 4: SEARCH FOR IMAGES (RETURN DIMENSIONS) ---
async function searchForRelevantImages(query, startIndex = 0) {
    console.log(`[Image Search] Searching for: "${query}" starting at index ${startIndex}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const apiStartIndex = startIndex + 1;
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, searchType: 'image', num: 9, start: apiStartIndex, safe: 'high', imgType: 'photo', imgSize: 'medium' });

        if (!response.data.items || response.data.items.length === 0) {
             // ... (no results handling - unchanged) ...
             if (startIndex === 0) { throw new Error('No images found.'); } else { console.log(`[Image Search] No more images found.`); return []; }
        }

        // Map results to include dimensions
        const imagesData = response.data.items.map(item => ({
            imageUrl: item.link,
            contextUrl: item.image?.contextLink,
            query: query,
            // *** ADD DIMENSIONS ***
            width: item.image?.width,
            height: item.image?.height
            // *** END ADD ***
        }));

        console.log(`[Image Search] Found ${imagesData.length} images.`);
        return imagesData; // Now returns { imageUrl, contextUrl, query, width, height }

    } catch (error) {
        console.error(`[Image Search ERROR]`, error.message);
        return [];
    }
}

// --- API FUNCTION 5: FIND RELATED WEB ARTICLES ---
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

// --- API FUNCTION 6: FIND RELATED VIDEO ---
async function findRelatedVideo(title, source) {
    const query = `${title} ${source} video`;
    console.log(`[Video Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { throw new Error("Google Search CX or API Key missing."); }
        const response = await customsearch.cse.list({ auth: GOOGLE_API_KEY, cx: GOOGLE_SEARCH_CX, q: query, num: 1 });
        if (response.data.items && response.data.items.length > 0) { const firstResult = response.data.items[0]; if (firstResult.link && (firstResult.link.includes('youtube.com/watch') || firstResult.link.includes('youtu.be/') || firstResult.link.includes('vimeo.com/'))) { console.log(`[Video Search] Found video: ${firstResult.link}`); return firstResult.link; } else { console.log(`[Video Search] Top result not video link: ${firstResult.link}`); } }
        else { console.log('[Video Search] No video results.'); }
        return null;
    } catch (error) { console.error(`[Video Search ERROR]`, error.message); return null; }
}

// --- *** UPDATED UTILITY FUNCTION: GENERATE PREVIEW IMAGE *** ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview generation.`);
    console.log(`[Simple Preview] Image URL: ${imageUrl}`);
    console.log(`[Simple Preview] Raw Headline:`, headline);
    console.log(`[Simple Preview] Raw Description:`, description);

    try {
        if (!imageUrl || typeof imageUrl !== 'string') { throw new Error('Invalid imageUrl'); }
        const headlineText = typeof headline === 'string' ? headline : '';
        const descText = typeof description === 'string' ? description : '';

        console.log(`[Simple Preview] Fetching image: ${imageUrl}`);
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        console.log(`[Simple Preview] Image fetched.`);

        // --- Get Original Dimensions ---
        const metadata = await sharp(imageBuffer).metadata();
        const originalWidth = metadata.width;
        const originalHeight = metadata.height;
        if (!originalWidth || !originalHeight) {
             throw new Error('Could not read image dimensions.');
         }
        console.log(`[Simple Preview] Original Dimensions: ${originalWidth}x${originalHeight}`);

        // --- Determine Target Dimensions (Max Width 800px, No Upscaling) ---
        const maxWidth = 800;
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;

        if (originalWidth > maxWidth) {
            targetWidth = maxWidth;
            // Calculate height based on aspect ratio
            targetHeight = Math.round(originalHeight * (maxWidth / originalWidth));
            console.log(`[Simple Preview] Resizing down to: ${targetWidth}x${targetHeight}`);
        } else {
            console.log(`[Simple Preview] Using original size (smaller than max width).`);
        }

        // --- Resize Image Buffer (Only if necessary) ---
        let processedImageBuffer = imageBuffer; // Start with original
        if (originalWidth > maxWidth) {
             processedImageBuffer = await sharp(imageBuffer)
                .resize({
                    width: targetWidth,
                    height: targetHeight,
                    fit: 'inside' // Ensures no upscaling, maintains aspect ratio
                })
                .toBuffer();
             console.log(`[Simple Preview] Image resized.`);
        }

        // --- Text Preparation (Adjust wrapping based on targetWidth) ---
        // Estimate characters per line based on width (adjust multiplier as needed)
        const headlineCharsPerLine = Math.round(targetWidth / 20); // Approx 20px per char avg for large font
        const sentenceCharsPerLine = Math.round(targetWidth / 10); // Approx 10px per char avg for smaller font

        const cleanedHeadlineRaw = headlineText.replace(/^\*\*|\*\*$/g, '').trim();
        const headlineLines = wrapText(cleanedHeadlineRaw, headlineCharsPerLine);
        const escapedHeadlineLines = headlineLines.map(line => escapeXml(line));

        const firstSentenceRaw = descText.split(/[.!?]/)[0];
        const fullFirstSentence = firstSentenceRaw ? firstSentenceRaw.trim() + '.' : '';
        const sentenceLines = wrapText(fullFirstSentence, sentenceCharsPerLine);
        const escapedSentenceLines = sentenceLines.map(line => escapeXml(line));
        console.log("[Simple Preview] Text prepared, wrapped, and escaped.");

        // --- Dynamic SVG Generation ---
        const headlineFontSize = 20; // Keep desired font size
        const sentenceFontSize = 12;
        const lineSpacing = 1.2;
        const textBlockSpacing = 10;
        const padding = 10;

        // Calculate needed height
        const headlineHeight = escapedHeadlineLines.length * headlineFontSize + (escapedHeadlineLines.length > 1 ? (escapedHeadlineLines.length - 1) * headlineFontSize * (lineSpacing - 1) : 0);
        const sentenceHeight = escapedSentenceLines.length * sentenceFontSize + (escapedSentenceLines.length > 1 ? (escapedSentenceLines.length - 1) * sentenceFontSize * (lineSpacing - 1) : 0);
        const totalTextHeight = headlineHeight + sentenceHeight + textBlockSpacing;
        const overlayHeight = Math.max(110, totalTextHeight + padding * 2); // Dynamic height

        // Generate TSPANs (same logic)
        let headlineTspans = ''; escapedHeadlineLines.forEach((line, index) => { const dy = index === 0 ? 0 : `${lineSpacing}em`; headlineTspans += `<tspan x="${padding}" dy="${dy}">${line}</tspan>`; });
        let sentenceTspans = ''; escapedSentenceLines.forEach((line, index) => { const dy = index === 0 ? 0 : `${lineSpacing}em`; sentenceTspans += `<tspan x="${padding}" dy="${dy}">${line}</tspan>`; });

        // Calculate Y positions (same logic)
        const headlineStartY = padding + headlineFontSize;
        const sentenceStartY = headlineStartY + headlineHeight + textBlockSpacing;

        // Create SVG with dynamic width
        const svgOverlay = `<svg width="${targetWidth}" height="${overlayHeight}">
            <rect x="0" y="0" width="${targetWidth}" height="${overlayHeight}" fill="#000000" opacity="0.7"/>
            <text y="${headlineStartY}" style="font-family: 'Arial Black', Gadget, sans-serif; font-size: ${headlineFontSize}px; font-weight: 900;" fill="#FFFFFF">
                ${headlineTspans}
            </text>
            <text y="${sentenceStartY}" style="font-family: Arial, sans-serif; font-size: ${sentenceFontSize}px;" fill="#DDDDDD">
                ${sentenceTspans}
            </text>
        </svg>`;
        console.log(`[Simple Preview] Generated SVG Overlay (${targetWidth}x${overlayHeight}).`);

        // --- Composite Image ---
        console.log(`[Simple Preview] Compositing overlay...`);
        // Calculate top position based on targetHeight
        const compositeTop = Math.round(targetHeight - overlayHeight - 15); // Position 15px from bottom
        console.log(`[Simple Preview] Target height: ${targetHeight}, Overlay height: ${overlayHeight}, Composite top: ${compositeTop}`);

        const finalImageBuffer = await sharp(processedImageBuffer) // Use the potentially resized buffer
            .composite([{
                input: Buffer.from(svgOverlay),
                top: compositeTop < 0 ? 0 : compositeTop, // Ensure top isn't negative if overlay is tall
                left: 0
            }])
            .png() // Keep outputting as PNG for consistency
            .toBuffer();
        console.log("[Simple Preview] Image processing complete.");

        // --- Save and Return ---
        const filename = `preview_${Date.now()}.png`;
        const imagePath = path.join(process.cwd(), 'public', filename);
        await fs.writeFile(imagePath, finalImageBuffer);
        console.log(`[Simple Preview] Success: Image saved to ${imagePath}`);
        console.log("--- generateSimplePreviewImage: Function END (Success) ---");
        return `/${filename}`;

    } catch (error) {
        console.error("--- generateSimplePreviewImage: CATCH BLOCK ENTERED ---");
        console.error("[generateSimplePreviewImage ERROR RAW]", error);
        console.error(`[generateSimplePreviewImage ERROR Message]: ${error.message}`);
        console.log("--- generateSimplePreviewImage: Function END (Error) ---");
        return '/fallback.png';
    }
}

// --- EXPORTS ---
// Ensure this block is at the VERY END of the file
module.exports = {
    generateAiText,
    extractSearchKeywords,
    getAlternativeKeywords,
    searchForRelevantImages,
    findRelatedWebArticles,
    findRelatedVideo,
    generateSimplePreviewImage
};
