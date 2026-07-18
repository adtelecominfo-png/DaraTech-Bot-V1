'use strict';
const { get } = require('../lib/gifted');

async function flirtCommand(sock, chatId, message) {
    try {
        const data = await get('/fun/pickupline');
        const text = data?.result || '...';
        await sock.sendMessage(chatId, {
            text: `💘 *FLIRT LINE*\n\n${text}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[flirt]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get a flirt line. Try again!' }, { quoted: message });
    }
}

module.exports = { flirtCommand };
