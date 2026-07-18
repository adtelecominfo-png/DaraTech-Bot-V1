'use strict';
const { get } = require('../lib/gifted');

async function handleSsCommand(sock, chatId, message, match) {
    if (!match || !match.trim()) {
        return sock.sendMessage(chatId, {
            text: `📸 *SCREENSHOT TOOL*\n\n*.ss <url>*\n*.ssweb <url>*\n*.screenshot <url>*\n\nExample:\n.ss https://google.com`,
        }, { quoted: message });
    }
    const url = match.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return sock.sendMessage(chatId, {
            text: '❌ Provide a valid URL starting with http:// or https://',
        }, { quoted: message });
    }
    try {
        await sock.sendMessage(chatId, { text: `⏳ Screenshotting: *${url}*...` }, { quoted: message });
        const data = await get('/tools/ssweb', { url });
        const imgUrl = data?.result?.url || data?.result?.image || data?.result;
        if (!imgUrl || typeof imgUrl !== 'string') throw new Error('No screenshot URL returned');
        await sock.sendMessage(chatId, {
            image: { url: imgUrl },
            caption: `📸 *SCREENSHOT*\n🔗 ${url}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (e) {
        console.error('[ss]', e.message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to screenshot. URL may be invalid or the site is blocking access.',
        }, { quoted: message });
    }
}

module.exports = { handleSsCommand };
