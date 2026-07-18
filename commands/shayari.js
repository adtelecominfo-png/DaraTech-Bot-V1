'use strict';
const { funGet } = require('../lib/gifted');

async function shayariCommand(sock, chatId, message) {
    try {
        const data = await funGet('shayari');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, {
            text: `🌹 *SHAYARI / POETRY*\n\n"${text}"\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[shayari]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch shayari. Try again!' }, { quoted: message });
    }
}

module.exports = { shayariCommand };
