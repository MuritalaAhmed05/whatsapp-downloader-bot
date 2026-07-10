import { getTikTokVideo, getInstagramVideo, getYoutubeVideo } from './bot.mjs';

// Helper to sanitize links so tracking tags don't break the scrapers
function sanitizeUrl(url) {
    return url.split('?')[0].trim();
}

async function testTikTok() {
    const rawUrl = "https://www.tiktok.com/@slimblaqcomedy/video/7660590425069178133?is_from_webapp=1&sender_device=pc";
    const url = sanitizeUrl(rawUrl);
    
    console.log(`\n---------------------------------------`);
    console.log(`[TEST] Testing TikTok Extractor for: ${url}`);
    try {
        const result = await getTikTokVideo(url);
        if (!result || !result.videoUrl) throw new Error("No video URL returned");
        console.log('✅ TikTok Extraction Success!');
        console.log('Title:', result.title);
        console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ TikTok Extraction Failed:', err.message);
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

async function run() {
    console.log('🚀 Running Universal Downloader Tests...\n');
    await testTikTok();
    await testInstagram();
    await testYoutube();
    console.log(`\n=======================================\n`);
}

run();