'use strict';
const yts = require('yt-search');
const { get } = require('../lib/gifted');

// ─── Shared: search YouTube ───────────────────────────────────────────────────

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
    return result.download_url || result.video_url || result.url || result.link || null;
}

// ─── .video / .ytmp4 — YouTube video as video message (720p) ─────────────────

async function videoCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(video|ytmp4)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎬 Usage: .video <title or YouTube URL>' }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });

        const data = await get('/download/ytmp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        await sock.sendMessage(chatId, {
            video:    { url: dl },
            mimetype: 'video/mp4',
            caption:  `🎬 *${data?.result?.title || title}*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

// ─── .video2 / .savetube — YouTube video via SaveTube server ─────────────────

async function video2Command(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(video2|savetube)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: .video2 <title or YouTube URL>\n_Downloads via SaveTube — alternative server._',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading via SaveTube:* ${title}…` }, { quoted: message });

        // SaveTube MP4 — confirmed endpoint, result.download_url
        const data = await get('/download/savetubemp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        await sock.sendMessage(chatId, {
            video:    { url: dl },
            mimetype: 'video/mp4',
            caption:  `🎬 *${data?.result?.title || title}*\n📊 ${data?.result?.quality || '360p'}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Video download failed (SaveTube). Try .video instead.' }, { quoted: message });
    }
}

// ─── .videodoc — YouTube video as downloadable document file ─────────────────

async function videoDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(videodoc)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: .videodoc <title or YouTube URL>\n_Sends the MP4 as a file you can download & share._',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Preparing video file:* ${title}…` }, { quoted: message });

        const data = await get('/download/savetubemp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const vidTitle = data?.result?.title || title;
        await sock.sendMessage(chatId, {
            document: { url: dl },
            mimetype: 'video/mp4',
            fileName: `${vidTitle}.mp4`,
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Video file download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { videoCommand, video2Command, videoDocCommand };
