'use strict';
/**
 * playlist.js — YouTube Playlist downloader
 * $playlist <youtube playlist url>
 * Sends each track as an audio file (up to 10 tracks).
 */

const { get }   = require('../lib/gifted');
const { toOgg } = require('../lib/media');
const axios     = require('axios');

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getUrl(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const m = text.match(/https?:\/\/\S+/);
    return m ? m[0] : null;
}

async function playlistCommand(sock, chatId, message) {
    const url = getUrl(message);

    if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🎵 *PLAYLIST DL* 」━━━\n` +
                  `┃\n` +
                  `┃ ▸ *Usage:* $playlist <YouTube URL>\n` +
                  `┃ ▸ Supports full playlists\n` +
                  `┃ ▸ Max 10 tracks sent\n` +
                  `┃\n` +
                  `┃ Example:\n` +
                  `┃ $playlist https://youtube.com/playlist?list=...\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '📥');
    await sock.sendMessage(chatId, { text: '🎵 _Fetching playlist info…_' }, { quoted: message });

    let tracks = [];

    // Method 1 — GiftedTech playlist endpoint
    try {
        const data = await get('/download/ytplaylist', { url }, 30000);
        const r = data?.result || data?.data || [];
        if (Array.isArray(r) && r.length) tracks = r.slice(0, 10);
        else if (r.tracks) tracks = r.tracks.slice(0, 10);
    } catch { /* fallthrough */ }

    // Method 2 — ytdl2 lib (individual tracks from playlist page)
    if (!tracks.length) {
        try {
            const ytSearch = require('../lib/ytdl2');
            const info = await ytSearch.getPlaylist(url);
            if (info?.videos?.length) {
                tracks = info.videos.slice(0, 10).map(v => ({
                    title: v.title,
                    url:   `https://youtu.be/${v.videoId}`,
                }));
            }
        } catch { /* fallthrough */ }
    }

    if (!tracks.length) {
        await react(sock, message, '❌');
        return sock.sendMessage(chatId, {
            text: '❌ *Could not fetch playlist.*\n\nMake sure the playlist is public.\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `🎵 *Found ${tracks.length} tracks — downloading…*\n\n_Daratech_ ⚡`
    }, { quoted: message });

    let sent = 0;
    for (const track of tracks) {
        try {
            const trackUrl = track.url || track.link || track.video_url;
            const title    = track.title || `Track ${sent + 1}`;

            // Get audio URL via GiftedTech ytmp3
            let audioUrl = track.audio_url || track.mp3 || null;
            if (!audioUrl) {
                const dlData = await get('/download/ytmp3', { url: trackUrl }, 60000);
                audioUrl = dlData?.result?.download_url || dlData?.result?.url || null;
            }

            if (!audioUrl) continue;

            const res = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: Infinity,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const mp3Buf = Buffer.from(res.data);
            const oggBuf = await toOgg(mp3Buf);
            const buf    = oggBuf || mp3Buf;
            const mime   = oggBuf ? 'audio/ogg; codecs=opus' : 'audio/mpeg';

            await sock.sendMessage(chatId, {
                audio:    buf,
                mimetype: mime,
                ptt:      false,
                fileName: `${title}.mp3`,
            }, { quoted: message });

            sent++;
            if (sent < tracks.length) await new Promise(r => setTimeout(r, 1500));
        } catch (trackErr) {
            console.error(`[playlist] track ${sent + 1} failed:`, trackErr.message);
        }
    }

    await react(sock, message, sent > 0 ? '✅' : '❌');
    await sock.sendMessage(chatId, {
        text: sent > 0
            ? `✅ *Sent ${sent}/${tracks.length} tracks!*\n\n_Daratech_ ⚡`
            : `❌ *All tracks failed to download.*\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

module.exports = playlistCommand;
