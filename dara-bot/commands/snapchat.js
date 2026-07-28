'use strict';
/**
 * snapchat.js — Snapchat Spotlight / Story downloader
 * $snapchat / $snap / $sc <url>
 */

const { get }              = require('../lib/gifted');
const { toMp4, toBuffer }  = require('../lib/media');
const axios                = require('axios');

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getUrl(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const m = text.match(/https?:\/\/\S+/);
    return m ? m[0] : null;
}

async function snapchatCommand(sock, chatId, message) {
    const url = getUrl(message);

    if (!url || !url.includes('snapchat.com')) {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👻 *SNAPCHAT DL* 」━━━\n` +
                  `┃\n` +
                  `┃ ▸ *Usage:* $snap <URL>\n` +
                  `┃ ▸ Supports Spotlight & stories\n` +
                  `┃\n` +
                  `┃ Example:\n` +
                  `┃ $snap https://www.snapchat.com/...\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '📥');
    await sock.sendMessage(chatId, { text: '👻 _Fetching Snapchat media…_' }, { quoted: message });

    let dlUrl = null;

    // Method 1 — Cobalt.tools (supports Snapchat Spotlight)
    try {
        const res = await axios.post('https://api.cobalt.tools/', { url }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            timeout: 30000
        });
        const d = res.data;
        if (d?.status === 'tunnel' || d?.status === 'redirect') dlUrl = d.url;
        else if (d?.status === 'picker') dlUrl = d.picker?.[0]?.url || null;
    } catch { /* fallthrough */ }

    // Method 2 — GiftedTech snapchat endpoint
    if (!dlUrl) {
        try {
            const data = await get('/download/snapchat', { url }, 30000);
            const r = data?.result || {};
            dlUrl = r.video || r.url || r.download_url || null;
        } catch { /* fallthrough */ }
    }

    // Method 3 — Ryzen API
    if (!dlUrl) {
        try {
            const res = await axios.get(`https://api.ryzendesu.vip/api/downloader/snap?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            dlUrl = res.data?.data?.url || res.data?.url || null;
        } catch { /* fallthrough */ }
    }

    // Method 4 — All-in-one social downloader
    if (!dlUrl) {
        try {
            const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20000 });
            dlUrl = res.data?.video?.noWatermark || res.data?.url || null;
        } catch { /* fallthrough */ }
    }

    if (!dlUrl) {
        await react(sock, message, '❌');
        return sock.sendMessage(chatId, {
            text: '❌ *Snapchat download failed.*\n\nMake sure the link is a *public* Snapchat Spotlight video.\nPrivate stories and locked content cannot be downloaded.\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    try {
        let vidBuf = await toBuffer(dlUrl);
        const mp4 = await toMp4(vidBuf);
        vidBuf = mp4 || vidBuf;

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            video:    vidBuf,
            mimetype: 'video/mp4',
            caption:  `👻 *Snapchat*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Failed to send media.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = snapchatCommand;
