'use strict';
const { davidGet } = require('../lib/gifted');

async function waifuCommand(sock, chatId, message) {
    try {
        const data = await davidGet('/random/waifu');
        if (!data?.success || !data?.url) throw new Error('No waifu image returned');
        await sock.sendMessage(chatId, {
            image: { url: data.url },
            caption: `✨ *RANDOM WAIFU*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[waifu]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Error summoning your waifu. Try again.' }, { quoted: message });
    }
}

module.exports = waifuCommand;
