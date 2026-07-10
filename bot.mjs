import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import axios from 'axios';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import express from 'express';
import { fileURLToPath } from 'url';

// Define the bot's phone number as provided by the user
const BOT_PHONE_NUMBER = '09074940228';

// Regex patterns to detect media URLs
const TIKTOK_REGEX = /https?:\/\/(?:vm|vt|www)\.tiktok\.com\/[a-zA-Z0-9_@\/-]+/i;
const INSTAGRAM_REGEX = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[a-zA-Z0-9_-]+/i;
const YOUTUBE_REGEX = /https?:\/\/(?:www\.)?(?:youtube\.com\/shorts\/[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/i;

let isReconnecting = false;

// Helper to recursively scan a JSON object for keys containing a video URL
function findVideoUrlInJSON(data) {
    if (!data) return null;
    if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://')) && (data.includes('.mp4') || data.includes('cdn') || data.includes('video'))) {
        return data;
    }
    
    // Check common keys directly first
    const commonKeys = ['url', 'videoUrl', 'video_url', 'download', 'downloadUrl', 'link', 'download_link', 'src'];
    for (const key of commonKeys) {
        if (data[key] && typeof data[key] === 'string' && data[key].startsWith('http')) {
            return data[key];
        }
    }
    
    if (typeof data === 'object') {
        for (const key in data) {
            const val = data[key];
            if (val && typeof val === 'object') {
                const found = findVideoUrlInJSON(val);
                if (found) return found;
            } else if (typeof val === 'string' && val.startsWith('http')) {
                // Check if it looks like a media link
                if (val.includes('.mp4') || val.includes('cdn') || val.includes('googlevideo') || val.includes('instagram') || val.includes('fbcdn')) {
                    return val;
                }
            }
        }
    }
    return null;
}

// Extraction Helper: TikTok
export async function getTikTokVideo(tiktokUrl) {
    console.log(`🚀 Requesting TikWM API for: ${tiktokUrl}`);
    const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
        url: tiktokUrl,
        hd: '1'
    }), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });

    const result = response.data;
    if (result.code !== 0 || !result.data || !result.data.play) {
        throw new Error(result.msg || 'Unable to extract watermark-free TikTok video.');
    }

    return {
        videoUrl: result.data.play,
        title: result.data.title || 'TikTok Video'
    };
}

