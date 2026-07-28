'use strict';
const axios = require('axios');
const { davidGet } = require('../lib/gifted');

const JIKAN = 'https://api.jikan.moe/v4';

/** $animeinfo <title> — search for anime info via Jikan */
async function animeinfoCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text: '🎌 *ANIME INFO*\n\nUsage: $animeinfo <anime name>\nExample: $animeinfo Attack on Titan\n\n_Daratech_ ⚡',
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: `🎌 Searching anime: *${query}*...` }, { quoted: message });
        const res = await axios.get(`${JIKAN}/anime`, { params: { q: query, limit: 1 }, timeout: 15000 });
        const anime = res.data?.data?.[0];
        if (!anime) return sock.sendMessage(chatId, { text: `❌ No anime found for "${query}".` }, { quoted: message });

        const genres = (anime.genres || []).map(g => g.name).join(', ') || 'N/A';
        const studios = (anime.studios || []).map(s => s.name).join(', ') || 'N/A';
        const synopsis = anime.synopsis ? anime.synopsis.slice(0, 500) + (anime.synopsis.length > 500 ? '...' : '') : 'No synopsis.';

        const txt =
            `╭━═『 *ANIME INFO* 』═━╮\n` +
            `┃ 🎌 *Title:* ${anime.title}\n` +
            `┃ 🇯🇵 *JP:* ${anime.title_japanese || '-'}\n` +
            `┃ 📺 *Type:* ${anime.type || '-'}\n` +
            `┃ 📡 *Status:* ${anime.status || '-'}\n` +
            `┃ 🎬 *Episodes:* ${anime.episodes || '?'}\n` +
            `┃ ⭐ *Score:* ${anime.score || '-'}/10\n` +
            `┃ 🏆 *Rank:* #${anime.rank || '-'}\n` +
            `┃ 📅 *Aired:* ${anime.aired?.string || '-'}\n` +
            `┃ 🎭 *Genres:* ${genres}\n` +
            `┃ 🏢 *Studios:* ${studios}\n` +
            `┃ 🔗 *MAL:* ${anime.url || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
            `📝 *Synopsis:*\n${synopsis}\n\n_Daratech_ ⚡`;

        const imgUrl = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url;
        if (imgUrl) {
            try {
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                await sock.sendMessage(chatId, { image: Buffer.from(imgRes.data), caption: txt }, { quoted: message });
            } catch {
                await sock.sendMessage(chatId, { text: txt }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[animeinfo]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch anime info for "${query}".` }, { quoted: message });
    }
}

/** $trendinganime — top/trending anime from Jikan */
async function trendingAnimeCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '🔥 Fetching trending anime...' }, { quoted: message });
        const res = await axios.get(`${JIKAN}/top/anime`, { params: { filter: 'airing', limit: 10 }, timeout: 15000 });
        const list = res.data?.data || [];
        if (!list.length) return sock.sendMessage(chatId, { text: '❌ Could not fetch trending anime.' }, { quoted: message });

        let txt = `╭━═『 *🔥 TRENDING ANIME* 』═━╮\n\n`;
        list.forEach((a, i) => {
            txt += `*${i + 1}.* ${a.title}\n`;
            txt += `   ⭐ ${a.score || '-'} | 📺 ${a.type || '-'} | 🎬 ${a.episodes || '?'} eps\n\n`;
        });
        txt += `_Daratech_ ⚡`;

        const imgUrl = list[0]?.images?.jpg?.large_image_url;
        if (imgUrl) {
            try {
                const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
                await sock.sendMessage(chatId, { image: Buffer.from(imgRes.data), caption: txt }, { quoted: message });
            } catch {
                await sock.sendMessage(chatId, { text: txt }, { quoted: message });
            }
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[trendinganime]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch trending anime.' }, { quoted: message });
    }
}

/** $animeindo <title> — search Indonesian-dubbed anime via David API */
async function animeIndoCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.split(' ').slice(1).join(' ').trim();

    if (!query) {
        return sock.sendMessage(chatId, {
            text: '🎌 *ANIME INDO*\n\nUsage: $animeindo <anime name>\nExample: $animeindo Naruto\n\n_Daratech_ ⚡',
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: `🎌 Searching Indo anime: *${query}*...` }, { quoted: message });
        const data = await davidGet(`/animeindo/search?q=${encodeURIComponent(query)}`);
        const results = data?.result || data?.data || [];

        if (!results.length) {
            return sock.sendMessage(chatId, { text: `❌ No Indo anime found for "${query}".` }, { quoted: message });
        }

        let txt = `╭━═『 *ANIME INDO RESULTS* 』═━╮\n\n`;
        results.slice(0, 8).forEach((a, i) => {
            txt += `*${i + 1}.* ${a.title || a.name || 'Unknown'}\n`;
            if (a.status) txt += `   📡 ${a.status}\n`;
            if (a.episode) txt += `   🎬 ${a.episode}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;

        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error('[animeindo]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to search Indo anime for "${query}".` }, { quoted: message });
    }
}

module.exports = { animeinfoCommand, trendingAnimeCommand, animeIndoCommand };
