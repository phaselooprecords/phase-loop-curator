// curator.js (NEW REFACTORED VERSION)

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

// !!! THIS IS THE FIX FOR THE KEY BUG !!!
// A Gemini Key is NOT a Google Search Key. You need a separate key for Google Search.
// curator.js

// --- Keep these lines at the top ---
require('dotenv').config();
// IMPORT THE CORRECT CONSTRUCTOR NAME

// ... (rest of imports: path, sharp, fs, fetch)

// --- API CLIENTS SETUP (REVISED) ---

const { google } = require('googleapis');

// !!! REVISED AI CLIENT INITIALIZATION !!!
let genAI; // Declare variable
try {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing from environment variables.");
    }
    // Instantiate inside a try block
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); 
    console.log("[AI Setup] GoogleGenerativeAI client initialized successfully."); // Add log
} catch (error) {
    console.error("[AI Setup ERROR] Failed to initialize GoogleGenerativeAI:", error);
    // If initialization fails, set genAI to null or handle appropriately
    // This prevents the generateAiText function from crashing immediately if setup failed.
    genAI = null; 
}

const customsearch = google.customsearch('v1'); 
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY; 
const GOOGLE_SEARCH_CX = process.env.GOOGLE_SEARCH_CX;

// --- CORE FUNCTION 1: GENERATE AI TEXT ---
async function generateAiText(article) {
    // Add a check here in case initialization failed
    if (!genAI) {
        throw new Error("AI Client not initialized. Check GEMINI_API_KEY and server logs.");
    }
    
    const prompt = `
        You are a content curator for "Phase Loop Records," focused on deep, technical electronic/rock music news.
        TASK: Synthesize the news based on the title. Generate:
        1. HEADLINE (5-7 words, bold, technical style).
        2. SHORT DESCRIPTION (max 40 words).
        3. SOCIAL MEDIA CAPTION (max 100 words). Include #PhaseLoopRecords and mention source (${article.source}).
        NEWS TITLE: "${article.title}"
        FORMAT RESPONSE STRICTLY AS JSON: { "headline": "...", "description": "...", "caption": "..." }`;
    try {
        // Use the genAI instance 
        const aiModel = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash", 
            generationConfig: { responseMimeType: "application/json" }
        });
        
        const result = await aiModel.generateContent(prompt);
        const response = result.response;
        
        if (!response || !response.candidates || !response.candidates[0].content || !response.candidates[0].content.parts || !response.candidates[0].content.parts[0].text) {
             throw new Error("Invalid AI API response structure.");
        }
        
        const jsonText = response.candidates[0].content.parts[0].text;
        
        const aiContent = JSON.parse(jsonText.trim());
        console.log(`[AI] Successfully generated content for: ${article.title}`);
        aiContent.originalSource = article.source;
        return aiContent;

    } catch (error) { 
        console.error("[AI ERROR]", error); 
        throw new Error(`AI Text Failed: ${error.message}`); 
    }
}

// --- CORE FUNCTION 2: SEARCH FOR IMAGES ---
async function searchForRelevantImages(title, source) {
    const query = `${title} ${source}`;
    console.log(`[Image Search] Searching for: ${query}`);
    try {
        if (!GOOGLE_SEARCH_CX || !GOOGLE_API_KEY) { 
            throw new Error("Google Search CX or API Key missing in environment."); 
        }
        const response = await customsearch.cse.list({ 
            auth: GOOGLE_API_KEY, 
            cx: GOOGLE_SEARCH_CX, 
            q: query, 
            searchType: 'image', 
            num: 9, 
            safe: 'high' 
        });
        if (!response.data.items || response.data.items.length === 0) { 
            throw new Error('No images found.'); 
        }
        const imageUrls = response.data.items.map(item => item.link);
        console.log(`[Image Search] Found ${imageUrls.length} URLs.`);
        return imageUrls;
    } catch (error) { 
        console.error(`[Image Search ERROR]`, error.message); 
        // Send a specific error back to the frontend
        throw new Error(`Image Search Failed: ${error.message}`);
    }
}

// --- CORE FUNCTION 3: FIND RELATED ARTICLES (Placeholder) ---
// Your server.js calls this, but you don't have the code for it.
// This will just return an empty array so it doesn't crash.
async function findRelatedWebArticles(title, source) {
    console.log(`[Related Articles] Search skipped (function not implemented): ${title}`);
    return []; // Return an empty array to prevent errors
}

// --- CORE FUNCTION 4: GENERATE SIMPLE PREVIEW IMAGE ---
async function generateSimplePreviewImage(imageUrl, headline, description) {
    console.log(`[Simple Preview] Starting preview for: ${imageUrl}`);
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const imageBuffer = await response.buffer();
        const firstSentence = description.split(/[.!?]/)[0] + '.';
        const cleanedHeadline = headline.replace(/^\*\*|\*\*$/g, '');

        const overlayHeight = 90;
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
        console.error(`[Simple Preview ERROR]`, error.message);
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
