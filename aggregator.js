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

const RSS_FEEDS = [
  // --- General News & Major Publications ---
  { name: 'Pitchfork News', url: 'https://pitchfork.com/rss/news/' },
  { name: 'Pitchfork Reviews', url: 'https://pitchfork.com/rss/reviews/albums/' },
  { name: 'Rolling Stone Music', url: 'https://www.rollingstone.com/music/music-news/feed/' },
  { name: 'NME', url: 'https://www.nme.com/feed' },
  { name: 'Billboard', url: 'https://www.billboard.com/feed/' },
  { name: 'Consequence', url: 'https://consequence.net/feed/' },
  { name: 'Spin', url: 'https://www.spin.com/feed/' },
  { name: 'Complex Music', url: 'https://www.complex.com/music/feed' },
  { name: 'Stereogum', url: 'https://www.stereogum.com/feed/' },
  { name: 'Clash Music', url: 'https://www.clashmusic.com/rss' },
  { name: 'NPR Music', url: 'https://www.npr.org/rss/rss.php?id=1039' },
  { name: 'CBC Music', url: 'https://www.cbc.ca/music/rss' },
  { name: 'The Quietus', url: 'https://thequietus.com/rss' },
  { name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed' },
  { name: 'Louder Than War', url: 'https://louderthanwar.com/feed' },

  // --- Music Technology & Production ---
  { name: 'Sound on Sound', url: 'https://www.soundonsound.com/news/sosrssfeed.php' },
  { name: 'SYNTH ANATOMY', url: 'https://synthanatomy.com/feed/' },
  { name: 'Bedroom Producers Blog', url: 'https://bedroomproducersblog.com/feed/' }, // Music production & freeware
  { name: 'FutureMusic', url: 'https://futuremusic.com/rss/' }, // DJ & gear news
  { name: 'Gearnews', url: 'https://www.gearnews.com/feed/' },
  
  // --- Live Concert & Tour Announcements ---
  { name: 'Exclaim! Tour News', url: 'https://exclaim.ca/music/article/category/tour/feed' },
  { name: 'Consequence (Tour)', url: 'https://consequence.net/category/tour/feed/' },
  { name: 'BrooklynVegan (Tour)', url: 'https://www.brooklynvegan.com/category/tour-dates/feed/' },

  // --- Electronic & Dance ---
  { name: 'Resident Advisor', url: 'https://ra.co/news.rss' },
  { name: 'Mixmag', url: 'https://mixmag.net/rss' },
  { name: 'EDM.com', url: 'https://edm.com/.rss/full/' },
  { name: 'Dancing Astronaut', url: 'https://dancingastronaut.com/feed/' },
  
  // --- Hip-Hop & R&B ---
  { name: 'HotNewHipHop', url: 'https://www.hotnewhiphop.com/rss/news.xml' },
  { name: 'HipHopWired', url: 'https://hiphopwired.com/feed/' },
  { name: 'Okayplayer', url: 'https://www.okayplayer.com/feed/' },
  { name: 'This Is RnB', url: 'https://thisisrnb.com/feed/' },

  // --- Rock, Metal & Punk ---
  { name: 'Kerrang!', url: 'https://www.kerrang.com/feed' },
  { name: 'MetalSucks', url: 'https://www.metalsucks.net/feed/' },
  { name: 'Metal Storm', url: 'https://metalstorm.net/events/rss.php' },
  { name: 'Metal Injection', url: 'http://feeds.feedburner.com/metalinjection' },
  { name: 'BrooklynVegan', url: 'https://www.brooklynvegan.com/feed/' }, // Also strong in indie/punk

  // --- Indie, Pop & Alternative ---
  { name: 'Obscure Sound', url: 'https://www.obscuresound.com/feed/' },
  { name: 'The Indie Grid', url: 'https://theindiegrid.co.uk/feed/' },
  { name: 'The Static Dive', url: 'https://staticdive.com/feed/' },
  { name: 'Indie Music Review', url: 'https://indiemusicreview.com/feed/' },
  { name: 'Popjustice', url: 'https://www.popjustice.com/feed/' },
  
  // --- Folk, Country & Americana ---
  { name: 'Folk Radio UK', url: 'https://www.folkradio.co.uk/feed/' },
  { name: 'Saving Country Music', url: 'https://www.savingcountrymusic.com/feed/' },
  { name: 'Americana UK', url: 'https://americana-uk.com/feed' },

  // --- Classical & Jazz ---
  { name: 'Slipped Disc', url: 'https://slippedisc.com/feed/' },
  { name: 'Ludwig van', url: 'https://www.ludwig-van.com/toronto/feed/' },
  { name: 'Classical-Music.com', url: 'https://www.classical-music.com/rss.xml' },
  { name: 'Latin Jazz Network', url: 'https://latinjazznet.com/feed/' },

  // --- World Music ---
  { name: 'Afropop Worldwide', url: 'https://afropop.org/feed' },
  { name:This 'World Music Report', url: 'https://worldmusicreport.com/feed/' },
  { name: 'World Music Network', url: 'https://worldmusic.net/blogs/news.atom' },
  { name: 'NPR Alt.Latino', url: 'https://www.npr.org/rss/rss.php?id=153580552' },
  { name: 'Remezcla Music', url: 'https://remezcla.com/music/feed/' },
  { name: 'Sounds and Colours', url: 'https://soundsandcolours.com/feed/' }, // Latin/World
  { name: 'Yardhype (Reggae/Dancehall)', url: 'https://yardhype.com/feed/' },
  { name: 'World A Reggae', url: 'https://worldareggae.com/feed/' },

  // --- Soundtracks & Scores ---
  { name: 'Film Music Notes', url: 'https://filmmusicnotes.com/feed/' },
  { name: 'Soundtrack.Net', url: 'http://www.soundtrack.net/rss/news/' },
  { name: 'Scoring Sessions', url: 'https://scoringsessions.com/feed/' },
  { name: 'Game Informer (Reviews)', url: 'https://www.gameinformer.com/reviews.xml' }, // Includes sound reviews

  // --- Experimental & Avant-Garde ---
  { name: 'Avant Music News', url: 'https://avantmusicnews.com/feed/' },
  { name: 'Noise Not Music', url: 'https://noisenotmusic.com/feed/' },
  { name: 'A Closer Listen (Experimental)', url: 'https://acloserlisten.com/category/experimental/feed/' },
  { name: 'A Closer Listen (Ambient)', url: 'https://acloserlisten.com/category/ambient/feed/' },
  { name: 'Ambientblog.net', url: 'https://www.ambientblog.net/blog/feed/' },
  { name: 'Disquiet', url: 'https://disquiet.com/feed/' }, // Sound, art, tech
  { name: 'Brainwashed', url: 'https://www.brainwashed.com/feed' },

  // --- New Releases & Discovery ---
  { name: 'NewAlbumReleases.net', url: 'https://newalbumreleases.net/feed/' },
  { name: 'The Ark of Music', url: 'https://thearkofmusic.com/feed/' }
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

