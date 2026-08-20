import { getTikTokVideo, getInstagramVideo, getYoutubeVideo, getXVideo, getFacebookVideo, getSnapchatVideo } from './bot.mjs';

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
    const rawUrl = "https://vt.tiktok.com/ZSVDwo2Qd/";
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
    console.log(`[TEST 2] Testing Instagram Extractor for: ${url}`);
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

async function testX() {
    const rawUrl = 'https://x.com/SpaceX/status/1815197737521570188';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST 3] Testing X (Twitter) Extractor for: ${url}`);
    try {
        const result = await getXVideo(url);
        if (!result || (!result.videoUrl && !result.picker)) throw new Error("No video URL returned");
        console.log('✅ X Extraction Success!');
        console.log('Title:', result.title);
        if (result.videoUrl) console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ X Extraction Result:', err.message);
    }
}

async function testFacebook() {
    const rawUrl = 'https://www.facebook.com/watch/?v=10159234857416729';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST 4] Testing Facebook Extractor for: ${url}`);
    try {
        const result = await getFacebookVideo(url);
        if (!result || !result.videoUrl) throw new Error("No video URL returned");
        console.log('✅ Facebook Extraction Success!');
        console.log('Title:', result.title);
        console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ Facebook Extraction Result:', err.message);
    }
}

async function testSnapchat() {
    const rawUrl = 'https://story.snapchat.com/p/9d2c676d-14a5-48b4-933e-e6a9829f049a';
    const url = sanitizeUrl(rawUrl);

    console.log(`\n---------------------------------------`);
    console.log(`[TEST 5] Testing Snapchat Extractor for: ${url}`);
    try {
        const result = await getSnapchatVideo(url);
        if (!result || !result.videoUrl) throw new Error("No video URL returned");
        console.log('✅ Snapchat Extraction Success!');
        console.log('Title:', result.title);
        console.log('Video URL:', result.videoUrl.substring(0, 80) + '...');
    } catch (err) {
        console.error('❌ Snapchat Extraction Result:', err.message);
    }
}

async function run() {
    console.log('🚀 Running Universal Downloader Tests (TikTok, Instagram, YouTube, X, Facebook, Snapchat)...\n');
    await testTikTok();
    await testTikTokShort();
    await testInstagram();
    await testX();
    await testFacebook();
    await testSnapchat();
    console.log(`\n=======================================\n`);
}

run();