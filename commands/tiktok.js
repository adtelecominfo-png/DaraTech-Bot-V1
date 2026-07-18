'use strict';
const { get } = require('../lib/gifted');

const processedMessages = new Set();

async function tiktokCommand(sock, chatId, message) {
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const url = text.split(' ').slice(1).join(' ').trim();
    if (!url) {
        return sock.sendMessage(chatId, { text: '🎵 Usage: .tiktok <TikTok URL>' }, { quoted: message });
    }
    try {
        await sock.sendMessage(chatId, { text: '⏳ Downloading TikTok video...' }, { quoted: message });
        const data = await get('/download/tiktok', { url });
        const r = data?.result || {};
        const dl = r.download_url || r.video || r.url || r.nowm;
        const title = r.title || r.desc || 'TikTok Video';
        if (!dl) throw new Error('No download URL returned');
        await sock.sendMessage(chatId, {
            video: { url: dl },
            mimetype: 'video/mp4',
            caption: `🎵 *${title}*\n\n✨ *Daratech Bot*`,
        }, { quoted: message });
    } catch (err) {
        console.error('[tiktok]', err.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok download failed. Try again.' }, { quoted: message });
    }
}

module.exports = tiktokCommand;
