const settings = require('../settings');
const BASE = 'https://api.runflix.name.ng';
const { RUNFLIX_HEADERS } = require('../lib/apiHeaders');

async function goodnightCommand(sock, chatId, message) {
    try {
        const apiKey = require('../settings').runflixApiKey;
        const res = await fetch(`${BASE}/fun/goodnight?apikey=${apiKey}`, { headers: RUNFLIX_HEADERS });
        const json = await res.json();
        const text = json.result || json.message || json.text || '...';
        await sock.sendMessage(chatId, { text: `🌙 *GOODNIGHT*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[goodnight]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get goodnight message. Try again!' }, { quoted: message });
    }
}

module.exports = { goodnightCommand };
