'use strict';
const { get } = require('../lib/gifted');

async function apkCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const query = text.split(' ').slice(1).join(' ').trim();
        if (!query) {
            return sock.sendMessage(chatId, { text: '📲 Usage: $apk <app name>\nExample: $apk WhatsApp' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: `📲 Searching APK: *${query}*...` }, { quoted: message });
        const data = await get('/download/apkdl', { appName: query });
        if (!data?.success || !data?.result?.download_url) {
            return sock.sendMessage(chatId, { text: '🚫 App not found or failed to fetch APK. Try a different name.' }, { quoted: message });
        }
        const r = data.result;
        const caption =
            `📦 *APK FOUND*\n\n` +
            `▸ 📂 *App:* ${r.appname || query}\n` +
            `▸ 👨‍💻 *Dev:* ${r.developer || 'Unknown'}\n` +
            `▸ 📦 *Size:* ${r.size || 'Unknown'}\n\n` +
            `_Daratech_ ⚡`;
        if (r.appicon) {
            await sock.sendMessage(chatId, { image: { url: r.appicon }, caption }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            document: { url: r.download_url },
            mimetype: r.mimetype || 'application/vnd.android.package-archive',
            fileName: `${r.appname || query}.apk`,
            caption: '✅ *Use at your own risk.*',
        }, { quoted: message });
    } catch (err) {
        console.error('[apk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ APK download failed. Try again.' }, { quoted: message });
    }
}

module.exports = apkCommand;
