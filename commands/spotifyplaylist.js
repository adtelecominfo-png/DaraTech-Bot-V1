'use strict';
/**
 * spotifyplaylist.js
 * $spotifyplaylist <query>  |  alias: $spplaylist
 *
 * Searches Spotify playlists via the Gifted API and returns a formatted list
 * with the first result's cover thumbnail + all playlist links.
 *
 * API: https://api.gifted.co.ke/api/search/spotifyplaylist?apikey=...&query=...
 */

const axios = require('axios');

const API_BASE = 'https://api.gifted.co.ke/api/search/spotifyplaylist';
const API_KEY  = 'gifted-api_p1r5icplshukpe2x';

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch {}
}

async function spotifyPlaylistCommand(sock, chatId, message) {
    const text  = message.message?.conversation
               || message.message?.extendedTextMessage?.text
               || '';
    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text:
                `╭━━━「 🎵 *SPOTIFY PLAYLIST SEARCH* 」━━━\n` +
                `┃\n` +
                `┃ *Usage:* $spotifyplaylist <query>\n` +
                `┃ *Alias:* $spplaylist <query>\n` +
                `┃\n` +
                `┃ *Example:*\n` +
                `┃ $spotifyplaylist alan walker\n` +
                `┃ $spotifyplaylist chill vibes\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '🔍');
    await sock.sendMessage(chatId,
        { text: `🎵 _Searching Spotify playlists for_ *${query}*…` },
        { quoted: message });

    let results = [];

    try {
        const url = new URL(API_BASE);
        url.searchParams.set('apikey', API_KEY);
        url.searchParams.set('query', query);

        const { data } = await axios.get(url.toString(), { timeout: 20000 });

        if (!data?.success || !Array.isArray(data.results) || !data.results.length) {
            await react(sock, message, '❌');
            return sock.sendMessage(chatId, {
                text: `❌ *No playlists found for:* _${query}_\n\nTry a different search term.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        results = data.results;
    } catch (err) {
        console.error('[spotifyplaylist]', err.message);
        await react(sock, message, '❌');
        return sock.sendMessage(chatId, {
            text: `❌ *Failed to fetch playlists.* Please try again.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    // Build the text list (all results)
    const lines = results.map((pl, i) => {
        const num  = `${i + 1}.`;
        const name = pl.name    || 'Unknown Playlist';
        const by   = pl.creator || 'Unknown';
        const link = pl.url     || '';
        return `${num} 🎵 *${name}*\n   👤 _${by}_\n   🔗 ${link}`;
    });

    const caption =
        `╭━━━「 🎵 *SPOTIFY PLAYLISTS* 」━━━\n` +
        `┃ 🔍 Query: *${query}*\n` +
        `┃ 📋 Found: *${results.length}* playlist(s)\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        lines.join('\n\n') +
        `\n\n_Daratech_ ⚡`;

    // Try to send with the first result's cover thumbnail
    const thumbnail = results[0]?.thumbnail;
    if (thumbnail) {
        try {
            await sock.sendMessage(chatId,
                { image: { url: thumbnail }, caption },
                { quoted: message });
            await react(sock, message, '✅');
            return;
        } catch {
            // fall through to text-only
        }
    }

    await sock.sendMessage(chatId, { text: caption }, { quoted: message });
    await react(sock, message, '✅');
}

module.exports = spotifyPlaylistCommand;
