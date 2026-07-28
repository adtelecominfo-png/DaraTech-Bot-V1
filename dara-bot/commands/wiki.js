'use strict';
const axios = require('axios');

async function wikiCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.split(' ').slice(1).join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: '📚 Usage: $wiki <topic>\nExample: $wiki Black holes' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '📚 Searching Wikipedia……' }, { quoted: message });
        const { data } = await axios.get(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
            { timeout: 12000, headers: { 'User-Agent': 'DaratechBot/1.0' } }
        );
        if (data.type === 'disambiguation') {
            return sock.sendMessage(chatId, { text: `⚠️ "*${query}*" is ambiguous. Try a more specific term.\n\n${data.extract?.slice(0, 300) || ''}` }, { quoted: message });
        }
        const summary = data.extract ? (data.extract.length > 700 ? data.extract.slice(0, 700) + '...' : data.extract) : 'No summary available.';
        const txt =
            `╭━═『 📚 *WIKIPEDIA* 』═━╮\n` +
            `┃ 📖 *${data.title}*\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
            `${summary}\n\n` +
            `🔗 ${data.content_urls?.desktop?.page || ''}\n\n_Daratech_ ⚡`;
        const imgUrl = data.thumbnail?.source;
        if (imgUrl) {
            await sock.sendMessage(chatId, { image: { url: imgUrl }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: `❌ No Wikipedia article found for "*${query}*".` }, { quoted: message });
    }
}

module.exports = { wikiCommand };
