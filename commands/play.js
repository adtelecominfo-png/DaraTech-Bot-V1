'use strict';
const yts              = require('yt-search');
const { get }          = require('../lib/gifted');
const { toOgg, toBuffer } = require('../lib/media');

// Lazy-load ruhend-scraper (not in Replit env but installed on user's server)
let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function ytSearch(input) {
    if (/youtube\.com|youtu\.be/i.test(input)) {
        return { url: input, title: input, thumbnail: null, duration: '', author: '', views: '' };
    }
    const { videos } = await yts(input);
    if (!videos?.length) throw new Error('No results: ' + input);
    const v = videos[0];
    return {
        url:       v.url,
        title:     v.title,
        thumbnail: v.thumbnail || v.image || null,
        duration:  v.timestamp || '',
        author:    v.author?.name || '',
        views:     v.views ? Number(v.views).toLocaleString() : '',
    };
}

/** Extract download URL from any result shape */
function pickDl(result) {
    if (!result) return null;
    return result.audio
        || result.download_url
        || result.audio_url
        || result.url
        || result.link
        || result.mp3
        || null;
}

async function sendBanner(sock, chatId, message, meta, action) {
    const caption = [
        `🎵 *${meta.title}*`,
        meta.author   ? `👤 ${meta.author}`      : '',
        meta.duration ? `⏱️ ${meta.duration}`    : '',
        meta.views    ? `👁️ ${meta.views} views` : '',
        '',
        `⬇️ _${action}_`,
    ].filter(Boolean).join('\n');

    if (meta.thumbnail) {
        try {
            return await sock.sendMessage(chatId,
                { image: { url: meta.thumbnail }, caption },
                { quoted: message });
        } catch { /* fallthrough */ }
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

/**
 * Download audio URL → convert to OGG/OPUS → send as audio bubble.
 * Falls back to sending as MP3 document if ffmpeg is unavailable.
 */
async function sendAudio(sock, chatId, message, dlUrl, title) {
    const mp3Buf = await toBuffer(dlUrl);
    const oggBuf = await toOgg(mp3Buf);

    if (oggBuf) {
        await sock.sendMessage(chatId, {
            audio:    oggBuf,
            mimetype: 'audio/ogg; codecs=opus',
            ptt:      false,
        }, { quoted: message });
    } else {
        // ffmpeg unavailable — send as document so user can still download it
        await sock.sendMessage(chatId, {
            document: mp3Buf,
            mimetype: 'audio/mpeg',
            fileName: `${title || 'audio'}.mp3`,
        }, { quoted: message });
    }
}

// ─── $play — YouTube audio ────────────────────────────────────────────────────

async function playCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$play\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $play <song name or YouTube URL>' }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');

        let dl    = null;
        let title = meta.title;

        // Method 1 — ruhend-scraper ytmp3
        try {
            const { ytmp3 } = getScraper();
            const data = await ytmp3(meta.url);
            dl    = data?.audio || data?.download_url || null;
            title = data?.title || title;
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech endpoints
        if (!dl) {
            const endpoints = [
                () => get('/download/ytaudio',     { url: meta.url }, 90000),
                () => get('/download/ytmp3',       { url: meta.url, quality: '128kbps' }, 90000),
                () => get('/download/savetubemp3', { url: meta.url }, 90000),
            ];
            for (const endpoint of endpoints) {
                try {
                    const data = await endpoint();
                    const url  = pickDl(data?.result);
                    if (!url) continue;
                    title = data?.result?.title || title;
                    dl    = url;
                    break;
                } catch { /* try next */ }
            }
        }

        if (!dl) throw new Error('All endpoints failed');
        await sendAudio(sock, chatId, message, dl, title);
    } catch (err) {
        console.error('[play]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

// ─── $play2 — SaveTube MP3 with ytmp3 fallback ───────────────────────────────

async function play2Command(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$play2\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: $play2 <song name or YouTube URL>',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading via SaveTube…');

        let dl    = null;
        let title = meta.title;

        // Method 1 — ruhend-scraper ytmp3
        try {
            const { ytmp3 } = getScraper();
            const data = await ytmp3(meta.url);
            dl    = data?.audio || data?.download_url || null;
            title = data?.title || title;
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech endpoints
        if (!dl) {
            const endpoints = [
                () => get('/download/savetubemp3', { url: meta.url }, 90000),
                () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
                () => get('/download/ytaudio',     { url: meta.url }, 90000),
            ];
            for (const endpoint of endpoints) {
                try {
                    const data = await endpoint();
                    const url  = pickDl(data?.result);
                    if (!url) continue;
                    title = data?.result?.title || title;
                    dl    = url;
                    break;
                } catch { /* try next */ }
            }
        }

        if (!dl) throw new Error('All endpoints failed');
        await sendAudio(sock, chatId, message, dl, title);
    } catch (err) {
        console.error('[play2]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try $play instead.' }, { quoted: message });
    }
}

// ─── $playdoc — YouTube audio sent as MP3 document ───────────────────────────

async function playDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$playdoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: $playdoc <song name or YouTube URL>',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');

        let dl    = null;
        let title = meta.title;

        // Method 1 — ruhend-scraper ytmp3
        try {
            const { ytmp3 } = getScraper();
            const data = await ytmp3(meta.url);
            dl    = data?.audio || data?.download_url || null;
            title = data?.title || title;
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech endpoints
        if (!dl) {
            const endpoints = [
                () => get('/download/savetubemp3', { url: meta.url }, 90000),
                () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
                () => get('/download/ytaudio',     { url: meta.url }, 90000),
            ];
            for (const endpoint of endpoints) {
                try {
                    const data = await endpoint();
                    const url  = pickDl(data?.result);
                    if (!url) continue;
                    title = data?.result?.title || title;
                    dl    = url;
                    break;
                } catch { /* try next */ }
            }
        }

        if (!dl) throw new Error('All endpoints failed');

        // Document — always MP3, no ffmpeg needed
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
        }, { quoted: message });
    } catch (err) {
        console.error('[playdoc]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio file download failed. Try again.' }, { quoted: message });
    }
}

// ─── $playch — 320kbps high-quality audio ────────────────────────────────────

async function playChCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$playch\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: $playch <song name or YouTube URL>',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading 320kbps audio…');

        let dl    = null;
        let title = meta.title;

        // Method 1 — ruhend-scraper ytmp3
        try {
            const { ytmp3 } = getScraper();
            const data = await ytmp3(meta.url);
            dl    = data?.audio || data?.download_url || null;
            title = data?.title || title;
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech endpoints (320kbps first)
        if (!dl) {
            const endpoints = [
                () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
                () => get('/download/savetubemp3', { url: meta.url }, 90000),
                () => get('/download/ytaudio',     { url: meta.url }, 90000),
            ];
            for (const endpoint of endpoints) {
                try {
                    const data = await endpoint();
                    const url  = pickDl(data?.result);
                    if (!url) continue;
                    title = data?.result?.title || title;
                    dl    = url;
                    break;
                } catch { /* try next */ }
            }
        }

        if (!dl) throw new Error('All endpoints failed');
        await sendAudio(sock, chatId, message, dl, title);
    } catch (err) {
        console.error('[playch]', err.message);
        await sock.sendMessage(chatId, { text: '❌ High-quality audio download failed. Try $play instead.' }, { quoted: message });
    }
}

module.exports = { playCommand, play2Command, playDocCommand, playChCommand };
