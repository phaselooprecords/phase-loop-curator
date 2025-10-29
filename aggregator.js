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

// --- RSS FEED CONFIGURATION ---

const RSS_FEEDS_MASTER = [
  // --- 📰 Top-Level World & US News ---
  { name: 'Reuters - Top News', url: 'http://feeds.reuters.com/reuters/topNews' },
  { name: 'Reuters - World News', url: 'http://feeds.reuters.com/Reuters/worldNews' },
  { name: 'Associated Press - Top News', url: 'https://apnews.com/rss' },
  { name: 'BBC News - World', url: 'http://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'New York Times - Home Page', url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml' },
  { name: 'The Guardian - World', url: 'https://www.theguardian.com/world/rss' },
  { name: 'NPR - News', url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'Al Jazeera - English', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { name: 'ABC News - Top Stories', url: 'https://abcnews.go.com/abcnews/topstories' },
  { name: 'NBC News - Top Stories', url: 'http://feeds.nbcnews.com/nbcnews/public/news' },
  { name: 'CBS News - Main', url: 'https://www.cbsnews.com/latest/rss/main' },
  { name: 'LA Times - Top News', url: 'https://www.latimes.com/world-nation/rss2.0.xml' },

  // --- 🌍 International & Regional News ---
  { name: 'Deutsche Welle (DW) - All', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { name: 'Le Monde - International (English)', url: 'https://www.lemonde.fr/en/international/rss_full.xml' },
  { name: 'Times of India - Top Stories', url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'BBC News - Asia', url: 'http://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { name: 'BBC News - Europe', url: 'http://feeds.bbci.co.uk/news/world/europe/rss.xml' },
  { name: 'Axios - World', url: 'https://api.axios.com/feed/world' },
  { name: 'Foreign Policy', url: 'https://foreignpolicy.com/feed/' },

  // --- 🏛️ Politics & Policy ---
  { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml' },
  { name: 'The Hill', url: 'https://thehill.com/rss/syndicator/19109' },
  { name: 'NPR - Politics', url: 'https://feeds.npr.org/1014/rss.xml' },
  { name: 'New York Times - Politics', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml' },

  // --- 💼 Business & Finance ---
  { name: 'Wall Street Journal - Business', url: 'https://feeds.a.dj.com/rss/WSJcomUSBusiness.xml' },
  { name: 'The Economist - Business', url: 'https://www.economist.com/business/rss.xml' },
  { name: 'Financial Times - Home (UK)', url: 'https://www.ft.com/rss/home/uk' },
  { name: 'Bloomberg - Top News', url: 'https://feeds.bloomberg.com/windows/rss.xml' },
  { name: 'CNBC - Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'Harvard Business Review', url: 'https://hbr.org/feed' },
  { name: 'Forbes', url: 'https://www.forbes.com/rss/' },
  { name: 'MarketWatch - Top Stories', url: 'http://feeds.marketwatch.com/marketwatch/topstories/' },

  // --- 💻 Technology (General) ---
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Ars Technica', url: 'http://feeds.arstechnica.com/arstechnica/index' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
  { name: 'ZDNet', url: 'https://www.zdnet.com/feed/' },
  { name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Techmeme', url: 'https://www.techmeme.com/feed.xml' },

  // --- 🤖 AI & Cybersecurity ---
  { name: 'Google AI Blog', url: 'https://research.google/blog/rss/' },
  { name: 'The Hacker News', url: 'http://feeds.feedburner.com/TheHackersNews' },
  { name: 'Krebs on Security', url: 'https://krebsonsecurity.com/feed/' },
  { name: 'Schneier on Security', url: 'https://www.schneier.com/feed/atom/' },
  { name: 'Dark Reading', url: 'https://www.darkreading.com/rss_simple.asp' },
  { name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/' },

  // --- 🔬 Science & Space ---
  { name: 'NASA - Breaking News', url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss' },
  { name: 'Nature', url: 'https://www.nature.com/nature.rss' },
  { name: 'Scientific American', url: 'https://www.scientificamerican.com/feed/rss.cfm' },
  { name: 'ScienceDaily', url: 'http://feeds.sciencedaily.com/sciencedaily' },
  { name: 'Quanta Magazine', url: 'https://api.quantamagazine.org/feed/' },
  { name: 'Space.com', url: 'https://www.space.com/feeds/all' },

  // --- 🩺 Health & Medicine ---
  { name: 'World Health Org. (WHO) News', url: 'https://www.who.int/rss-feeds/news-rss.xml' },
  { name: 'STAT News', url: 'https://www.statnews.com/feed/' },
  { name: 'MedPage Today', url: 'https://www.medpagetoday.com/rss/headlines.xml' },
  { name: 'NPR - Health', url: 'https://feeds.npr.org/1007/rss.xml' },
  { name: 'New York Times - Health', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Health.xml' },

  // --- 🌿 Environment & Climate ---
  { name: 'Grist', url: 'https://grist.org/feed/' },
  { name: 'NatGeo - Environment', url: 'https://www.nationalgeographic.com/environment/rss-feed' },
  { name: 'Inside Climate News', url: 'https://insideclimatenews.org/feed/' },
  { name: 'The Guardian - Environment', url: 'https://www.theguardian.com/environment/rss' },

  // --- 🤔 Culture, Opinion & Long-form ---
  { name: 'The Atlantic', url: 'https://www.theatlantic.com/feed/all/' },
  { name: 'The New Yorker', url: 'https://www.newyorker.com/feed/everything' },
  { name: 'Aeon', url: 'https://aeon.co/feed.rss' },
  { name: 'NYT - Opinion', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Opinion.xml' },
  { name: 'The Guardian - Opinion', url: 'https://www.theguardian.com/commentisfree/rss' },
  { name: 'Paris Review Daily', url: 'https://www.theparisreview.org/blog/feed' },

  // --- 🎬 Entertainment & Fandom ---
  { name: 'Variety', url: 'https://variety.com/feed/' },
  { name: 'The Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
  { name: 'Vulture', url: 'https://www.vulture.com/feed.xml' },
  { name: 'Deadline', url: 'https://deadline.com/feed/' },
  { name: 'Comic Book Resources (CBR)', url: 'https://www.cbr.com/feed/' },
  { name: 'The Mary Sue', url: 'https://www.themarysue.com/feed/' },

  // --- 🎨 Creative: Art & Photography ---
  { name: 'Colossal (Art)', url: 'http://feeds.feedburner.com/colossal' },
  { name: 'Hyperallergic', url: 'https://hyperallergic.com/feed/' },
  { name: 'PetaPixel (Photography)', url: 'https://petapixel.com/feed/' },
  { name: 'Booooooom', url: 'https://www.booooooom.com/feed/' },

  // --- 🏠 Creative: Design & Architecture ---
  { name: 'Dezeen', url: 'http://feeds.feedburner.com/dezeen' },
  { name: 'ArchDaily', url: 'http://feeds.archdaily.com/archdaily' },
  { name: 'designboom', url: 'https://www.designboom.com/feed/' },
  { name: 'Swissmiss', url: 'https://www.swiss-miss.com/feed' },
  { name: 'Dwell', url: 'https://www.dwell.com/feed/rss' },
  { name: 'Curbed', url: 'https://www.curbed.com/rss/index.xml' },
  
  // --- 👟 Creative: Fashion & Style ---
  { name: 'Vogue', url: 'https://www.vogue.com/feed/rss' },
  { name: 'Business of Fashion (BoF)', url: 'https://www.businessoffashion.com/rss/daily' },
  { name: 'Hypebeast', url: 'https://hypebeast.com/feed' },
  { name: 'GQ - Style', url: 'https://www.gq.com/feed/style/rss' },

  // --- 🍔 Hobbies: Food & Cooking ---
  { name: 'Eater (All)', url: 'https://www.eater.com/rss/index.xml' },
  { name: 'Bon Appétit', url: 'https://www.bonappetit.com/feed/rss' },
  { name: 'Smitten Kitchen', url: 'http://feeds.feedburner.com/SmittenKitchen' },
  { name: 'Serious Eats', url: 'https://www.seriouseats.com/feeds/2.0/atom' },
  { name: 'NYT - Food', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Food.xml' },
  { name: 'The Kitchn', url: 'https://www.thekitchn.com/feed' },
  { name: 'Food52', url: 'https://food52.com/blog.rss' },

  // --- 🎮 Hobbies: Video Games ---
  { name: 'Kotaku', url: 'https://kotaku.com/rss' },
  { name: 'IGN', url: 'http://feeds.ign.com/ign/all' },
  { name: 'Rock Paper Shotgun', url: 'http://feeds.rockpapershotgun.com/RockPaperShotgun' },
  { name: 'Game Rant', url: 'httpsag'https://gamerant.com/feed/' },
  { name: 'GameSpot - All News', url: 'https://www.gamespot.com/feeds/news/' },
  { name: 'Polygon', url: 'https://www.polygon.com/rss/index.xml' },

  // --- ⚽ Hobbies: Sports ---
  { name: 'ESPN', url: 'https://www.espn.com/espn/rss/news' },
  { name: 'BBC Sport', url: 'http://feeds.bbci.co.uk/sport/rss.xml' },
  { name: 'SB Nation', url: 'https:ag'https://www.sbnation.com/rss/index.xml' },
  { name: 'The Athletic', url: 'https://theathletic.com/rss/' },

  // --- ✈️ Hobbies: Travel ---
  { name: 'Condé Nast Traveler', url: 'https://www.cntraveler.com/rss' },
  { name: 'NatGeo - Travel', url: 'https://www.nationalgeographic.com/travel/rss-feed' },
  { name: 'NYT - Travel', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Travel.xml' },
  { name: 'Atlas Obscura', url: 'https://www.atlasobscura.com/feed' },

  // --- 🚗 Hobbies: Automotive ---
  { name: 'Autoblog', url: 'https://www.autoblog.com/rss.xml' },
  { name: 'Top Gear', url: 'https://www.topgear.com/rss' },
  { name: 'Jalopnik', url: 'https://jalopnik.com/rss' },

  // --- 📚 Intellectual: History, Philosophy, Literature ---
  { name: 'History Today', url: 'https://www.historytoday.com/feed' },
  { name: 'Daily Stoic', url: 'https://dailystoic.com/feed/' },
  { name: 'Poetry Foundation', url: 'https://www.poetryfoundation.org/feed' },
  { name: 'Smithsonian Magazine', url: 'https://www.smithsonianmag.com/rss/latest/' },
  { name: 'Literary Hub (LitHub)', url: 'https://lithub.com/feed/' },
  
  // --- 💡 Lifestyle & Productivity ---
  { name: 'Lifehacker', url: 'https://lifehacker.com/rss' },
  { name: 'Fast Company', url: 'https://www.fastcompany.com/rss' },
  { name: 'WIRED - Ideas', url: 'https://www.wired.com/feed/category/ideas/latest/rss' },
  { name: 'Apartment Therapy', url: 'https://www.apartmenttherapy.com/feed' },

  // --- 🕵️ Investigative & Fact-Checking ---
  { name: 'ProPublica', url: 'http://feeds.propublica.org/propublica/main' },
  { name: 'PolitiFact', url: 'https://www.politifact.com/rss/' },
  { name: 'Snopes', url: 'https://www.snopes.com/feed/' },
  { name: 'The Intercept', url: 'https://theintercept.com/feed/?lang=en' },

  // --- 🎙️ Popular Podcasts (as Feeds) ---
  { name: '99% Invisible', url: 'http://feeds.99percentinvisible.org/99percentinvisible' },
  { name: 'This American Life', url: 'http://feeds.thisamericanlife.org/talpodcast' },
  { name: 'Radiolab', url: 'http://feeds.wnyc.org/radiolab' },
  { name: 'Freakonomics Radio', url: 'http://feeds.feedburner.com/freakonomicsradio' },
  { nameD:'Stuff You Should Know', url: 'https://feeds.megaphone.fm/stuffyoushouldknow' }
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

