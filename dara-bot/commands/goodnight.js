'use strict';
const { funGet } = require('../lib/gifted');

async function goodnightCommand(sock, chatId, message) {
    try {
        const data = await funGet('goodnight');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, { text: `🌙 *GOODNIGHT*\n\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch (e) {
        console.error('[goodnight]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get goodnight message. Try again!' }, { quoted: message });
    }
}

module.exports = { goodnightCommand };
