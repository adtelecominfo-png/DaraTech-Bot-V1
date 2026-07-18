'use strict';
const { funGet } = require('../lib/gifted');

async function flirtCommand(sock, chatId, message) {
    try {
        const data = await funGet('flirt');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, {
            text: `💘 *FLIRT LINE*\n\n${text}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[flirt]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get a flirt line. Try again!' }, { quoted: message });
    }
}

module.exports = { flirtCommand };
