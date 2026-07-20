'use strict';
const yts   = require('yt-search');
const axios = require('axios');
const { get } = require('../lib/gifted');

/** Download a URL to a Buffer */
async function toBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

async function spotifyCommand(sock, chatId, message) {
    try {
        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            return sock.sendMessage(chatId,
                { text: '🎵 Usage: $spotify <song name or Spotify URL>' },
                { quoted: message });
        }

        await sock.sendMessage(chatId, { text: `🎵 _Finding:_ *${input}*…` }, { quoted: message });

        let title = input;
        let artist = '';
        let thumbnail = null;
        let duration = '';

        // ── Step 1: Resolve track info from Spotify ───────────────────────
        if (input.startsWith('http')) {
            // Passed a Spotify URL — search Spotify for its metadata
            try {
                const shortId = input.match(/track\/([A-Za-z0-9]+)/)?.[1] || '';
                const search  = await get('/search/spotifysearch', { query: shortId || input });
                const track   = (search?.results || [])[0];
                if (track) {
                    title     = track.title  || title;
                    artist    = track.artist || '';
                    thumbnail = track.thumbnail || null;
                    duration  = track.duration  || '';
                }
            } catch { /* use raw URL as query */ }
        } else {
            // Passed a search query — search Spotify
            try {
                const search = await get('/search/spotifysearch', { query: input });
                const track  = (search?.results || [])[0];
                if (track) {
                    title     = track.title  || title;
                    artist    = track.artist || '';
                    thumbnail = track.thumbnail || null;
                    duration  = track.duration  || '';
                }
            } catch { /* fall through */ }
        }

        // ── Step 2: Send info card ─────────────────────────────────────────
        const caption = [
            `🎵 *${title}*`,
            artist   ? `👤 ${artist}`   : '',
            duration ? `⏱️ ${duration}` : '',
            '',
            `⬇️ _Downloading…_`,
        ].filter(Boolean).join('\n');

        if (thumbnail) {
            try {
                await sock.sendMessage(chatId,
                    { image: { url: thumbnail }, caption },
                    { quoted: message });
            } catch {
                await sock.sendMessage(chatId, { text: caption }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // ── Step 3: Find on YouTube then download as MP3 ──────────────────
        const query = artist ? `${title} ${artist}` : title;
        const { videos } = await yts(query);
        if (!videos?.length) throw new Error('Track not found on YouTube');

        const ytUrl = videos[0].url;
        const data  = await get('/download/ytaudio', { url: ytUrl });
        const dl    = data?.result?.download_url || data?.result?.audio_url || data?.result?.url;
        if (!dl) throw new Error('No download URL');

        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            audio:    buf,
            mimetype: 'audio/mpeg',
            fileName: `${title}${artist ? ` - ${artist}` : ''}.mp3`,
            ptt:      false,
        }, { quoted: message });

    } catch (err) {
        console.error('[spotify]', err.message);
        await sock.sendMessage(chatId,
            { text: '❌ Spotify download failed. Try again.' },
            { quoted: message });
    }
}

module.exports = spotifyCommand;
