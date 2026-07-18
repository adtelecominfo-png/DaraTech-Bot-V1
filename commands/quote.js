'use strict';
const { funGet } = require('../lib/gifted');

module.exports = async function quoteCommand(sock, chatId, message) {
    try {
        const data = await funGet('quotes');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, {
            text: `╭━═『 *DAILY WISDOM* 』━╮\n╰━━━━━━━━━━━━━━━╯\n\n"${text}"\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[quote]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get quote. Try again!' }, { quoted: message });
    }
};
