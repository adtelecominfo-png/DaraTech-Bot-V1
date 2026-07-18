'use strict';
const { get } = require('../lib/gifted');

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url || !(url.includes('facebook') || url.includes('fb.watch'))) {
            return sock.sendMessage(chatId, { text: '📘 Usage: .facebook <Facebook video URL>' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: '⏳ Downloading Facebook video...' }, { quoted: message });
        const data = await get('/download/facebook', { url });
        const r = data?.result || {};
        const dl = r.download_url || r.hd || r.sd || r.url;
        if (!dl) throw new Error('No download URL returned');
        await sock.sendMessage(chatId, {
            video: { url: dl },
            mimetype: 'video/mp4',
            caption: `📘 *Facebook Video*\n\n✨ *Daratech Bot*`,
        }, { quoted: message });
    } catch (err) {
        console.error('[facebook]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Facebook download failed. Try again.' }, { quoted: message });
    }
}

module.exports = facebookCommand;
