'use strict';
const { get } = require('../lib/gifted');

async function truthCommand(sock, chatId, message) {
    try {
        const data = await get('/fun/truth');
        const text = data.result || data.message || data.text || data.truth || '...';
        await sock.sendMessage(chatId, { text: `🎯 *TRUTH*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[truth]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get truth. Try again!' }, { quoted: message });
    }
}

module.exports = { truthCommand };
