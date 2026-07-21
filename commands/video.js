'use strict';
const yts              = require('yt-search');
const { get }          = require('../lib/gifted');

// Lazy-load ruhend-scraper (installed on user's server, not in Replit env)
let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function ytSearch(input) {
    if (/youtube\.com|youtu\.be/i.test(input)) {
        return { url: input, title: input };
    }
    const { videos } = await yts(input);
    if (!videos?.length) throw new Error('No results: ' + input);
    return { url: videos[0].url, title: videos[0].title };
}

function pickDl(result) {
    if (!result) return null;
    return result.audio || result.download_url || result.video_url || result.url || result.link || null;
}

async function resolveVideoUrl(ytUrl) {
    // Method 1 — ruhend-scraper ytmp4
    try {
        const { ytmp4 } = getScraper();
        const data = await ytmp4(ytUrl);
        const dl   = data?.audio || data?.video || data?.download_url || null;
        if (dl) return { dl, title: data?.title || ytUrl, quality: '720p' };
    } catch { /* fallthrough */ }

    // Method 2 — GiftedTech ytvideo (720p mp4, confirmed working)
    const data = await get('/download/ytvideo', { url: ytUrl }, 120000);
    const dl   = pickDl(data?.result);
    if (!dl) throw new Error('No download URL from ytvideo');
    return { dl, title: data?.result?.title || ytUrl, quality: data?.result?.quality || '720p' };
}

// ─── $ytvideo — YouTube video (720p) as video message ────────────────────────

async function ytvideoCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytvideo\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎬 Usage: $ytvideo <title or YouTube URL>' }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });

        const { dl, title: vtitle, quality } = await resolveVideoUrl(url);

        // Stream via URL — avoids loading 100-500 MB into memory which times out/crashes
        await sock.sendMessage(chatId, {
            video:    { url: dl },
            mimetype: 'video/mp4',
            caption:  `🎬 *${vtitle}*\n📊 ${quality}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[ytvideo]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { ytvideoCommand };
