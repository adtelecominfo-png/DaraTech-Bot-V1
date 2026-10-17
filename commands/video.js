'use strict';
const axios             = require('axios');
const yts               = require('yt-search');
const { get }           = require('../lib/gifted');

// Lazy-load ruhend-scraper (installed on the user's server, not every dev env)
let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

const OMEGA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://api.omegatech.app/',
};

async function ytSearch(input) {
    if (/youtube\.com|youtu\.be/i.test(input)) return { url: input, title: input };
    const { videos } = await yts(input);
    if (!videos?.length) throw new Error('No results: ' + input);
    return { url: videos[0].url, title: videos[0].title };
}

function findDownloadUrl(value, seen = new Set()) {
    if (typeof value === 'string') {
        return /^https?:\/\//i.test(value) && !/youtube\.com|youtu\.be/i.test(value) ? value : null;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    const keys = ['download_url', 'downloadUrl', 'video_url', 'videoUrl', 'download', 'video', 'url', 'link', 'dlink'];
    for (const key of keys) {
        const candidate = value[key];
        if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate) && !/youtube\.com|youtu\.be/i.test(candidate)) return candidate;
    }
    for (const child of Object.values(value)) {
        const found = findDownloadUrl(child, seen);
        if (found) return found;
    }
    return null;
}

function getTitle(value, fallback) {
    if (!value || typeof value !== 'object') return fallback;
    for (const key of ['title', 'name', 'videoTitle']) {
        if (typeof value[key] === 'string' && value[key].trim()) return value[key].trim();
    }
    for (const child of Object.values(value)) {
        if (child && typeof child === 'object') {
            const found = getTitle(child, '');
            if (found) return found;
        }
    }
    return fallback;
}

async function omegaVideo(ytUrl) {
    const endpoint = 'https://api.omegatech.app/api/download/yt-dl';
    const response = await axios.get(endpoint, {
        params: { action: 'download', url: ytUrl, quality: '1080p' },
        headers: OMEGA_HEADERS,
        timeout: 120000,
        maxRedirects: 10,
    });
    const body = response.data;
    const dl = findDownloadUrl(body);
    if (!dl) throw new Error('OmegaTech returned no video URL');
    return { dl, title: getTitle(body, ytUrl), quality: '1080p' };
}

async function resolveVideoUrl(ytUrl) {
    // Primary provider requested by the bot owner.
    try { return await omegaVideo(ytUrl); } catch (err) {
        console.warn('[ytvideo] OmegaTech failed:', err.message);
    }

    // Fallback 1 — ruhend-scraper ytmp4.
    try {
        const { ytmp4 } = getScraper();
        const data = await ytmp4(ytUrl);
        const dl = data?.audio || data?.video || data?.download_url || data?.url || null;
        if (dl) return { dl, title: data?.title || ytUrl, quality: '720p' };
    } catch { /* fall through */ }

    // Fallback 2 — GiftedTech ytvideo.
    const data = await get('/download/ytvideo', { url: ytUrl }, 120000);
    const dl = findDownloadUrl(data?.result || data);
    if (!dl) throw new Error('All video endpoints returned no download URL');
    return { dl, title: getTitle(data?.result || data, ytUrl), quality: data?.result?.quality || '720p' };
}

async function ytvideoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytvideo\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎬 Usage: $ytvideo <title or YouTube URL>' }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });
        const { dl, title: vtitle, quality } = await resolveVideoUrl(url);

        await sock.sendMessage(chatId, {
            video: { url: dl },
            mimetype: 'video/mp4',
            caption: `🎬 *${vtitle}*\n📊 ${quality}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[ytvideo]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { ytvideoCommand };
