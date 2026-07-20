'use strict';
const axios = require('axios');

async function memeCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://meme-api.com/gimme', { timeout: 15000 });
        const url = data?.url;
        if (!url) throw new Error('No meme image returned');
        const imgRes = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption: `😂 *${data.title || 'MEME'}*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[meme]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch meme. Try again!' }, { quoted: message });
    }
}

module.exports = memeCommand;
