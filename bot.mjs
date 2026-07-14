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
let dynamicCobaltApis = [];
let dynamicYoutubeApis = [];
let dynamicInstagramApis = [];
const COBALT_API_URL = process.env.COBALT_API_URL || 'https://my-private-cobalt.onrender.com/';

// Helper to aggressively strip tracking query parameters
function sanitizeUrl(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        parsed.search = '';
        return parsed.toString();
    } catch {
        return url.split('?')[0].trim();
    }
}

// Function to generate random residential-like headers and fake client IP to bypass blocklists
function getSpoofedHeaders() {
    const randomIp = Array.from({ length: 4 }, () => Math.floor(Math.random() * 255)).join('.');
    return {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Safari";v="604"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"iOS"',
        'X-Forwarded-For': randomIp,
        'X-Real-IP': randomIp,
        'Client-IP': randomIp,
        'Referer': 'https://www.google.com/'
    };
}

// Fetch active Cobalt APIs dynamically from cobalt.directory to bypass dead mirrors
async function fetchActiveCobaltApis() {
    try {
        console.log('🔄 Fetching latest active Cobalt APIs from directory...');
        const res = await axios.get('https://cobalt.directory/api/working?type=api', {
            timeout: 5000,
            headers: getSpoofedHeaders()
        });
        const apis = res.data?.data?.Frontend || [];
        if (apis.length > 0) {
            dynamicCobaltApis = apis.map(api => api.endsWith('/') ? api : api + '/');
            console.log(`📡 Discovered ${dynamicCobaltApis.length} dynamic Cobalt APIs.`);
        }
        const youtubeApis = res.data?.data?.youtube || res.data?.data?.['youtube-shorts'] || [];
        if (youtubeApis.length > 0) {
            dynamicYoutubeApis = youtubeApis.map(api => api.endsWith('/') ? api : api + '/');
            console.log(`📡 Discovered ${dynamicYoutubeApis.length} dynamic YouTube-specific Cobalt APIs.`);
        }
        const instagramApis = res.data?.data?.instagram || [];
        if (instagramApis.length > 0) {
            dynamicInstagramApis = instagramApis.map(api => api.endsWith('/') ? api : api + '/');
            console.log(`📡 Discovered ${dynamicInstagramApis.length} dynamic Instagram-specific Cobalt APIs.`);
        }
    } catch (err) {
        console.warn('⚠️ Failed to fetch dynamic Cobalt instances. Will use default fallbacks.', err.message);
    }
}

