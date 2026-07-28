'use strict';
const { davidGet } = require('../lib/gifted');

async function net9jaCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const q = text.split(' ').slice(1).join(' ').trim();
        if (!q) return sock.sendMessage(chatId, { text: '📁 Usage: $net9ja <movie title>\nExample: $net9ja Black Panther' }, { quoted: message });
        await sock.sendMessage(chatId, { text: `📁 Searching Net9ja for: *${q}*...` }, { quoted: message });
        const data = await davidGet(`/movies/net9ja/search?q=${encodeURIComponent(q)}&limit=5`);
        if (!data?.success || !data?.results?.length) {
            return sock.sendMessage(chatId, { text: '❌ No results found on Net9ja.' }, { quoted: message });
        }
        let txt = `╭━═『 *NET9JA SEARCH* 』━╮\n┃ 🔎 *Query:* ${q}\n╰━━━━━━━━━━━━━━━╯\n\n`;
        data.results.forEach((r, i) => {
            txt += `*${i + 1}. ${r.title}*\n🔗 ${r.url}\n──────────────\n`;
        });
        txt += `\n🚀 *Daratech Bot*`;
        const thumb = data.results[0]?.thumbnail;
        if (thumb) {
            await sock.sendMessage(chatId, { image: { url: thumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[net9ja]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Net9ja search failed. Try again.' }, { quoted: message });
    }
}

module.exports = net9jaCommand;
