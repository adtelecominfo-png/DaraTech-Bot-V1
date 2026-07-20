'use strict';
const yts                  = require('yt-search');
const { get }              = require('../lib/gifted');
const { toBuffer }         = require('../lib/media');

// Lazy-load ruhend-scraper (not in Replit env but installed on user's server)
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
    return result.audio
        || result.download_url
        || result.video_url
        || result.url
        || result.link
        || null;
}

/**
 * Download a YouTube video URL.
 * Primary: ruhend-scraper ytmp4
 * Fallback: GiftedTech ytvideo (720p)
 */
async function fetchYtVideo(ytUrl) {
    // Method 1 — ruhend-scraper ytmp4
    try {
        const { ytmp4 } = getScraper();
        const data = await ytmp4(ytUrl);
        const dl   = data?.audio || data?.video || data?.download_url || null;
        if (dl) return { dl, title: data?.title || ytUrl, quality: '720p' };
    } catch { /* fallthrough */ }

    // Method 2 — GiftedTech ytvideo (confirmed working, 720p mp4)
    const data = await get('/download/ytvideo', { url: ytUrl }, 120000);
    const dl   = pickDl(data?.result);
    if (!dl) throw new Error('No download URL from ytvideo');
    return { dl, title: data?.result?.title || ytUrl, quality: data?.result?.quality || '720p' };
}

// ─── $video / $ytmp4 — YouTube video (720p) ──────────────────────────────────

async function videoCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$(video|ytmp4)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎬 Usage: $video <title or YouTube URL>' }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });

        const { dl, title: vtitle, quality } = await fetchYtVideo(url);
        const buf = await toBuffer(dl);

        await sock.sendMessage(chatId, {
            video:    buf,
            mimetype: 'video/mp4',
            caption:  `🎬 *${vtitle}*\n📊 ${quality}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[video]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

// ─── $video2 / $savetube — alias ─────────────────────────────────────────────

async function video2Command(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$(video2|savetube)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: $video2 <title or YouTube URL>',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });

        const { dl, title: vtitle, quality } = await fetchYtVideo(url);
        const buf = await toBuffer(dl);

        await sock.sendMessage(chatId, {
            video:    buf,
            mimetype: 'video/mp4',
            caption:  `🎬 *${vtitle}*\n📊 ${quality}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[video2]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try $video instead.' }, { quoted: message });
    }
}

// ─── $videodoc — YouTube video as downloadable document ──────────────────────

async function videoDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$videodoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: $videodoc <title or YouTube URL>',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Preparing video file:* ${title}…` }, { quoted: message });

        const { dl, title: vtitle } = await fetchYtVideo(url);
        const buf = await toBuffer(dl);

        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'video/mp4',
            fileName: `${vtitle}.mp4`,
        }, { quoted: message });
    } catch (err) {
        console.error('[videodoc]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video file download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { videoCommand, video2Command, videoDocCommand };
