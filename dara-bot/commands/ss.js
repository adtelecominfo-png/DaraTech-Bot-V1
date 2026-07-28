'use strict';
const { toolsBuf } = require('../lib/gifted');

async function handleSsCommand(sock, chatId, message, match) {
    if (!match || !match.trim()) {
        return sock.sendMessage(chatId, {
            text: `📸 *SCREENSHOT TOOL*\n\n*$ss <url>*\n*$ssweb <url>*\n*$screenshot <url>*\n\nExample:\n.ss https://google.com`,
        }, { quoted: message });
    }
    const url = match.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return sock.sendMessage(chatId, {
            text: '❌ Provide a valid URL starting with http:// or https://',
        }, { quoted: message });
    }
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: '⏳', key: message.key },
        });
        await sock.sendMessage(chatId, { text: '📸 Taking screenshot……' }, { quoted: message });
        const buf = await toolsBuf('ssweb', { url });
        if (buf.length < 1000) throw new Error('Screenshot failed or empty response');
        await sock.sendMessage(chatId, {
            image: buf,
            caption: `📸 *SCREENSHOT (HD)*\n🔗 ${url}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: '✅', key: message.key },
        });
    } catch (e) {
        console.error('[ss]', e.message);
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: '❌', key: message.key },
        });
        await sock.sendMessage(chatId, {
            text: '❌ Failed to screenshot. URL may be invalid or the site is blocking access.',
        }, { quoted: message });
    }
}

module.exports = { handleSsCommand };
