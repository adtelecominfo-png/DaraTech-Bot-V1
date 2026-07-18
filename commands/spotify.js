'use strict';
const { get } = require('../lib/gifted');

async function spotifyCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            return sock.sendMessage(chatId, { text: '🎵 Usage: .spotify <song name or Spotify URL>' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `🎵 Finding on Spotify: *${input}*...` }, { quoted: message });

        let spotifyUrl = input;
        if (!input.startsWith('http')) {
            const search = await get('/search/spotify', { query: input });
            const track = (search?.result || search?.results || [])[0];
            if (track?.url) {
                spotifyUrl = track.url;
            } else {
                throw new Error('Track not found on Spotify');
            }
        }

        const data = await get('/download/spotifydl', { url: spotifyUrl });
        const r = data?.result || {};
        const dl = r.download_url || r.url || r.audio;
        const title = r.title || r.name || input;
        const artist = r.artist || r.artists || '';
        if (!dl) throw new Error('No download URL returned');

        await sock.sendMessage(chatId, {
            audio: { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt: false,
        }, { quoted: message });
    } catch (err) {
        console.error('[spotify]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Spotify download failed. Try again.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
