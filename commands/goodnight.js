'use strict';
const { get } = require('../lib/gifted');

async function goodnightCommand(sock, chatId, message) {
    try {
        const data = await get('/fun/goodnight');
        const text = data.result || data.message || data.text || '...';
        await sock.sendMessage(chatId, { text: `🌙 *GOODNIGHT*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[goodnight]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get goodnight message. Try again!' }, { quoted: message });
    }
}

module.exports = { goodnightCommand };
