'use strict';
/**
 * bots.js — $bots
 *
 * Fetches all deployed bot instances from the GitHub registry
 * (updated automatically each time any bot connects) and displays them.
 * Owner-only.
 *
 * Usage: $bots
 */

const { fetchAllBots } = require('../lib/botRegistry');
const {
    isDeveloperOwner,
} = require('../lib/isOwner');

// Format an ISO timestamp into a readable relative string
function timeAgo(isoStr) {
    if (!isoStr) return '—';
    const diffMs  = Date.now() - new Date(isoStr).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1)   return 'just now';
    if (diffMin < 60)  return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24)    return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
}

async function botsCommand(sock, chatId, senderId, message) {
    try {
        // Strip device suffix and @domain, compare digits only
        if (!await isDeveloperOwner(senderId, sock, message, chatId)) {
            // Silently ignore — don't even hint the command exists
            return;
        }

        await sock.sendMessage(chatId,
            { text: '⏳ Fetching connected bots from registry…' },
            { quoted: message });

        const bots = await fetchAllBots();

        if (!bots.length) {
            return sock.sendMessage(chatId, {
                text: [
                    `╭━━━「 🤖 *DEPLOYED ACCOUNTS* 」━━━`,
                    `┃`,
                    `┃  No bots registered yet.`,
                    `┃  Registry updates automatically when`,
                    `┃  any bot instance connects to WhatsApp.`,
                    `┃`,
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                ].join('\n'),
            }, { quoted: message });
        }

        // Sort by lastSeen descending (most recently connected first)
        bots.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

        const lines = bots.map((b, i) => {
            const branch = i === bots.length - 1 ? '╰' : '├';
            return (
                `${branch}◆ 🟢 *${b.name}*\n` +
                `┃   📱 +${b.number}\n` +
                `┃   🕐 Last seen: ${timeAgo(b.lastSeen)}`
            );
        });

        const text = [
            `╭━━━「 🤖 *DEPLOYED ACCOUNTS* 」━━━`,
            `┃`,
            ...lines,
            `┃`,
            `┃ Total: *${bots.length}* account(s) registered`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `_Daratech_ ⚡`,
        ].join('\n');

        return sock.sendMessage(chatId, { text }, { quoted: message });

    } catch (err) {
        console.error('[bots] error:', err.message);
        return sock.sendMessage(chatId,
            { text: `❌ Failed to fetch bot registry: ${err.message}` },
            { quoted: message });
    }
}

module.exports = botsCommand;
