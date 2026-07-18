'use strict';
const { get } = require('../lib/gifted');

async function jokeCommand(sock, chatId, message) {
    try {
        const data = await get('/fun/joke');
        const joke = data?.result || data?.joke || '...';
        await sock.sendMessage(chatId, {
            text: `😂 *JOKE OF THE DAY*\n\n${joke}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[joke]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Could not fetch a joke right now. Try again!',
        }, { quoted: message });
    }
}

module.exports = jokeCommand;
