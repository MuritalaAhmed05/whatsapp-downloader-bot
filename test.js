import { getTikTokVideo, getInstagramVideo, getYoutubeVideo } from './bot.mjs';

// Helper to sanitize links so tracking tags don't break the scrapers
function sanitizeUrl(url) {
    return url.split('?')[0].trim();
}

async function testTikTok() {
    const rawUrl = "https://www.tiktok.com/@lifeofenoma/video/7674269132832967956?is_from_webapp=1&sender_device=pc";
    const url = sanitizeUrl(rawUrl);
    
    console.log(`\n---------------------------------------`);
    console.log(`[TEST 1] Testing TikTok Extractor for: ${url}`);
    try {
        const result = await getTikTokVideo(url);
        if (!result || (!result.videoUrl && !result.picker)) throw new Error("No video URL or picker returned");
        console.log('✅ TikTok Extraction Success!');
        console.log('Title:', result.title);
        if (result.videoUrl) console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
        if (result.picker) console.log('Picker items:', result.picker.length);
    } catch (err) {
        console.error('❌ TikTok Extraction Failed:', err.message);
    }
}

async function testTikTokShort() {
    const rawUrl = "https://vt.tiktok.com/ZSV2eHtYw/";
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST 1b] Testing TikTok Short URL Extractor for: ${url}`);
    try {
        const result = await getTikTokVideo(url);
        if (!result || (!result.videoUrl && !result.picker)) throw new Error("No video URL or picker returned");
        console.log('✅ TikTok Short Link Extraction Success!');
        console.log('Title:', result.title);
        if (result.videoUrl) console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
        if (result.picker) console.log('Picker items:', result.picker.length);
    } catch (err) {
        console.error('❌ TikTok Short Link Extraction Failed:', err.message);
    }
}

async function testInstagram() {
    const rawUrl = 'Https://www.instagram.com/reel/DY4AltIAqU6/?igsh=MWNoeGZjOHkxN3h6bg==';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST] Testing Instagram Extractor for: ${url}`);
    try {
        const result = await getInstagramVideo(url);
        if (!result || !result.videoUrl) throw new Error("No video URL returned");
        console.log('✅ Instagram Extraction Success!');
        console.log('Title:', result.title);
        console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ Instagram Extraction Failed:', err.message);
    }
}

async function testYoutube() {
    const rawUrl = 'https://youtube.com/shorts/70hhbU0U_f4?si=ux3RtLPqTtcA2Rvd';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST] Testing YouTube Extractor for: ${url}`);
    try {
        const result = await getYoutubeVideo(url);
        if (!result || !result.videoUrl) throw new Error("No video URL returned");
        console.log('✅ YouTube Extraction Success!');
        console.log('Title:', result.title);
        console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ YouTube Extraction Failed:', err.message);
    }
}

async function testInstagramCarousel() {
    // Set custom API URL to ensure we hit the private working Cobalt instance
    process.env.COBALT_API_URL = 'https://my-private-cobalt.onrender.com/';
    const rawUrl = 'https://www.instagram.com/p/DajHquUD5Gb';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST] Testing Instagram Carousel Extractor for: ${url}`);
    try {
        const result = await getInstagramVideo(url);
        if (result && result.picker) {
            console.log('✅ Instagram Carousel Extraction Success!');
            console.log('Title:', result.title);
            console.log('Total Items Found:', result.picker.length);
            result.picker.forEach((item, idx) => {
                console.log(`  [${idx + 1}] Type: ${item.type}, URL: ${item.url ? item.url.substring(0, 50) + '...' : 'none'}`);
            });
        } else if (result && result.videoUrl) {
            console.log('✅ Instagram Reel Extraction (Single video returned instead of picker) Success!');
            console.log('Title:', result.title);
            console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
        } else {
            throw new Error("No video URL or picker list returned");
        }
    } catch (err) {
        console.error('❌ Instagram Carousel Extraction Failed:', err.message);
    }
}

async function run() {
    console.log('🚀 Running Universal Downloader Tests...\n');
    await testTikTok();
    await testTikTokShort();
    await testInstagram();
    await testYoutube();
    await testInstagramCarousel();
    console.log(`\n=======================================\n`);
}

run();