'use strict';
const { funGet } = require('../lib/gifted');

async function rizzCommand(sock, chatId, message) {
    try {
        const data = await funGet('pickupline');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, {
            text: `😏 *RIZZ / PICK-UP LINE*\n\n${text}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[rizz]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get a pick-up line. Try again!' }, { quoted: message });
    }
}

module.exports = rizzCommand;
