'use strict';
const yts   = require('yt-search');
const { get } = require('../lib/gifted');

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

/** Extract download URL from any GiftedTech result shape */
function pickDl(result) {
    if (!result) return null;
    return result.download_url
        || result.audio_url
        || result.url
        || result.link
        || result.mp3
        || result.audio
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

// ─── $play — YouTube audio (ytaudio → ytmp3 fallback) ────────────────────────

async function playCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$play\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $play <song name or YouTube URL>' }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');

        // Increased timeout: audio processing on GiftedTech can take 30–60s
        const endpoints = [
            () => get('/download/ytaudio',    { url: meta.url }, 90000),
            () => get('/download/ytmp3',      { url: meta.url, quality: '128kbps' }, 90000),
            () => get('/download/savetubemp3',{ url: meta.url }, 90000),
        ];

        let dl    = null;
        let title = meta.title;

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

        if (!dl) throw new Error('All endpoints failed');

        // Send via URL — Baileys downloads + re-uploads to WhatsApp CDN
        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
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

        const endpoints = [
            () => get('/download/savetubemp3', { url: meta.url }, 90000),
            () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
            () => get('/download/ytaudio',     { url: meta.url }, 90000),
        ];

        let dl    = null;
        let title = meta.title;

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

        if (!dl) throw new Error('All endpoints failed');

        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
    } catch (err) {
        console.error('[play2]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try $play instead.' }, { quoted: message });
    }
}

// ─── $playdoc — YouTube audio sent as document file ──────────────────────────

async function playDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$playdoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: $playdoc <song name or YouTube URL>',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');

        const endpoints = [
            () => get('/download/savetubemp3', { url: meta.url }, 90000),
            () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
            () => get('/download/ytaudio',     { url: meta.url }, 90000),
        ];

        let dl    = null;
        let title = meta.title;

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

        if (!dl) throw new Error('All endpoints failed');

        await sock.sendMessage(chatId, {
            document: { url: dl },
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

        const endpoints = [
            () => get('/download/ytmp3',       { url: meta.url, quality: '320kbps' }, 90000),
            () => get('/download/savetubemp3', { url: meta.url }, 90000),
            () => get('/download/ytaudio',     { url: meta.url }, 90000),
        ];

        let dl    = null;
        let title = meta.title;

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

        if (!dl) throw new Error('All endpoints failed');

        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
    } catch (err) {
        console.error('[playch]', err.message);
        await sock.sendMessage(chatId, { text: '❌ High-quality audio download failed. Try $play instead.' }, { quoted: message });
    }
}

module.exports = { playCommand, play2Command, playDocCommand, playChCommand };
