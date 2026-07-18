'use strict';

const os = require('os');
const settings = require('../settings.js');

function formatUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function speedEmoji(ms) {
    if (ms < 200)  return '🟢';
    if (ms < 600)  return '🟡';
    if (ms < 1200) return '🟠';
    return '🔴';
}

async function pingCommand(sock, chatId, message) {
    try {
        const start = Date.now();
        const sentMsg = await sock.sendMessage(chatId, { text: '⏳' }, { quoted: message });
        if (message?.key) await sock.readMessages([message.key]);
        const ms = Date.now() - start;

        const usedMem = os.totalmem() - os.freemem();
        const ramMB   = (usedMem / 1048576).toFixed(0);
        const uptime  = formatUptime(Math.floor(process.uptime()));

        const text = [
            `🏓 *Pong!*  ${speedEmoji(ms)} *${ms} ms*`,
            ``,
            `⏱️ Uptime : ${uptime}`,
            `🧠 RAM    : ${ramMB} MB`,
            `📦 v${settings.version || '1.0.0'}`,
        ].join('\n');

        await sock.sendMessage(chatId, { text, edit: sentMsg.key });

    } catch (error) {
        console.error('Error in ping command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to get bot status.' });
    }
}

module.exports = pingCommand;
