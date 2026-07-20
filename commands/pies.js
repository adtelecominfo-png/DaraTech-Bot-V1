'use strict';
const { get } = require('../lib/gifted');

const VALID_TYPES = ['wallpaper', 'nature', 'anime', 'art', 'city', 'food', 'cars', 'space'];

async function piesCommand(sock, chatId, message, args) {
    const sub   = (args && args[0] ? args[0] : 'wallpaper').toLowerCase();
    const query = VALID_TYPES.includes(sub) ? sub : 'wallpaper';
    try {
        const data   = await get('/search/wallpaper', { text: query });
        const images = data.result || data.images || data.data || [];
        const imgUrl = Array.isArray(images) && images.length > 0
            ? (images[Math.floor(Math.random() * Math.min(images.length, 8))].url || images[0].url || images[0])
            : null;
        if (!imgUrl) throw new Error('No image');
        await sock.sendMessage(chatId, { image: { url: imgUrl }, caption: `🖼 *${query.toUpperCase()} Wallpaper*` }, { quoted: message });
    } catch (e) {
        console.error('[pies]', e.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch image.\n\nUsage: $wallpaper <type>\nTypes: ${VALID_TYPES.join(', ')}` }, { quoted: message });
    }
}

async function piesAlias(sock, chatId, message, country) {
    return piesCommand(sock, chatId, message, [country]);
}

module.exports = { piesCommand, piesAlias, VALID_COUNTRIES: VALID_TYPES };
