'use strict';
const axios                 = require('axios');
const yts                   = require('yt-search');
const { get }               = require('../lib/gifted');
const { toOgg, toBuffer }   = require('../lib/media');

let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

const OMEGA_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://api.omegatech.app/',
    'Origin': 'https://api.omegatech.app',
};

async function ytSearch(input) {
    if (/youtube\.com|youtu\.be/i.test(input)) {
        return { url: input, title: input, thumbnail: null, duration: '', author: '', views: '' };
    }
    const { videos } = await yts(input);
    if (!videos?.length) throw new Error('No results: ' + input);
    const v = videos[0];
    return {
        url: v.url, title: v.title, thumbnail: v.thumbnail || v.image || null,
        duration: v.timestamp || '', author: v.author?.name || '',
        views: v.views ? Number(v.views).toLocaleString() : '',
    };
}

function findDownloadUrl(value, seen = new Set()) {
    if (typeof value === 'string') {
        return /^https?:\/\//i.test(value) && !/youtube\.com|youtu\.be/i.test(value) ? value : null;
    }
    if (!value || typeof value !== 'object' || seen.has(value)) return null;
    seen.add(value);
    const keys = ['download_url', 'downloadUrl', 'audio_url', 'audioUrl', 'download', 'audio', 'url', 'link', 'mp3', 'dlink'];
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
    for (const key of ['title', 'name', 'audioTitle']) {
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

async function omegaAudio(ytUrl) {
    const response = await axios.get('https://api.omegatech.app/api/download/savefrom', {
        params: { action: 'download', url: ytUrl },
        headers: OMEGA_HEADERS,
        timeout: 120000,
        maxRedirects: 10,
    });
    const body = response.data;
    const dl = findDownloadUrl(body);
    if (!dl) throw new Error('OmegaTech returned no audio URL');
    return { dl, title: getTitle(body, ytUrl) };
}

async function resolveAudioUrl(ytUrl) {
    // Primary provider requested by the bot owner.
    try { return await omegaAudio(ytUrl); } catch (err) {
        console.warn('[ytaudio] OmegaTech failed:', err.message);
    }

    // Fallback 1 — ruhend-scraper ytmp3.
    try {
        const { ytmp3 } = getScraper();
        const data = await ytmp3(ytUrl);
        const dl = data?.audio || data?.download_url || data?.url || null;
        if (dl) return { dl, title: data?.title || ytUrl };
    } catch { /* fall through */ }

    // Fallback 2 — existing GiftedTech endpoints.
    const endpoints = [
        () => get('/download/ytaudio', { url: ytUrl }, 90000),
        () => get('/download/ytmp3', { url: ytUrl, quality: '128kbps' }, 90000),
        () => get('/download/savetubemp3', { url: ytUrl }, 90000),
    ];
    for (const ep of endpoints) {
        try {
            const data = await ep();
            const body = data?.result || data;
            const dl = findDownloadUrl(body);
            if (dl) return { dl, title: getTitle(body, ytUrl) };
        } catch { /* try next */ }
    }
    throw new Error('All audio endpoints failed');
}

async function sendBanner(sock, chatId, message, meta, action) {
    const caption = [
        `🎵 *${meta.title}*`, meta.author ? `👤 ${meta.author}` : '',
        meta.duration ? `⏱️ ${meta.duration}` : '', meta.views ? `👁️ ${meta.views} views` : '',
        '', `⬇️ _${action}_`,
    ].filter(Boolean).join('\n');
    if (meta.thumbnail) {
        try { return await sock.sendMessage(chatId, { image: { url: meta.thumbnail }, caption }, { quoted: message }); }
        catch { /* fall through */ }
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

async function ytaudioCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudio\s*/i, '').replace(/^\$play\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudio <song name or YouTube URL>' }, { quoted: message });
        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');
        const { dl, title } = await resolveAudioUrl(meta.url);
        const mp3Buf = await toBuffer(dl);
        const oggBuf = await toOgg(mp3Buf);
        if (oggBuf) {
            await sock.sendMessage(chatId, { audio: oggBuf, mimetype: 'audio/ogg; codecs=opus', ptt: false }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { document: mp3Buf, mimetype: 'audio/mpeg', fileName: `${title}.mp3` }, { quoted: message });
        }
    } catch (err) {
        console.error('[ytaudio]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

async function ytaudioDocCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudiodoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudiodoc <song name or YouTube URL>' }, { quoted: message });
        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');
        // Uses the same OmegaTech-first audio resolver, but always sends a document.
        const { dl, title } = await resolveAudioUrl(meta.url);
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
        }, { quoted: message });
    } catch (err) {
        console.error('[ytaudiodoc]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio file download failed. Try again.' }, { quoted: message });
    }
}

module.exports = { ytaudioCommand, ytaudioDocCommand };
