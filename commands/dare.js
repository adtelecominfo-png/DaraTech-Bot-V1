const settings = require('../settings');
const BASE = 'https://api.runflix.name.ng';
const { RUNFLIX_HEADERS } = require('../lib/apiHeaders');

async function dareCommand(sock, chatId, message) {
    try {
        const apiKey = require('../settings').runflixApiKey;
        const res = await fetch(`${BASE}/fun/dares?apikey=${apiKey}`, { headers: RUNFLIX_HEADERS });
        const json = await res.json();
        const text = json.result || json.message || json.text || json.dare || '...';
        await sock.sendMessage(chatId, { text: `🔥 *DARE*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[dare]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get dare. Try again!' }, { quoted: message });
    }
}

module.exports = { dareCommand };
