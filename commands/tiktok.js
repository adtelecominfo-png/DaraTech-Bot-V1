'use strict';
const axios = require('axios');
const { get } = require('../lib/gifted');

const processedMessages = new Set();

async function toBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

async function tiktokCommand(sock, chatId, message) {
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const url  = text.split(' ').slice(1).join(' ').trim();
    if (!url) {
        return sock.sendMessage(chatId, { text: '🎵 Usage: $tiktok <TikTok URL>' }, { quoted: message });
    }
    try {
        await sock.sendMessage(chatId, { text: '⏳ _Downloading TikTok video…_' }, { quoted: message });
        const data  = await get('/download/tiktok', { url });
        const r     = data?.result || {};
        const dl    = r.download_url || r.video || r.url || r.nowm;
        const title = r.title || r.desc || 'TikTok Video';
        if (!dl) throw new Error('No download URL returned');
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `🎵 *${title}*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[tiktok]', err.message);
        await sock.sendMessage(chatId,
            { text: '❌ TikTok download failed. Try again.' },
            { quoted: message });
    }
}

module.exports = tiktokCommand;
