const settings = require('../settings');
const BASE = 'https://api.runflix.name.ng';
const { RUNFLIX_HEADERS } = require('../lib/apiHeaders');

async function truthCommand(sock, chatId, message) {
    try {
        const apiKey = require('../settings').runflixApiKey;
        const res = await fetch(`${BASE}/fun/truth?apikey=${apiKey}`, { headers: RUNFLIX_HEADERS });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        const text = json.result || json.message || json.text || json.truth || '...';
        await sock.sendMessage(chatId, { text: `🎯 *TRUTH*\n\n${text}` }, { quoted: message });
    } catch (e) {
        console.error('[truth]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get truth. Try again!' }, { quoted: message });
    }
}

module.exports = { truthCommand };
