'use strict';
const { funGet } = require('../lib/gifted');

async function jokeCommand(sock, chatId, message) {
    try {
        const data = await funGet('jokes');
        const r = data?.result;
        let text;
        if (r && typeof r === 'object' && r.setup) {
            text = `${r.setup}\n\n${r.punchline}`;
        } else if (typeof r === 'string') {
            text = r;
        } else {
            throw new Error('Unexpected response');
        }
        await sock.sendMessage(chatId, {
            text: `😂 *JOKE OF THE DAY*\n\n${text}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[joke]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Could not fetch a joke right now. Try again!',
        }, { quoted: message });
    }
}

module.exports = jokeCommand;
