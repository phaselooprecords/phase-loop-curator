// aggregator.js (UPDATED to save original image)

const Parser = require('rss-parser');
// NEW: Configure parser to find media tags
const parser = new Parser({
    customFields: {
      item: [['media:content', 'media:content', {keepArray: false}]],
    }
});
const cron = require('cron');
const db = require('./database');


// aggregator.js (EXPANDED RSS FEEDS)

// --- RSS FEED CONFIGURATION (UPDATED) ---
const RSS_FEEDS = [
    { name: 'Pitchfork News', url: 'https://pitchfork.com/rss/news/' },
    { name: 'Rolling Stone', url: 'https://www.rollingstone.com/feed/' },
    { name: 'NME', url: 'https://www.nme.com/feed' },
    { name: 'Billboard', url: 'https://www.billboard.com/feed/' },
    { name: 'Consequence', url: 'https://consequence.net/feed/' },
    { name: 'Resident Advisor News', url: 'https://ra.co/news/rss' }, // <-- Corrected URL
    { name: 'Mixmag', url: 'https://mixmag.net/rss.xml' }, // <-- Corrected URL
    { name: 'Spin', url: 'https://www.spin.com/feed/' },
    { name: 'Kerrang!', url: 'https://www.kerrang.com/rss' }, // <-- Corrected URL
    { name: 'Complex Music', url: 'https://www.complex.com/feeds/channels/music' } // <-- Corrected URL
];


// --- CORE FUNCTION TO FETCH AND SAVE NEWS ---
async function fetchAndProcessNews() {
    console.log(`\n--- Starting news fetch at ${new Date().toLocaleTimeString()} ---`);
    let collectedArticles = [];

    for (const feed of RSS_FEEDS) {
        try {
            let rss = await parser.parseURL(feed.url);
            
            const processedItems = rss.items.map(item => {
                // --- NEW: Find the original image URL ---
                let originalImageUrl = null;
                if (item.enclosure && item.enclosure.url && item.enclosure.type.startsWith('image')) {
                    originalImageUrl = item.enclosure.url;
                } else if (item['media:content'] && item['media:content'].$.url) {
                    originalImageUrl = item['media:content'].$.url;
                }

                return {
                    source: feed.name,
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
                    originalImageUrl: originalImageUrl // --- NEW: Save to database ---
                };
            }).slice(0, 5); // Get the 5 most recent

            collectedArticles.push(...processedItems);
        } catch (error) {
            console.error(`[ERROR] Failed to fetch feed for ${feed.name}: ${error.message}`);
        }
    }
    
    collectedArticles.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
    
    if (collectedArticles.length > 0) {
        await db.insertArticles(collectedArticles); 
    }
    
    console.log(`Total ${collectedArticles.length} items processed.`);
    console.log('--- News fetch complete ---');

    return collectedArticles;
}

// --- CRON JOB SETUP ---
const NEWS_CRON_PATTERN = '*/30 * * * * *'; // Runs every 30 seconds for testing
const newsJob = new cron.CronJob(NEWS_CRON_PATTERN, fetchAndProcessNews, null, false, 'UTC');

// --- EXPORTS ---
module.exports = {
    startScheduler: () => {
        newsJob.start();
        console.log(`[Scheduler] RSS job scheduled to run on pattern: ${NEWS_CRON_PATTERN}`);
        fetchAndProcessNews(); 
    },
    getNews: db.getAllArticles
};

