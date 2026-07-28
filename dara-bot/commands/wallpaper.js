'use strict';
const { davidGet } = require('../lib/gifted');

async function wallpaperCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const q = text.split(' ').slice(1).join(' ').trim();
        if (!q) return sock.sendMessage(chatId, { text: '🖼 Usage: $wallpaper <search term>\nExample: $wallpaper naruto' }, { quoted: message });
        await sock.sendMessage(chatId, { text: `🖼 Searching wallpapers for: *${q}*...` }, { quoted: message });
        const data = await davidGet(`/search/wallpaper?text=${encodeURIComponent(q)}`);
        if (!data?.success || !data?.result?.length) {
            return sock.sendMessage(chatId, { text: '❌ No wallpapers found for that query.' }, { quoted: message });
        }
        const results = (data.result || []).slice(0, 3);
        for (const res of results) {
            await sock.sendMessage(chatId, {
                image: { url: res.image },
                caption: `🖼 *${res.title || q}*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }
    } catch (err) {
        console.error('[wallpaper]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Wallpaper search failed. Try again.' }, { quoted: message });
    }
}

module.exports = wallpaperCommand;
