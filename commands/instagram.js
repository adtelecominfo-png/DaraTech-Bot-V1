'use strict';
const { get } = require('../lib/gifted');

async function instagramCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url = text.split(' ').slice(1).join(' ').trim();
        if (!url || !url.includes('instagram')) {
            return sock.sendMessage(chatId, { text: '📸 Usage: .instagram <Instagram post/reel URL>' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: '⏳ Downloading Instagram media...' }, { quoted: message });
        const data = await get('/download/instagram', { url });
        const r = data?.result || {};
        const dl = r.download_url || r.url || r.video || r.image;
        if (!dl) throw new Error('No download URL returned');
        const isVideo = r.type === 'video' || /\.mp4/i.test(dl);
        const caption = `📸 *Instagram Media*\n\n✨ *Daratech Bot*`;
        if (isVideo) {
            await sock.sendMessage(chatId, { video: { url: dl }, mimetype: 'video/mp4', caption }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { image: { url: dl }, caption }, { quoted: message });
        }
    } catch (err) {
        console.error('[instagram]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Instagram download failed. Try again.' }, { quoted: message });
    }
}

module.exports = instagramCommand;
