'use strict';
const { davidGet } = require('../lib/gifted');

async function memeCommand(sock, chatId, message) {
    try {
        const data = await davidGet('/random/meme');
        const url = data?.url || data?.result?.url || data?.image;
        if (!url) throw new Error('No meme image returned');
        await sock.sendMessage(chatId, { image: { url }, caption: '😂 *MEME*\n\n🚀 *Daratech Bot*' }, { quoted: message });
    } catch (e) {
        console.error('[meme]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch meme. Try again!' }, { quoted: message });
    }
}

module.exports = memeCommand;
