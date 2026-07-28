'use strict';
const yts                     = require('yt-search');
const { get }                 = require('../lib/gifted');
const { toOgg, toBuffer }     = require('../lib/media');

// Lazy-load ruhend-scraper (installed on user's server, not in Replit env)
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

function pickDl(result) {
    if (!result) return null;
    return result.audio || result.download_url || result.audio_url
        || result.url   || result.link          || result.mp3 || null;
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
                { image: { url: meta.thumbnail }, caption }, { quoted: message });
        } catch { /* fallthrough */ }
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

async function resolveAudioUrl(ytUrl) {
    let dl = null, title = ytUrl;

    // Method 1 — ruhend-scraper ytmp3
    try {
        const { ytmp3 } = getScraper();
        const data = await ytmp3(ytUrl);
        dl    = data?.audio || data?.download_url || null;
        title = data?.title || title;
    } catch { /* fallthrough */ }

    // Method 2 — GiftedTech endpoints
    if (!dl) {
        const endpoints = [
            () => get('/download/ytaudio',     { url: ytUrl }, 90000),
            () => get('/download/ytmp3',       { url: ytUrl, quality: '128kbps' }, 90000),
            () => get('/download/savetubemp3', { url: ytUrl }, 90000),
        ];
        for (const ep of endpoints) {
            try {
                const data = await ep();
                const url  = pickDl(data?.result);
                if (!url) continue;
                title = data?.result?.title || title;
                dl    = url;
                break;
            } catch { /* try next */ }
        }
    }

    if (!dl) throw new Error('All audio endpoints failed');
    return { dl, title };
}

// ─── $ytaudio — YouTube audio bubble ─────────────────────────────────────────

async function ytaudioCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudio\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudio <song name or YouTube URL>' }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio…');

        const { dl, title } = await resolveAudioUrl(meta.url);
        const mp3Buf = await toBuffer(dl);
        const oggBuf = await toOgg(mp3Buf);

        if (oggBuf) {
            await sock.sendMessage(chatId, {
                audio:    oggBuf,
                mimetype: 'audio/ogg; codecs=opus',
                ptt:      false,
            }, { quoted: message });
        } else {
            // ffmpeg unavailable — send as MP3 document fallback
            await sock.sendMessage(chatId, {
                document: mp3Buf,
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`,
            }, { quoted: message });
        }
    } catch (err) {
        console.error('[ytaudio]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

// ─── $ytaudiodoc — YouTube audio as downloadable MP3 file ────────────────────

async function ytaudioDocCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.replace(/^\$ytaudiodoc\s*/i, '').trim();
        if (!input) return sock.sendMessage(chatId,
            { text: '🎵 Usage: $ytaudiodoc <song name or YouTube URL>' }, { quoted: message });

        const meta = await ytSearch(input);
        await sendBanner(sock, chatId, message, meta, 'Downloading audio file…');

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
