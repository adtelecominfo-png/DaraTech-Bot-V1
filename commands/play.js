'use strict';
const yts = require('yt-search');
const { get } = require('../lib/gifted');

// ─── Shared: search YouTube ───────────────────────────────────────────────────

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

function pickDl(result) {
    if (!result) return null;
    return result.download_url || result.audio_url || result.url || result.link || null;
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

// ─── .play — YouTube audio as audio bubble (ytaudio, 128kbps) ────────────────

async function playCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(play|song|mp3|ytmp3)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: .play <song name or YouTube URL>' }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');

        const data = await get('/download/ytaudio', { url: meta.url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${data?.result?.title || meta.title}.mp3`,
            ptt:      false,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

// ─── .play2 — SaveTube MP3 (alternate server, audio bubble) ──────────────────

async function play2Command(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(play2|playdoc)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: .play2 <song name or YouTube URL>\n_Uses SaveTube server — alternative source._',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading via SaveTube…');

        // SaveTube MP3 — confirmed endpoint, result.download_url
        const data = await get('/download/savetubemp3', { url: meta.url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const title = data?.result?.title || meta.title;
        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt:      false,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Audio download failed (SaveTube). Try .play instead.' }, { quoted: message });
    }
}

// ─── .playdoc — YouTube audio sent as downloadable document file ──────────────

async function playDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.playdoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: .playdoc <song name or YouTube URL>\n_Sends the MP3 as a file you can download & share._',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');

        const data = await get('/download/savetubemp3', { url: meta.url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const title = data?.result?.title || meta.title;
        await sock.sendMessage(chatId, {
            document: { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Audio file download failed. Try again.' }, { quoted: message });
    }
}

// ─── .playch — High-quality 320kbps audio (ytmp3 server) ─────────────────────

async function playChCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.playch\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎵 Usage: .playch <song name or YouTube URL>\n_Downloads at 320kbps high quality via ytmp3 server._',
        }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading 320kbps audio…');

        // ytmp3 supports quality param: 128kbps or 320kbps
        const data = await get('/download/ytmp3', { url: meta.url, quality: '320kbps' });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const title = data?.result?.title || meta.title;
        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt:      false,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ High-quality audio download failed. Try .play instead.' }, { quoted: message });
    }
}

module.exports = { playCommand, play2Command, playDocCommand, playChCommand };
