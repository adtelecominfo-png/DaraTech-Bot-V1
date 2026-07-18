'use strict';
const { get } = require('../lib/gifted');

async function dareCommand(sock, chatId, message) {
    try {
        const data = await get('/fun/dares');
        const text = data.result || data.message || data.text || data.dare || '...';
        await sock.sendMessage(chatId, { text: `🔥 *DARE*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[dare]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get dare. Try again!' }, { quoted: message });
    }
}

module.exports = { dareCommand };
