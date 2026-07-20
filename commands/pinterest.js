'use strict';
const axios = require('axios');
const { searchGet } = require('../lib/gifted');

async function pinterestCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const q = text.split(' ').slice(1).join(' ').trim();
        if (!q) return sock.sendMessage(chatId, {
            text: '📌 Usage: $pinterest <search term>\nExample: $pinterest aesthetic room',
        }, { quoted: message });

        await sock.sendMessage(chatId, { text: `📌 Searching Pinterest for: *${q}*...` }, { quoted: message });

        // Use Gifted Google Image search scoped to Pinterest
        const data = await searchGet('googleimage', { query: `pinterest ${q}` });
        const urls = (data?.results || []).filter(u => typeof u === 'string' && u.startsWith('http'));

        if (!urls.length) {
            return sock.sendMessage(chatId, { text: '❌ No Pinterest results found.' }, { quoted: message });
        }

        let sent = 0;
        for (const url of urls.slice(0, 4)) {
            if (sent >= 3) break;
            try {
                const imgRes = await axios.get(url, {
                    responseType: 'arraybuffer', timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                });
                await sock.sendMessage(chatId, {
                    image: Buffer.from(imgRes.data),
                    caption: `📌 *Pinterest* — ${q}\n\n_Daratech_ ⚡`,
                }, { quoted: message });
                sent++;
            } catch {}
        }

        if (!sent) {
            await sock.sendMessage(chatId, { text: '❌ Found results but could not load any images.' }, { quoted: message });
        }
    } catch (err) {
        console.error('[pinterest]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Pinterest search failed. Try again.' }, { quoted: message });
    }
}

module.exports = pinterestCommand;
