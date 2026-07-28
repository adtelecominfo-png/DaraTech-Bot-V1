'use strict';
const { get } = require('../lib/gifted');
const { toMp4, toBuffer } = require('../lib/media');

// Lazy-load ruhend-scraper
let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

function pickFbDl(data) {
    if (!data) return null;
    if (data.hd)       return data.hd;
    if (data.sd)       return data.sd;
    if (data.hd_video) return data.hd_video;
    if (data.sd_video) return data.sd_video;
    const r = data.result || data.data || data;
    return r.hd || r.sd || r.hd_video || r.sd_video || r.download_url || r.url || null;
}

async function facebookCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const url  = text.split(' ').slice(1).join(' ').trim();
        if (!url || !(url.includes('facebook') || url.includes('fb.watch') || url.includes('fb.com'))) {
            return sock.sendMessage(chatId, {
                text: `╭━━━「 📘 *FACEBOOK DL* 」━━━\n` +
                      `┃\n` +
                      `┃ ▸ *Usage:* $facebook <URL>\n` +
                      `┃ ▸ Supports videos & reels\n` +
                      `┃\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });
        await sock.sendMessage(chatId, { text: '⏳ _Fetching Facebook video…_' }, { quoted: message });

        let dl = null;

        // Method 1 — ruhend-scraper fbdl
        try {
            const { fbdl } = getScraper();
            const data = await fbdl(url);
            dl = pickFbDl(data);
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech facebook endpoint
        if (!dl) {
            try {
                const data = await get('/download/facebook', { url }, 90000);
                const r = data?.result || {};
                dl = r.hd_video || r.sd_video || r.download_url || r.hd || r.sd || r.url || null;
            } catch { /* fallthrough */ }
        }

        if (!dl) throw new Error('No download URL returned from any source');

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

        // Download + re-encode to H.264/AAC/faststart — Baileys requires this
        let vidBuf = null;
        try { vidBuf = await toBuffer(dl); } catch {}
        if (vidBuf) {
            const mp4 = await toMp4(vidBuf);
            vidBuf = mp4 || vidBuf;
        }

        if (vidBuf) {
            await sock.sendMessage(chatId, {
                video:    vidBuf,
                mimetype: 'video/mp4',
                caption:  `📘 *Facebook Video*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                video:    { url: dl },
                mimetype: 'video/mp4',
                caption:  `📘 *Facebook Video*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }

    } catch (err) {
        console.error('[facebook]', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: '❌ *Facebook download failed.*\n\nMake sure the link is a valid public Facebook video.\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }
}

module.exports = facebookCommand;
