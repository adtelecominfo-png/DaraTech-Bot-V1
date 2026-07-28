'use strict';
const axios = require('axios');

async function poemCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://poetrydb.org/random/1', { timeout: 10000 });
        const poem = data[0];
        if (!poem) throw new Error('no poem');
        const lines = poem.lines?.slice(0, 20).join('\n') || 'No lines.';
        const truncated = poem.lines?.length > 20 ? '\n_...poem continues_' : '';
        await sock.sendMessage(chatId, {
            text: `📜 *POEM*\n\n*${poem.title}*\n_by ${poem.author}_\n\n${lines}${truncated}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch a poem.' }, { quoted: message }); }
}

async function animequoteCommand(sock, chatId, message) {
    try {
        const { animeGet } = require('../lib/gifted');
        const data = await animeGet('quotes');
        const q = data?.result;
        if (!q) throw new Error('Empty');
        const quote     = q?.quote     || '...';
        const character = q?.character || 'Unknown';
        const show      = q?.show      || 'Unknown';
        await sock.sendMessage(chatId, {
            text: `🎌 *ANIME QUOTE*\n\n"${quote}"\n\n— *${character}* from _${show}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch anime quote.' }, { quoted: message }); }
}

async function kanyeCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://api.kanye.rest/', { timeout: 8000 });
        await sock.sendMessage(chatId, {
            text: `🎤 *KANYE WEST SAID:*\n\n"${data.quote}"\n\n— Kanye West\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Kanye is busy rapping. Try again.' }, { quoted: message }); }
}

module.exports = { poemCommand, animequoteCommand, kanyeCommand };
