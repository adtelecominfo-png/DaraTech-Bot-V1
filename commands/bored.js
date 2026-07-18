'use strict';
const { davidGet } = require('../lib/gifted');

async function boredCommand(sock, chatId, message) {
    try {
        const data = await davidGet('/random/bored');
        if (!data?.success) throw new Error('No activity returned');
        const txt =
            `🎮 *BOREDOM KILLER*\n\n` +
            `▸ 🎯 *Activity:* ${data.activity}\n` +
            `▸ 🏷️ *Type:* ${data.type}\n` +
            `▸ 👥 *Participants:* ${data.participants}\n` +
            `▸ 💰 *Price:* ${data.price === 0 ? 'Free' : data.price}\n` +
            `▸ ⏳ *Duration:* ${data.duration || 'Varies'}\n\n` +
            `💡 ${data.accessibility || 'Go for it!'}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error('[bored]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get activity idea. Try again.' }, { quoted: message });
    }
}

module.exports = boredCommand;
