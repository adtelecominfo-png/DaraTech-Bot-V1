'use strict';
const { get }      = require('../lib/gifted');
const { toBuffer } = require('../lib/media');

// Lazy-load ruhend-scraper (not in Replit env but installed on user's server)
let _scraper;
function getScraper() {
    if (!_scraper) _scraper = require('ruhend-scraper');
    return _scraper;
}

/** Extract video download URL from fbdl result (handles multiple return shapes) */
function pickFbDl(data) {
    if (!data) return null;
    // ruhend-scraper fbdl shapes
    if (data.hd)       return data.hd;
    if (data.sd)       return data.sd;
    if (data.hd_video) return data.hd_video;
    if (data.sd_video) return data.sd_video;
    // nested under data/result
    const r = data.result || data.data || data;
    return r.hd || r.sd || r.hd_video || r.sd_video || r.download_url || r.url || null;
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

        let dl = null;

        // Method 1 — ruhend-scraper fbdl
        try {
            const { fbdl } = getScraper();
            const data = await fbdl(url);
            dl = pickFbDl(data);
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech facebook endpoint
        if (!dl) {
            const data = await get('/download/facebook', { url }, 90000);
            const r    = data?.result || {};
            dl = r.hd_video || r.sd_video || r.download_url || r.hd || r.sd || r.url || null;
        }

        if (!dl) throw new Error('No download URL returned');

        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video:    buf,
            mimetype: 'video/mp4',
            caption:  `📘 *Facebook Video*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[facebook]', err.message);
        await sock.sendMessage(chatId,
            { text: '❌ Facebook download failed. Try again.' },
            { quoted: message });
    }
}

module.exports = facebookCommand;
