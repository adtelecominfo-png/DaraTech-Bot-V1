'use strict';
const { davidGet } = require('../lib/gifted');

async function shayariCommand(sock, chatId, message) {
    try {
        const data = await davidGet('/random/quotes');
        const q = data?.quote || data?.result || data;
        const text  = q?.text || q?.quote || (typeof q === 'string' ? q : '...');
        const author = q?.author || '';
        await sock.sendMessage(chatId, {
            text: `🌹 *SHAYARI / POETRY*\n\n"${text}"${author ? `\n\n— ${author}` : ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[shayari]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch shayari. Try again!' }, { quoted: message });
    }
}

module.exports = { shayariCommand };
