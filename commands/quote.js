'use strict';
const { davidGet } = require('../lib/gifted');

module.exports = async function quoteCommand(sock, chatId, message) {
    try {
        const data = await davidGet('/random/quotes');
        const q = data?.quote || data?.result || data;
        const text  = q?.text || q?.quote || (typeof q === 'string' ? q : '...');
        const author = q?.author || '';
        await sock.sendMessage(chatId, {
            text: `╭━═『 *DAILY WISDOM* 』━╮\n${author ? `┃ 👤 *Author:* ${author}\n` : ''}╰━━━━━━━━━━━━━━━╯\n\n"${text}"\n\n🚀 *Daratech Bot*`
        }, { quoted: message });
    } catch (e) {
        console.error('[quote]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get quote. Try again!' }, { quoted: message });
    }
};
