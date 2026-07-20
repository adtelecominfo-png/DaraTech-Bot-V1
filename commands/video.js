'use strict';
const yts   = require('yt-search');
const axios = require('axios');
const { get } = require('../lib/gifted');

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
    return result.download_url || result.video_url || result.url || result.link || null;
}

/** Download a URL to a Buffer so we send bytes, not an expiring link */
async function toBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

// ─── $video / $ytmp4 — YouTube video (720p) ──────────────────────────────────

async function videoCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(video|ytmp4)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎬 Usage: $video <title or YouTube URL>' }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading:* ${title}…` }, { quoted: message });

        const data = await get('/download/ytmp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video:    buf,
            mimetype: 'video/mp4',
            caption:  `🎬 *${data?.result?.title || title}*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[video]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

// ─── $video2 / $savetube — YouTube video via SaveTube (360p) ─────────────────

async function video2Command(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\.(video2|savetube)\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: $video2 <title or YouTube URL>',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Downloading (360p):* ${title}…` }, { quoted: message });

        const data = await get('/download/savetubemp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video:    buf,
            mimetype: 'video/mp4',
            caption:  `🎬 *${data?.result?.title || title}*\n📊 ${data?.result?.quality || '360p'}\n\n_Daratech_ ⚡`,
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
        const input = text.replace(/^\.videodoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId, {
            text: '🎬 Usage: $videodoc <title or YouTube URL>',
        }, { quoted: message });

        const { url, title } = await ytSearch(input);
        await sock.sendMessage(chatId, { text: `🎬 *Preparing video file:* ${title}…` }, { quoted: message });

        const data = await get('/download/savetubemp4', { url });
        const dl   = pickDl(data?.result);
        if (!dl) throw new Error('No download URL');

        const buf = await toBuffer(dl);
        const vidTitle = data?.result?.title || title;
        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'video/mp4',
            fileName: `${vidTitle}.mp4`,
        }, { quoted: message });
    } catch (err) {
        console.error('[videodoc]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video file download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { videoCommand, video2Command, videoDocCommand };
