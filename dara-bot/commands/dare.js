'use strict';
const { funGet } = require('../lib/gifted');

async function dareCommand(sock, chatId, message) {
    try {
        const data = await funGet('dares');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, { text: `🔥 *DARE*\n\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch (e) {
        console.error('[dare]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get dare. Try again!' }, { quoted: message });
    }
}

module.exports = { dareCommand };
