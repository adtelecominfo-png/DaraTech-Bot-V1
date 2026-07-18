'use strict';
const { davidGet } = require('../lib/gifted');

async function pinterestCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const q = text.split(' ').slice(1).join(' ').trim();
        if (!q) return sock.sendMessage(chatId, { text: '📌 Usage: .pinterest <search term>\nExample: .pinterest aesthetic room' }, { quoted: message });
        await sock.sendMessage(chatId, { text: `📌 Searching Pinterest for: *${q}*...` }, { quoted: message });
        const data = await davidGet(`/search/pinterest?text=${encodeURIComponent(q)}`);
        const results = data?.result || data?.results || [];
        if (!results.length) return sock.sendMessage(chatId, { text: '❌ No Pinterest results found.' }, { quoted: message });
        for (const res of results.slice(0, 3)) {
            const img = res.image || res.url || res.thumbnail;
            if (img) {
                await sock.sendMessage(chatId, {
                    image: { url: img },
                    caption: `📌 *Pinterest* — ${res.title || q}\n\n🚀 *Daratech Bot*`,
                }, { quoted: message });
            }
        }
    } catch (err) {
        console.error('[pinterest]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Pinterest search failed. Try again.' }, { quoted: message });
    }
}

module.exports = pinterestCommand;
