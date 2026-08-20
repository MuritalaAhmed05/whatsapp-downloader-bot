# Universal Social Media WhatsApp Downloader Bot 🤖

A lightweight automated WhatsApp bot written in Node.js (ES Modules) that detects media links sent to its DM for **TikTok, Instagram, YouTube Shorts, X (Twitter), Facebook, and Snapchat**, extracts watermark-free high-definition video assets and carousels, and replies directly to the sender with the raw `.mp4` / photo assets.

## Supported Platforms & Features
- **TikTok**: Watermark-free videos & photo slideshow carousels via TikWM, TikMate, SSSTik & direct rehydration scrapers.
- **Instagram**: Reels, posts & multi-item photo/video carousels via Cobalt & API proxies.
- **YouTube Shorts**: High-definition shorts & video streams.
- **X (Twitter)**: Single/multi-video tweets & GIFs via VxTwitter, Twitsave & Cobalt.
- **Facebook**: Public reels & watch videos via GetMyFB, direct HTML scraping & Cobalt.
- **Snapchat**: Public Spotlight videos & Stories via Snapchat Web JSON rehydration & Cobalt.
- **Direct Message Isolation**: Ignores group chats, keeping its focus on personal direct messages.
- **Status Updates**: Sends temporary downloading progress indicators that edit/clean up automatically.
- **Size Limits & Safety**: Checks file sizes before sending and enforces WhatsApp limits (64MB).
- **Persistent Sessions**: Sessions are saved locally in the `auth_info` directory.

## Tech Stack
- **Node.js**: ES Modules syntax (`bot.mjs`).
- **@whiskeysockets/baileys**: Modern open-source library for WhatsApp multi-device protocol implementation.
- **Express.js**: Lightweight HTTP framework for health check APIs.
- **axios**: Fast HTTP requests for API querying and media downloading.
- **pino**: Lightweight logging utility.

---

## Installation & Setup

1. **Clone or navigate to the workspace directory**:
   ```bash
   cd tiktok-whatsapp-downloader
   ```

2. **Install all required dependencies**:
   ```bash
   npm install
   ```

3. **Start the Bot**:
   ```bash
   npm start
   ```

4. **Pair the Bot**:
   - The startup script will print a QR code in the terminal.
   - Open WhatsApp on your phone $\rightarrow$ Settings/Menu $\rightarrow$ **Linked Devices** $\rightarrow$ **Link a Device**.
   - Scan the QR code displayed in your terminal.

---

## How It Works

1. Once connected, the bot stays online using your session tokens stored in the `./auth_info` folder.
2. When a user sends a message containing a valid TikTok link (e.g. `https://vm.tiktok.com/XYZ/` or `https://www.tiktok.com/@username/video/1234567890`), the bot catches the link.
3. The bot replies with a downloading status indicator.
4. The bot pulls the watermark-free video from `tikwm.com` and downloads it to temporary buffer memory.
5. The bot deletes the status indicator and sends the video directly as a quoted reply.

---

## Cloud Deployment & Uptime Monitoring

When deploying to a free cloud hosting tier (e.g., Render, Railway, Fly.io) that puts idle containers to sleep, do the following:

1. **Configure Environment Variables**:
   - Expose the port by setting the `PORT` env variable (defaults to `3000` if not set).

2. **Uptime Robot Setup**:
   - Create a free account on [UptimeRobot](https://uptimerobot.com/).
   - Add a new monitor:
     - **Monitor Type**: `HTTP(s)`
     - **Friendly Name**: `TikTok WhatsApp Bot`
     - **URL (or IP)**: `https://your-deployment-url.onrender.com/health` (or `/`)
     - **Monitoring Interval**: Every `5 minutes`
   - This will periodically ping the Express endpoint and ensure the application remains awake 24/7.

---

## Configuration & Notes
- To change the active phone number, scan the QR code with your target WhatsApp account.
- To re-authenticate or log in to a different account, stop the bot, delete the `auth_info` folder, and restart the bot.
