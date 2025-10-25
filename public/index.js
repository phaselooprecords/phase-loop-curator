<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phase Loop Records Curator</title>
    <style>
        /* Base Styling */
        body { font-family: Arial, sans-serif; background-color: #000000; color: #f0f0f0; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: auto; }
        h1, h2, h3 { color: #ffffff; border-bottom: 2px solid #555; padding-bottom: 10px; text-align: center; margin-bottom: 15px; }
        h3 { border-bottom: none; font-size: 1.1em; }
        .article { background-color: #111111; padding: 15px; margin-bottom: 10px; border-radius: 8px; cursor: pointer; border: 1px solid #333; }
        .article:hover { background-color: #222222; }
        .article h2 { margin-top: 0; font-size: 1.2em; color: #ffffff; border-bottom: none; text-align: left;}
        .article p { font-size: 0.8em; color: #ccc; }

        /* UI State & Image Grid */
        .hidden { display: none; }
        .image-selection-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 10px; }
        .image-selection-grid a { display: block; text-decoration: none; color: #aaa; font-size: 0.7em; text-align: center; }
        .image-selection-grid img { width: 100%; height: 120px; object-fit: cover; cursor: pointer; border: 3px solid transparent; border-radius: 4px; margin-bottom: 5px; }
        .image-selection-grid img:hover { border-color: #555; }

        /* AI Text Preview Styling */
        #ai-text-preview { padding: 15px; background-color: #1a1a1a; margin-bottom: 20px; border-radius: 4px; border: 1px solid #333; }
        #preview-headline { margin-top: 0; color: #FF6B6B; font-size: 1.4em; border-bottom: none; text-align: left;}
        #preview-caption-text { margin-top: 10px; font-style: italic; font-size: 0.9em; border-top: 1px dashed #333; padding-top: 10px; }

        #original-image-container img { width: 100%; max-width: 400px; margin: 10px auto; display: block; border: 2px solid #444; cursor: pointer; }

        /* Button Styling */
        button { padding: 10px 15px; background-color: #007bff; color: white; border: none; cursor: pointer; border-radius: 4px; font-weight: bold; margin-top: 5px; }
        button:hover { background-color: #0056b3; }
        button#refresh-images-btn { background-color: #28a745; margin-left: 10px; }
        button#download-preview-btn { background-color: #17a2b8; margin-right: 10px; }
        button.back-button { background-color: #6c757d; margin-left: 10px;}
        button#share-preview-btn { background-color: #007bff; margin-right: 10px;}


        input[type="text"], textarea { background-color: #1a1a1a; color: white; border: 1px solid #333; width: 98%; padding: 8px; margin-bottom: 15px; }

        /* Simple Preview Styling */
        #simple-preview-image { width: 100%; max-width: 600px; margin: auto; display: block; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>PHASE LOOP RECORDS NEWS FEED</h1>
        <p>Tap a headline to create the social media post.</p>

        <div id="news-list"> Loading news... </div>

        <div id="selection-view" class="hidden">
             <h2>Select Your Post Visual</h2>
             <div id="ai-text-preview">
                 <h3 id="preview-headline"></h3>
                 <p id="preview-description"></p>
                 <p id="preview-caption-text"></p>
             </div>
             <div id="original-image-container" class="hidden">
                 <h3>Original Article Image:</h3>
                 <img id="original-image" src="" alt="Original Article Image" />
             </div>
             <h3>Relevant Web Images: <button id="refresh-images-btn">Refresh</button></h3>
             <div id="image-selection-area" class="image-selection-grid">
                 {/* Images go here */}
             </div>
        </div>

        <div id="simple-preview-view" class="hidden">
            <h2>Quick Preview</h2>
            <img id="simple-preview-image" src="" alt="Simple Preview" />
            <button id="share-preview-btn">Share Post</button>
            <button id="download-preview-btn">Download Image</button>
            <button onclick="setView('select')" class="back-button">Back to Selection</button>
        </div>

    </div>

    <script>
        // Global state
        let currentArticleData = null;
        let currentCuratedData = null;
        let allRelevantImages = [];
        let currentImagePage = 0;
        let simplePreviewImagePath = null;

        document.addEventListener('DOMContentLoaded', () => {
            // Start by fetching the news
            fetchNews(); // <--- Make sure this is called correctly

            // Attach listeners ONLY after DOM is ready
            document.getElementById('refresh-images-btn').onclick = () => { currentImagePage++; showImageSelectionUI(); };
            document.getElementById('download-preview-btn').onclick = () => handleDownload();
            document.getElementById('share-preview-btn').onclick = () => handleShare();
            // Removed listeners for removed buttons (reselect, final preview buttons)
        });

        // --- UI VIEW HANDLERS ---
        function setView(viewId) {
            document.getElementById('news-list').classList.add('hidden');
            document.getElementById('selection-view').classList.add('hidden');
            document.getElementById('simple-preview-view').classList.add('hidden');
            // Removed preview-view handling

            if (viewId === 'list') document.getElementById('news-list').classList.remove('hidden');
            else if (viewId === 'select') document.getElementById('selection-view').classList.remove('hidden');
            else if (viewId === 'simple-preview') document.getElementById('simple-preview-view').classList.remove('hidden');
        }

        // --- STEP 1: Fetch News (with more logging) ---
        async function fetchNews() {
            console.log("fetchNews function started."); // Log: Function start
            const newsListElement = document.getElementById('news-list');
            if (!newsListElement) { console.error("Error: news-list element not found!"); return; }
            newsListElement.innerHTML = 'Loading news...';
            try {
                console.log("Attempting fetch('/api/news')..."); // Log: Before fetch
                const response = await fetch('/api/news');
                console.log("Fetch response received, status:", response.status); // Log: After fetch

                if (!response.ok) {
                    console.error("Fetch response was not OK:", response.status, response.statusText);
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                console.log("Attempting response.json()..."); // Log: Before JSON parsing
                const articles = await response.json();
                console.log(`Successfully parsed ${articles.length} articles.`); // Log: After JSON parsing

                if (!articles || articles.length === 0) {
                    newsListElement.innerHTML = '<p>No news articles found.</p>';
                    console.log("No articles found in response.");
                    return;
                }

                newsListElement.innerHTML = ''; // Clear loading message
                console.log("Cleared loading message, preparing to render articles..."); // Log: Before rendering

                articles.forEach(article => {
                    const articleElement = document.createElement('div');
                    articleElement.className = 'article';
                    articleElement.dataset.link = article.link;
                    articleElement.innerHTML = `<h2>${article.title}</h2><p>Source: ${article.source} | Published: ${new Date(article.pubDate).toLocaleDateString()}</p>`;
                    articleElement.addEventListener('click', () => {
                        console.log("Article clicked:", article.title);
                        handleArticleTap(article);
                    });
                    newsListElement.appendChild(articleElement);
                });
                console.log("Finished rendering articles."); // Log: After rendering

            } catch (error) {
                console.error('!!! Error inside fetchNews:', error); // Log: Catch block error
                newsListElement.innerHTML = '<p style="color: red;">Failed to load news. Check console.</p>';
            }
        }

        // --- STEP 2: Handle Tap & AI Curation ---
        async function handleArticleTap(article) {
             currentArticleData = article;
             alert(`Starting AI curation and image search...`);
             try {
                 const response = await fetch('/api/curate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(article) });
                 currentCuratedData = await response.json();
                 if (currentCuratedData.headline === "AI Generation Failed") { alert('AI text generation FAILED.'); }
                 allRelevantImages = currentCuratedData.images || [];
                 currentImagePage = 0; // Reset page count on new article
                 showImageSelectionUI();
             } catch (error) { console.error('Error during curation API call:', error); alert('Connection error.'); }
         }

        // --- STEP 3: Show Image Selection UI ---
        function showImageSelectionUI() {
            setView('select');
            document.getElementById('preview-headline').innerText = currentCuratedData.headline || "N/A";
            document.getElementById('preview-description').innerText = currentCuratedData.description || "N/A";
            document.getElementById('preview-caption-text').innerText = (currentCuratedData.caption || "Caption N/A") + `\n\nNews Source: ${currentCuratedData.originalSource || 'Unknown'}`;
            const originalImgEl = document.getElementById('original-image');
            const originalImgContainer = document.getElementById('original-image-container');
            if (currentArticleData.originalImageUrl) {
                originalImgEl.src = currentArticleData.originalImageUrl;
                originalImgEl.onclick = () => startSimplePreviewPipeline(currentArticleData.originalImageUrl); // Call Simple Preview
                originalImgContainer.classList.remove('hidden');
            } else { originalImgContainer.classList.add('hidden'); }
            const area = document.getElementById('image-selection-area');
            area.innerHTML = '';
            const startIndex = currentImagePage * 3;
            const imagesToShow = allRelevantImages.slice(startIndex, startIndex + 3);
            if (imagesToShow.length === 0) {
                if (currentImagePage === 0 && allRelevantImages.length === 0) { area.innerHTML = "<p>No relevant images found.</p>"; }
                else { currentImagePage = 0; showImageSelectionUI(); } return;
            }
            imagesToShow.forEach((imageUrl, index) => {
                const container = document.createElement('div');
                const img = document.createElement('img');
                img.src = imageUrl; img.alt = `Relevant Image ${startIndex + index + 1}`;
                img.onerror = function() { this.alt='Image failed'; this.style.border='1px solid red'; };
                img.onclick = () => startSimplePreviewPipeline(imageUrl); // Call Simple Preview
                const link = document.createElement('a');
                link.href = currentArticleData.link; link.textContent = 'View Source Article';
                link.target = '_blank'; link.style.marginTop = '5px';
                container.appendChild(img); container.appendChild(link); area.appendChild(container);
            });
        }

        // --- STEP 3.5: Call Simple Preview API & Show Simple Preview ---
        async function startSimplePreviewPipeline(imageUrl) {
            alert("Generating preview image...");
            const headline = (currentCuratedData.headline || "Headline N/A").replace(/^\*\*|\*\*$/g, '');
            const description = currentCuratedData.description;
            try {
                const response = await fetch('/api/generate-simple-preview', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageUrl, headline, description })
                });
                const previewData = await response.json();
                if (previewData.error || previewData.previewImagePath === '/fallback.png') { alert('Preview Error.'); return; }
                simplePreviewImagePath = previewData.previewImagePath;
                setView('simple-preview');
                document.getElementById('simple-preview-image').src = simplePreviewImagePath + '?' + Date.now();
            } catch (error) { console.error('Error generating simple preview:', error); alert('Connection error.'); }
        }

        // --- Share Button Logic ---
        async function handleShare() {
             if (!simplePreviewImagePath) { alert("No image generated yet."); return; } // Check preview image path
             const finalCaption = (currentCuratedData?.caption || "") + `\n\nImage Credit: ${currentCuratedData?.originalSource || 'Web Search'}`;
             const platform = prompt(/* ... Platform selection ... */);
             if (!platform) return;
             let platformName;
             switch (platform.trim()) { /* ... Case logic ... */ }
             alert(`Attempting to share to ${platformName}... (Check terminal)`);
             try {
                 const response = await fetch('/api/share', { /* ... POST request ... */ });
                 const shareData = await response.json();
                 if (shareData.error) { alert(`Share Failed: ${shareData.error}`); }
                 else { alert(`✅ SUCCESS: ${shareData.message}`); }
             } catch (error) { console.error('Sharing error:', error); alert('Network error during sharing.'); }
         }

        // --- Download Button Logic ---
        function handleDownload() {
            if (!simplePreviewImagePath) { alert("No image generated yet."); return; }
            const link = document.createElement('a');
            link.href = simplePreviewImagePath;
            const cleanedHeadlineText = (currentCuratedData?.headline || 'phaseloop-post').replace(/^\*\*|\*\*$/g, '').replace(/[^a-z0-9]/gi, '_').toLowerCase();
            link.download = `${cleanedHeadlineText}.png`;
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }

    </script>
</body>
</html>