// Fetch dynamic apis at startup
fetchActiveCobaltApis();

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
    console.log(`🚀 Requesting TikTok Downloader for: ${tiktokUrl}`);
    
    // 1. Try TikWM first (stable placeholder)
    try {
        const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({
            url: tiktokUrl,
            hd: '1'
        }), {
            headers: {
                ...getSpoofedHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            timeout: 15000
        });

        const result = response.data;
        if (result.code === 0 && result.data && result.data.play) {
            return {
                videoUrl: result.data.play,
                title: result.data.title || 'TikTok Video'
            };
        }
    } catch (err) {
        console.warn(`TikWM failed: ${err.message}. Trying fallback API...`);
    }

    // 2. Try tiklydown keyless API as a fallback
    try {
        const response = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(tiktokUrl)}`, {
            headers: getSpoofedHeaders(),
            timeout: 10000
        });
        const videoUrl = response.data?.video?.noWatermark || response.data?.video?.watermark;
        if (videoUrl) {
            console.log(`✅ TikTok extraction via Tiklydown successful!`);
            return {
                videoUrl,
                title: response.data?.title || 'TikTok Video'
            };
        }
    } catch (err) {
        console.error(`TikTok Tiklydown fallback failed:`, err.message);
    }

    throw new Error('Unable to extract TikTok video. Link may be private or downloader is rate-limited.');
}

// Helper to retrieve the top 5 comments for a TikTok video
export async function getTikTokComments(tiktokUrl) {
    try {
        const response = await axios.post('https://www.tikwm.com/api/comment/list', new URLSearchParams({
            url: tiktokUrl
        }), {
            headers: {
                ...getSpoofedHeaders(),
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            timeout: 8000
        });

        if (response.data && response.data.code === 0 && response.data.data && response.data.data.comments) {
            return response.data.data.comments.slice(0, 5).map(c => ({
                author: c.user?.nickname || c.user?.unique_id || 'User',
                text: c.text
            }));
        }
    } catch (err) {
        console.warn('Failed to retrieve TikTok comments:', err.message);
    }
    return [];
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
                ...getSpoofedHeaders(),
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        const videoUrl = findVideoUrlInJSON(response.data);
        if (videoUrl) {
            console.log(`✅ Instagram extraction via mediadl.app successful!`);
            return { videoUrl, title: 'Instagram Reel' };
        }
    } catch (err) {
        console.warn(`Instagram mediadl.app failed: ${err.message}. Trying alternative proxies...`);
    }

    // 2. Try api.vanyydownloader.com/api/v1/ as requested by user
    try {
        const response = await axios.post('https://api.vanyydownloader.com/api/v1/media', {
            url: instagramUrl
        }, {
            headers: {
                ...getSpoofedHeaders(),
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        const videoUrl = findVideoUrlInJSON(response.data);
        if (videoUrl) {
            console.log(`✅ Instagram extraction via Vanyy successful!`);
            return { videoUrl, title: 'Instagram Reel' };
        }
    } catch (err) {
        console.warn(`Instagram Vanyy failed: ${err.message}. Trying Cobalt fallbacks...`);
    }

    // 3. Fallback to list of Cobalt instances (prioritizing custom COBALT_API_URL)
    const fallbackList = [];
    if (COBALT_API_URL) fallbackList.push(COBALT_API_URL);
    
    if (dynamicInstagramApis.length > 0) {
        fallbackList.push(...dynamicInstagramApis);
    } else {
        // Fallback to verified public Cobalt mirrors that support Instagram extraction
        fallbackList.push(
            'https://dog.kittycat.boo/',
            'https://cobaltapi.cjs.nz/',
            'https://api.qwkuns.me/',
            'https://cobalt.omega.wolfy.love/',
            'https://nuko-c.meowing.de/',
            'https://nachos.imput.net/',
            'https://api-cobalt.eversiege.network/'
        );
    }

    for (const cobaltUrl of fallbackList) {
        try {
            console.log(`Trying Cobalt fallback for Instagram: ${cobaltUrl}`);
            const isPrivateInstance = cobaltUrl === COBALT_API_URL;
            const response = await axios.post(cobaltUrl, {
                url: instagramUrl
            }, {
                headers: {
                    ...getSpoofedHeaders(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: isPrivateInstance ? 30000 : 8000
            });

            if (response.data) {
                if (response.data.url) {
                    const status = response.data.status || 'stream';
                    console.log(`✅ Instagram extraction via Cobalt (${cobaltUrl}) successful! [Status: ${status}]`);
                    return { videoUrl: response.data.url, title: 'Instagram Reel' };
                } else if (response.data.status === 'picker' || response.data.picker) {
                    console.log(`✅ Instagram carousel extraction via Cobalt (${cobaltUrl}) successful!`);
                    return { picker: response.data.picker, title: 'Instagram Carousel' };
                }
            }
        } catch (err) {
            console.warn(`Cobalt Instagram instance ${cobaltUrl} failed.`);
        }
    }

    throw new Error('Unable to extract Instagram video. All public downloader proxies are currently blocked or offline.');
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
                ...getSpoofedHeaders(),
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });

        if (response.data) {
            if (response.data.url) {
                const status = response.data.status || 'stream';
                console.log(`✅ YouTube extraction via Cobalt v7 API successful! [Status: ${status}]`);
                return { videoUrl: response.data.url, title: 'YouTube Shorts' };
            } else if (response.data.status === 'picker' || response.data.picker) {
                console.log(`✅ YouTube playlist extraction via Cobalt v7 API successful!`);
                return { picker: response.data.picker, title: 'YouTube Playlist' };
            }
        }
    } catch (err) {
        console.warn(`Cobalt v7 API failed/shutdown: ${err.message}. Trying v10 layout and fallbacks...`);
    }

    // 2. Try v10 layout on the fallback list of Cobalt instances
    // Exclude the private Cobalt instance for YouTube because proxy/scraping restrictions on Render result in 0-byte downloads.
    const fallbackList = [];
    fallbackList.push('https://subito-c.meowing.de/'); // Prioritize stable public instance recommended by user
    
    if (dynamicYoutubeApis.length > 0) {
        fallbackList.push(...dynamicYoutubeApis);
    } else {
        // Fallback to verified public Cobalt mirrors that support YouTube extraction
        fallbackList.push(
            'https://api.qwkuns.me/',
            'https://cobalt.omega.wolfy.love/',
            'https://api.cobalt.liubquanti.click/',
            'https://nuko-c.meowing.de/',
            'https://api-cobalt.eversiege.network/'
        );
    }

    for (const cobaltUrl of fallbackList) {
        try {
            console.log(`Trying Cobalt v10 layout on: ${cobaltUrl}`);
            const response = await axios.post(cobaltUrl, {
                url: youtubeUrl,
                videoQuality: '720'
            }, {
                headers: {
                    ...getSpoofedHeaders(),
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 8000
            });

            if (response.data) {
                if (response.data.url) {
                    const status = response.data.status || 'stream';
                    console.log(`✅ YouTube extraction via Cobalt v10 (${cobaltUrl}) successful! [Status: ${status}]`);
                    return { videoUrl: response.data.url, title: 'YouTube Shorts' };
                } else if (response.data.status === 'picker' || response.data.picker) {
                    console.log(`✅ YouTube playlist extraction via Cobalt v10 (${cobaltUrl}) successful!`);
                    return { picker: response.data.picker, title: 'YouTube Playlist' };
                }
            }
        } catch (err) {
            console.warn(`Cobalt YouTube instance ${cobaltUrl} failed.`);
        }
    }

    throw new Error('Unable to extract YouTube video. All public Cobalt proxies are blocked. Consider hosting your own instance and setting COBALT_API_URL.');
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
            detectedUrl = sanitizeUrl(text.match(TIKTOK_REGEX)[0]);
            platform = 'tiktok';
        } else if (INSTAGRAM_REGEX.test(text)) {
            detectedUrl = sanitizeUrl(text.match(INSTAGRAM_REGEX)[0]);
            platform = 'instagram';
        } else if (YOUTUBE_REGEX.test(text)) {
            detectedUrl = sanitizeUrl(text.match(YOUTUBE_REGEX)[0]);
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

            if (extractionResult.picker && Array.isArray(extractionResult.picker)) {
                const totalItems = extractionResult.picker.length;
                console.log(`📦 Carousel/Slides detected: ${totalItems} items.`);
                
                // Update the status message to show it is a carousel/picker
                if (statusKey) {
                    try {
                        await sock.sendMessage(remoteJid, {
                            edit: statusKey,
                            text: `⏳ Processing carousel: Downloading 0 of ${totalItems} items...`
                        });
                    } catch (editErr) {
                        console.warn('Failed to edit status message:', editErr);
                    }
                }

                let processedCount = 0;
                for (let i = 0; i < totalItems; i++) {
                    const item = extractionResult.picker[i];
                    if (!item.url) continue;

                    try {
                        console.log(`Downloading item ${i + 1}/${totalItems} (${item.type})...`);
                        const itemStreamRes = await axios.get(item.url, {
                            responseType: 'arraybuffer',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
                            },
                            timeout: 30000
                        });
                        const itemBuffer = Buffer.from(itemStreamRes.data);
                        const sizeInMB = itemBuffer.length / (1024 * 1024);
                        console.log(`📦 Downloaded item size: ${sizeInMB.toFixed(2)} MB`);

                        if (sizeInMB > 64) {
                            console.warn(`Item ${i + 1} is too large (${sizeInMB.toFixed(2)} MB). Skipping.`);
                            continue;
                        }

                        let caption = `Slide ${i + 1} of ${totalItems}`;
                        caption += `\n\n> <Ahmed is a Web Dev/>`;

                        if (item.type === 'video') {
                            await sock.sendMessage(remoteJid, {
                                video: itemBuffer,
                                caption: caption,
                                mimetype: 'video/mp4'
                            }, { quoted: msg });
                        } else {
                            // Default to photo/image for anything else (e.g. photo or gif)
                            await sock.sendMessage(remoteJid, {
                                image: itemBuffer,
                                caption: caption,
                                mimetype: 'image/jpeg'
                            }, { quoted: msg });
                        }

                        processedCount++;
                        if (statusKey) {
                            try {
                                await sock.sendMessage(remoteJid, {
                                    edit: statusKey,
                                    text: `⏳ Processing carousel: Downloading ${processedCount} of ${totalItems} items...`
                                });
                            } catch (editErr) {
                                console.warn('Failed to edit status message:', editErr);
                            }
                        }
                    } catch (itemErr) {
                        console.error(`Failed to process carousel item ${i + 1}:`, itemErr.message);
                    }
                }

                // Delete status message at the end
                if (statusKey) {
                    try {
                        await sock.sendMessage(remoteJid, { delete: statusKey });
                    } catch (delErr) {
                        console.warn('Failed to delete status message:', delErr);
                    }
                }

                console.log(`📤 Carousel sent successfully to ${remoteJid}`);
                return;
            }

            const { videoUrl, title } = extractionResult;

            // Download the video binary stream
            console.log('Downloading video bytes...');
            const videoStreamRes = await axios.get(videoUrl, {
                responseType: 'arraybuffer',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
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
            /*
            if (statusKey) {
                try {
                    await sock.sendMessage(remoteJid, { delete: statusKey });
                } catch (delErr) {
                    console.warn('Failed to delete status message:', delErr);
                }
            }
            */

            // Build the final video caption
            let finalCaption = '';
            
            const isGeneric = !title || [
                'youtube shorts', 
                'instagram reel', 
                'tiktok video', 
                'extracted video', 
                'video'
            ].includes(title.toLowerCase().trim());

            if (!isGeneric) {
                finalCaption += title;
            }

            // Append signature
            finalCaption += `${finalCaption ? '\n\n' : ''}> <Ahmed is a Web Dev/>`;

            // Send the video back to the user with the constructed caption
            await sock.sendMessage(remoteJid, {
                video: videoBuffer,
                caption: finalCaption,
                mimetype: 'video/mp4'
            }, { quoted: msg });

            // Send top comments separately if it's TikTok
            /*
            if (platform === 'tiktok') {
                try {
                    const comments = await getTikTokComments(detectedUrl);
                    if (comments && comments.length > 0) {
                        const commentsFormatted = comments.map((c, i) => `${i + 1}. *${c.author}*: ${c.text}`).join('\n');
                        const commentsMsg = `💬 *Top Comments:*\n\n${commentsFormatted}`;
                        await sock.sendMessage(remoteJid, { text: commentsMsg }, { quoted: msg });
                    }
                } catch (cErr) {
                    console.warn('Failed to retrieve or send comments during messaging:', cErr.message);
                }
            }
            */

            console.log(`📤 Video sent successfully to ${remoteJid}`);

        } catch (error) {
            console.error('❌ Error processing video:', error.message);

            // Clean up the status message
            /*
            if (statusKey) {
                try {
                    await sock.sendMessage(remoteJid, { delete: statusKey });
                } catch (delErr) {
                    console.warn('Failed to delete status message on error:', delErr);
                }
            }
            */

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
