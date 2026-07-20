'use strict';
const axios = require('axios');
const { get } = require('../lib/gifted');

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

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url  = text.split(' ').slice(1).join(' ').trim();
        if (!url || !(url.includes('facebook') || url.includes('fb.watch'))) {
            return sock.sendMessage(chatId,
                { text: '📘 Usage: $facebook <Facebook video URL>' },
                { quoted: message });
        }
        await sock.sendMessage(chatId, { text: '⏳ _Downloading Facebook video…_' }, { quoted: message });
        const data = await get('/download/facebook', { url });
        const r    = data?.result || {};
        const dl   = r.download_url || r.hd || r.sd || r.url;
        if (!dl) throw new Error('No download URL returned');
        const buf  = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `📘 *Facebook Video*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[facebook]', err.message);
        await sock.sendMessage(chatId,
            { text: '❌ Facebook download failed. Try again.' },
            { quoted: message });
    }
}

module.exports = facebookCommand;
