'use strict';
const axios = require('axios');
const { igdl } = require('ruhend-scraper');

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

async function instagramCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const urlMatch = text.match(/https?:\/\/\S+/);
        if (!urlMatch) {
            return sock.sendMessage(chatId, {
                text: '📸 *Instagram Downloader*\n\nUsage: .ig <Instagram post/reel URL>\n\nExample:\n.ig https://www.instagram.com/reel/ABC123/',
            }, { quoted: message });
        }

        const url = urlMatch[0];
        await sock.sendMessage(chatId, { text: '⏳ Downloading Instagram media...' }, { quoted: message });

        const downloadData = await igdl(url).catch(() => null);
        const items = (downloadData?.data || []).filter(m => m && m.url);

        if (!items.length) {
            return sock.sendMessage(chatId, {
                text: '❌ Instagram download failed. The link may be private or expired.\n\nTry again or use .igdl for a different method.',
            }, { quoted: message });
        }

        const caption = `📸 *Instagram*\n\n_Daratech_ ⚡`;
        const limit   = Math.min(items.length, 4);

        for (let i = 0; i < limit; i++) {
            const { url: dlUrl, type } = items[i];
            const isVideo = type === 'video' || /\.(mp4|webm|mov)/i.test(dlUrl);
            try {
                const buf = await toBuffer(dlUrl);
                if (isVideo) {
                    await sock.sendMessage(chatId, {
                        video:    buf,
                        mimetype: 'video/mp4',
                        caption:  i === 0 ? caption : '',
                    }, { quoted: i === 0 ? message : undefined });
                } else {
                    await sock.sendMessage(chatId, {
                        image:   buf,
                        caption: i === 0 ? caption : '',
                    }, { quoted: i === 0 ? message : undefined });
                }
            } catch (itemErr) {
                console.error('[instagram] item send error:', itemErr.message);
            }
            if (i < limit - 1) await new Promise(r => setTimeout(r, 600));
        }

    } catch (err) {
        console.error('[instagram]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Instagram download failed. Try again.',
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
