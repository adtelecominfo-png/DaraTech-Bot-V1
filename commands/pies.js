const settings = require('../settings');
const BASE = 'https://api.runflix.name.ng';
const { RUNFLIX_HEADERS } = require('../lib/apiHeaders');

const VALID_TYPES = ['wallpaper', 'nature', 'anime', 'art', 'city', 'food', 'cars', 'space'];

async function piesCommand(sock, chatId, message, args) {
    const sub = (args && args[0] ? args[0] : 'wallpaper').toLowerCase();
    const query = VALID_TYPES.includes(sub) ? sub : 'wallpaper';
    try {
        const apiKey = require('../settings').runflixApiKey;
        const res = await fetch(`${BASE}/search/wallpaper?apikey=${apiKey}&query=${encodeURIComponent(query)}`, { headers: RUNFLIX_HEADERS });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const json = await res.json();
        const images = json.result || json.images || json.data || [];
        const imgUrl = Array.isArray(images) && images.length > 0
            ? (images[Math.floor(Math.random() * Math.min(images.length, 8))].url || images[0].url || images[0])
            : null;
        if (!imgUrl) throw new Error('No image');
        await sock.sendMessage(chatId, { image: { url: imgUrl }, caption: `🖼 *${query.toUpperCase()} Wallpaper*` }, { quoted: message });
    } catch (e) {
        console.error('[pies]', e.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch image.\n\nUsage: .wallpaper <type>\nTypes: ${VALID_TYPES.join(', ')}` }, { quoted: message });
    }
}

async function piesAlias(sock, chatId, message, country) {
    return piesCommand(sock, chatId, message, [country]);
}

module.exports = { piesCommand, piesAlias, VALID_COUNTRIES: VALID_TYPES };
