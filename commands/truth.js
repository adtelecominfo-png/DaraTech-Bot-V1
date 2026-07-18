'use strict';
const { funGet } = require('../lib/gifted');

async function truthCommand(sock, chatId, message) {
    try {
        const data = await funGet('truth');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, { text: `🎯 *TRUTH*\n\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch (e) {
        console.error('[truth]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get truth. Try again!' }, { quoted: message });
    }
}

module.exports = { truthCommand };
