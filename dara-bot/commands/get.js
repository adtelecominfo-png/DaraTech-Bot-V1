'use strict';
const axios = require('axios');

/** $get <url> — fetch any image from a URL and send it */
async function getCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url || !url.startsWith('http')) {
        return sock.sendMessage(chatId, {
            text: '🖼️ *Usage:* $get <image url>\n\nExample: $get https://example.com/image.jpg',
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Daratech-Bot/1.0)' },
        });
        const buf = Buffer.from(res.data);
        await sock.sendMessage(chatId, {
            image: buf,
            caption: `🖼️ *IMAGE FETCHED*\n🌐 Source: ${url}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error('[get]', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to fetch image.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = getCommand;
