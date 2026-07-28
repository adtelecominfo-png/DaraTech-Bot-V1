'use strict';
const yts = require('yt-search');

async function ytsearchCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const q = text.split(' ').slice(1).join(' ').trim();
        if (!q) return sock.sendMessage(chatId, { text: '🔍 Usage: $yts <search query>\nExample: $yts faded alan walker' }, { quoted: message });
        await sock.sendMessage(chatId, { text: '▶️ Searching YouTube……' }, { quoted: message });
        const results = await yts(q);
        if (!results?.videos?.length) return sock.sendMessage(chatId, { text: '❌ No YouTube results found.' }, { quoted: message });
        let txt = `▶️ *YOUTUBE — "${q}"*\n\n`;
        results.videos.slice(0, 7).forEach((v, i) => {
            txt += `*${i + 1}. ${v.title}*\n`;
            txt += `▸ 🕒 ${v.timestamp}  ·  👁 ${(v.views||0).toLocaleString()} views\n`;
            txt += `▸ 📅 ${v.ago}\n`;
            txt += `▸ 🔗 ${v.url}\n\n`;
        });
        txt += `_Daratech_ ⚡`;
        const thumb = results.videos[0]?.thumbnail;
        if (thumb) {
            await sock.sendMessage(chatId, { image: { url: thumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[ytsearch]', err.message);
        await sock.sendMessage(chatId, { text: '❌ YouTube search failed. Try again.' }, { quoted: message });
    }
}

module.exports = ytsearchCommand;