// Extraction Helper: Instagram Reels/Posts
export async function getInstagramVideo(instagramUrl) {
    console.log(`🚀 Requesting Instagram Downloader for: ${instagramUrl}`);
    
    // 1. Try mediadl.app as requested by user
    try {
        const response = await axios.post('https://www.mediadl.app/api/download', {
            url: instagramUrl
        }, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        
        const videoUrl = findVideoUrlInJSON(response.data);
        if (videoUrl) {
            console.log(`✅ Instagram extraction via mediadl.app successful!`);
            return { videoUrl, title: 'Instagram Reel' };
        }
    } catch (err) {
        console.warn(`Instagram mediadl.app failed: ${err.message}. Trying Cobalt fallbacks...`);
    }

    // 2. Try Cobalt API fallback if user configured COBALT_API_URL or try public fallback
    const cobaltUrl = process.env.COBALT_API_URL || 'https://rue-cobalt.xenon.zone/';
    try {
        console.log(`Trying Cobalt fallback for Instagram: ${cobaltUrl}`);
        const response = await axios.post(cobaltUrl, {
            url: instagramUrl
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (response.data && response.data.url) {
            console.log(`✅ Instagram extraction via Cobalt successful!`);
            return { videoUrl: response.data.url, title: 'Instagram Reel' };
        }
    } catch (err) {
        console.error(`Cobalt Instagram fallback failed:`, err.response?.data || err.message);
    }

    throw new Error('Unable to extract Instagram video. The public downloader is currently offline or blocked by Instagram.');
}

// Extraction Helper: YouTube Shorts
export async function getYoutubeVideo(youtubeUrl) {
    console.log(`🚀 Requesting YouTube Downloader for: ${youtubeUrl}`);

    // 1. Try api.cobalt.tools/api/json (v7 api format) as requested by user
    try {
        const response = await axios.post('https://api.cobalt.tools/api/json', {
            url: youtubeUrl,
            vQuality: '720'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (response.data && response.data.url) {
            console.log(`✅ YouTube extraction via Cobalt v7 API successful!`);
            return { videoUrl: response.data.url, title: 'YouTube Shorts' };
        }
    } catch (err) {
        console.warn(`Cobalt v7 API failed/shutdown: ${err.message || err}. Trying v10 layout and fallbacks...`);
    }

    // 2. Try Cobalt v10 layout on the configured COBALT_API_URL or fallbacks
    const cobaltUrl = process.env.COBALT_API_URL || 'https://rue-cobalt.xenon.zone/';
    try {
        console.log(`Trying Cobalt v10 layout on: ${cobaltUrl}`);
        const response = await axios.post(cobaltUrl, {
            url: youtubeUrl,
            videoQuality: '720'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (response.data && response.data.url) {
            console.log(`✅ YouTube extraction via Cobalt v10 successful!`);
            return { videoUrl: response.data.url, title: 'YouTube Shorts' };
        }
    } catch (err) {
        console.error(`Cobalt v10 YouTube fallback failed:`, err.response?.data || err.message);
    }

    throw new Error('Unable to extract YouTube video. The public Cobalt instance is blocked or offline. Please host your own Cobalt instance using Docker and set COBALT_API_URL.');
}

async function startBot() {
    console.log('🤖 Initializing Social Media Downloader Bot...');

    // 1. Setup multi-file authentication state to persist login sessions in 'auth_info' directory
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    // 2. Fetch the latest WhatsApp Web version to avoid handshake / deprecation issues
    let version;
    try {
        const latestVersion = await fetchLatestBaileysVersion();
        version = latestVersion.version;
        console.log(`Using WhatsApp Web version v${version.join('.')}`);
    } catch (err) {
        console.warn('Failed to fetch latest WhatsApp Web version, using default.', err);
        version = [2, 3000, 1015901307]; // Fallback version if fetch fails
    }

    // 3. Initialize the socket connection
    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'warn' }), // Keep the console output clean
        browser: ['Media Downloader Bot', 'macOS', '1.0.0']
    });

    // 4. Save credentials on update
    sock.ev.on('creds.update', saveCreds);

    // 5. Handle connection events (open, closed, reconnecting)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n📸 QR Code generated! Scan this using your WhatsApp app (Linked Devices):');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) 
                ? lastDisconnect.error.output?.statusCode 
                : lastDisconnect?.error?.output?.statusCode;
            
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`❌ Connection closed. Reason status code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                if (!isReconnecting) {
                    isReconnecting = true;
                    console.log('🔄 Re-establishing connection in 5 seconds to prevent spam/corruption...');
                    setTimeout(() => {
                        isReconnecting = false;
                        startBot();
                    }, 5000);
                } else {
                    console.log('⏳ Reconnection attempt already in progress, skipping duplicate call.');
                }
            } else {
                console.log('🚪 Logged out from WhatsApp. Delete the "auth_info" directory to scan a new QR code.');
            }
        } else if (connection === 'open') {
            isReconnecting = false; // Reset flag on successful connection
            console.log('\n✅ WhatsApp connection opened successfully!');
            console.log(`🤖 Bot is active on number: ${BOT_PHONE_NUMBER}`);
        }
    });

    // 6. Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        // Only process new messages
        if (type !== 'notify') return;

        const msg = messages[0];
        // Ignore messages without content, or messages sent by the bot itself
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;

        // Ignore group messages (ensure we reply only to direct messages in DMs)
        if (remoteJid.endsWith('@g.us')) {
            return;
        }

        // Extract message text from conversation, extended text message, or image/video captions
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     msg.message.imageMessage?.caption || 
                     msg.message.videoMessage?.caption;

        if (!text) return;

        let detectedUrl = null;
        let platform = null;

        // Route URL detection by checking domains
        if (TIKTOK_REGEX.test(text)) {
            detectedUrl = text.match(TIKTOK_REGEX)[0];
            platform = 'tiktok';
        } else if (INSTAGRAM_REGEX.test(text)) {
            detectedUrl = text.match(INSTAGRAM_REGEX)[0];
            platform = 'instagram';
        } else if (YOUTUBE_REGEX.test(text)) {
            detectedUrl = text.match(YOUTUBE_REGEX)[0];
            platform = 'youtube';
        }

        if (!detectedUrl || !platform) return;

        console.log(`📥 ${platform.toUpperCase()} URL detected: "${detectedUrl}" from "${remoteJid}"`);

        // Send an initial "Downloading..." feedback message
        let statusKey;
        try {
            const sentStatus = await sock.sendMessage(remoteJid, {
                text: '⏳ Downloading video, please wait...'
            }, { quoted: msg });
            statusKey = sentStatus.key;
        } catch (err) {
            console.error('Failed to send status update message:', err);
        }

        try {
            let extractionResult;
            if (platform === 'tiktok') {
                extractionResult = await getTikTokVideo(detectedUrl);
            } else if (platform === 'instagram') {
                extractionResult = await getInstagramVideo(detectedUrl);
            } else if (platform === 'youtube') {
                extractionResult = await getYoutubeVideo(detectedUrl);
            }

            const { videoUrl, title } = extractionResult;

            // Download the video binary stream
            console.log('Downloading video bytes...');
            const videoStreamRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 30000 // 30 seconds timeout
            });
            const videoBuffer = Buffer.from(videoStreamRes.data);

            // Check file size. WhatsApp standard limit is usually 64MB.
            const sizeInMB = videoBuffer.length / (1024 * 1024);
            console.log(`📦 Downloaded video size: ${sizeInMB.toFixed(2)} MB`);

            if (sizeInMB > 64) {
                throw new Error(`This video is too large to send over WhatsApp (Max 64MB)`);
            }

            // Remove the loading/status message
            if (statusKey) {
                try {
                    await sock.sendMessage(remoteJid, { delete: statusKey });
                } catch (delErr) {
                    console.warn('Failed to delete status message:', delErr);
                }
            }

            // Send the video back to the user with the description/title as caption
            await sock.sendMessage(remoteJid, {
                video: videoBuffer,
                caption: `${title}\n\n🤖 Social Downloader Bot`,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            console.log(`📤 Video sent successfully to ${remoteJid}`);

        } catch (error) {
            console.error('❌ Error processing video:', error.message);

            // Clean up the status message
            if (statusKey) {
                try {
                    await sock.sendMessage(remoteJid, { delete: statusKey });
                } catch (delErr) {
                    console.warn('Failed to delete status message on error:', delErr);
                }
            }

            // Send standard user-friendly warning message back
            const errorText = error.message || 'Server error occurred.';
            await sock.sendMessage(remoteJid, {
                text: `⚠️ *Error Downloader:* ${errorText}\n\nPlease try again or verify if the video link is public.`
            }, { quoted: msg });
        }
    });
}

// Initialize Express server for health checks (prevents cloud hosting from sleeping)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        status: 'alive',
        message: 'Social Media Downloader Bot is running!',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        message: 'Bot is healthy and active.'
    });
});

// Only start the server and bot if this file is run directly
const isMain = process.argv[1] && (process.argv[1] === fileURLToPath(import.meta.url) || process.argv[1].endsWith('bot.mjs'));

if (isMain) {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`📡 Health-check Express server listening on port ${PORT}`);
    });

    startBot().catch(err => {
        console.error('Fatal bot startup error:', err);
    });
}

