// aggregator.js (UPDATED cron pattern)

const Parser = require('rss-parser');
const parser = new Parser({
    customFields: {
      item: [['media:content', 'media:content', {keepArray: false}]],
    }
});
const cron = require('cron');
const db = require('./database');

// --- RSS FEED CONFIGURATION ---
const RSS_FEEDS = [
  // ... (your full list of RSS feeds remains here) ...
  { name: 'Pitchfork News', url: 'https://pitchfork.com/rss/news/' },
  { name: 'Pitchfork Reviews', url: 'https://pitchfork.com/rss/reviews/albums/' },
  { name: 'Resident Advisor', url: 'https://ra.co/news.rss' },
  // ... (etc.)
];

// --- CORE FUNCTION TO FETCH AND SAVE NEWS ---
async function fetchAndProcessNews() {
    console.log(`\n--- Starting news fetch at ${new Date().toLocaleTimeString()} ---`);
    let collectedArticles = [];

    for (const feed of RSS_FEEDS) {
        try {
            let rss = await parser.parseURL(feed.url);
            
            const processedItems = rss.items.map(item => {
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
                    originalImageUrl: originalImageUrl
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
// UPDATED: Changed from every 30 seconds to every 2 hours
const NEWS_CRON_PATTERN = '0 */2 * * *'; 
const newsJob = new cron.CronJob(NEWS_CRON_PATTERN, fetchAndProcessNews, null, false, 'UTC');

// --- EXPORTS ---
module.exports = {
    startScheduler: () => {
        newsJob.start();
        console.log(`[Scheduler] RSS job scheduled to run on pattern: ${NEWS_CRON_PATTERN}`);
        // Run once on startup
        console.log("[Scheduler] Staging initial news fetch in 10 seconds...");
        setTimeout(fetchAndProcessNews, 10000); // 10-second delay
    },
    getNews: db.getAllArticles
};