'use strict';
const { davidGet } = require('../lib/gifted');

async function lyricsCommand(sock, chatId, input, message) {
    if (!input || !input.trim()) {
        return sock.sendMessage(chatId, {
            text: '🎶 Usage: $lyrics <song>\n        $lyrics <song> | <artist>\nExample: $lyrics Faded | Alan Walker',
        }, { quoted: message });
    }

    // Parse optional artist via pipe: "$lyrics song | artist"
    const [rawSong, rawArtist] = input.split('|').map(s => s.trim());
    const songTitle = rawSong;
    const artist   = rawArtist || '';

    const displayLabel = artist ? `*${songTitle}* by *${artist}*` : `*${songTitle}*`;
    try {
        await sock.sendMessage(chatId, { text: `🎶 Fetching lyrics for: ${displayLabel}...` }, { quoted: message });

        let url = `/lyrics3?song=${encodeURIComponent(songTitle)}`;
        if (artist) url += `&artist=${encodeURIComponent(artist)}`;

        const data = await davidGet(url);
        if (!data?.success || !data?.result) {
            return sock.sendMessage(chatId, { text: `❌ Lyrics not found for ${displayLabel}.` }, { quoted: message });
        }

        const r = data.result;
        const header =
            `╭━═『 *LYRICS* 』═━╮\n` +
            `┃ 🎶 *Song:* ${r.song || songTitle}\n` +
            `┃ 👤 *Artist:* ${r.artist || artist || 'Unknown'}\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n\n`;

        const lyrics = r.lyrics || '';
        const MAX    = 4000 - header.length;
        const body   = lyrics.length > MAX ? lyrics.slice(0, MAX) + '\n...(truncated)' : lyrics;

        await sock.sendMessage(chatId, { text: header + body }, { quoted: message });
    } catch (err) {
        console.error('[lyrics]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch lyrics for ${displayLabel}.` }, { quoted: message });
    }
}

module.exports = { lyricsCommand };
