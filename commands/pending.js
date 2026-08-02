'use strict';
/**
 * pending.js — View & accept/reject pending group join requests
 *
 * $pending                         — list all pending join requests (numbered)
 * $accept all / $reject all        — approve/reject every pending request
 * $accept 1,2,5 / $reject 1 2 5    — approve/reject specific numbered requests
 *
 * Admin-only, group-only. Bot must be admin.
 */

const isAdmin = require('../lib/isAdmin');

const pendingCache = new Map();

// Helper to parse inputs like "1, 2, 5" or "1 2 5" into validated 0-based index arrays
function parseIndices(arg, totalLength) {
    const rawTokens = arg.split(/[\s,]+/).filter(Boolean);
    const validIndices = [];
    const invalidTokens = [];

    for (const token of rawTokens) {
        const num = parseInt(token, 10);
        if (!isNaN(num) && num >= 1 && num <= totalLength) {
            // Store unique indices
            const index = num - 1;
            if (!validIndices.includes(index)) {
                validIndices.push(index);
            }
        } else {
            invalidTokens.push(token);
        }
    }

    return { validIndices, invalidTokens };
}

// ── $pending ──────────────────────────────────────────────────────────────────
async function pendingCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group-only command.' }, { quoted: message });
    }

    const senderId   = message.key.participant || message.key.remoteJid;
    const adminStatus = await isAdmin(sock, chatId, senderId);

    if (!adminStatus.isSenderAdmin && !message.key.fromMe) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
    }
    if (!adminStatus.isBotAdmin) {
        return sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
    }

    let requests = [];
    try {
        requests = await sock.groupRequestParticipantsList(chatId) || [];
    } catch (err) {
        console.error('[pending]', err.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to fetch pending requests. Make sure the bot is admin.' }, { quoted: message });
    }

    if (requests.length === 0) {
        pendingCache.delete(chatId);
        return sock.sendMessage(chatId, { text: '✅ No pending join requests.' }, { quoted: message });
    }

    const jids = requests.map(r => (typeof r === 'string' ? r : r.jid || r.id || r));
    pendingCache.set(chatId, jids);

    const lines    = jids.map((j, i) => `${i + 1}. @${j.split('@')[0]}`);
    const mentions = jids;

    return sock.sendMessage(chatId, {
        text: [
            `🗂️ \`\`\`Pending Join Requests (${jids.length})\`\`\``,
            ``,
            `The following ${jids.length} request(s) are waiting for approval:`,
            ``,
            lines.join('\n'),
            ``,
            `_Use *$accept all*, *$reject all*, or *$accept 1,2,5* to manage._`,
            ``,
            `_Daratech_ ⚡`,
        ].join('\n'),
        mentions,
    }, { quoted: message });
}

// ── $accept ───────────────────────────────────────────────────────────────────
async function acceptCommand(sock, chatId, message, userMessage) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group-only command.' }, { quoted: message });
    }

    const senderId    = message.key.participant || message.key.remoteJid;
    const adminStatus = await isAdmin(sock, chatId, senderId);

    if (!adminStatus.isSenderAdmin && !message.key.fromMe) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
    }
    if (!adminStatus.isBotAdmin) {
        return sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
    }

    const arg = userMessage.replace(/^\$accept\s*/i, '').trim().toLowerCase();

    if (!arg) {
        return sock.sendMessage(chatId, {
            text: `❌ Usage:\n• *$accept all* — approve all pending requests\n• *$accept 1,2,5* — approve multiple requests\n\n_Run *$pending* first to see the numbered list._`,
        }, { quoted: message });
    }

    let requests = [];
    try {
        requests = await sock.groupRequestParticipantsList(chatId) || [];
    } catch (err) {
        console.error('[accept]', err.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to fetch pending requests.' }, { quoted: message });
    }

    if (requests.length === 0) {
        pendingCache.delete(chatId);
        return sock.sendMessage(chatId, { text: '✅ No pending requests to accept.' }, { quoted: message });
    }

    const jids = requests.map(r => (typeof r === 'string' ? r : r.jid || r.id || r));
    pendingCache.set(chatId, jids);

    if (arg === 'all') {
        try {
            await sock.groupRequestParticipantsUpdate(chatId, jids, 'approve');
            return sock.sendMessage(chatId, {
                text: [
                    `✅ *Accepted all ${jids.length} pending request(s)!*`,
                    ``,
                    jids.map(j => `• @${j.split('@')[0]}`).join('\n'),
                    ``,
                    `_Daratech_ ⚡`,
                ].join('\n'),
                mentions: jids,
            }, { quoted: message });
        } catch (err) {
            console.error('[accept:all]', err.message);
            return sock.sendMessage(chatId, { text: `❌ Failed to accept all: ${err.message}` }, { quoted: message });
        }
    }

    const { validIndices, invalidTokens } = parseIndices(arg, jids.length);

    if (validIndices.length === 0) {
        return sock.sendMessage(chatId, {
            text: `❌ Invalid input.\n\nThere are *${jids.length}* pending request(s). Please choose numbers between *1* and *${jids.length}* (e.g. *$accept 1,3,4*).\n\nRun *$pending* to view the list.`,
        }, { quoted: message });
    }

    const targetJids = validIndices.map(i => jids[i]);

    try {
        await sock.groupRequestParticipantsUpdate(chatId, targetJids, 'approve');

        const successLines = validIndices.map(i => `• Request #${i + 1}: @${jids[i].split('@')[0]}`);
        const invalidNote  = invalidTokens.length > 0 ? `\n\n⚠️ Skipped invalid numbers: *${invalidTokens.join(', ')}*` : '';

        return sock.sendMessage(chatId, {
            text: [
                `✅ *Accepted ${targetJids.length} request(s)!*`,
                ``,
                successLines.join('\n'),
                invalidNote,
                ``,
                `_Daratech_ ⚡`,
            ].join('\n'),
            mentions: targetJids,
        }, { quoted: message });
    } catch (err) {
        console.error('[accept:multi]', err.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to accept selected request(s): ${err.message}` }, { quoted: message });
    }
}

// ── $reject ───────────────────────────────────────────────────────────────────
async function rejectCommand(sock, chatId, message, userMessage) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group-only command.' }, { quoted: message });
    }

    const senderId    = message.key.participant || message.key.remoteJid;
    const adminStatus = await isAdmin(sock, chatId, senderId);

    if (!adminStatus.isSenderAdmin && !message.key.fromMe) {
        return sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
    }
    if (!adminStatus.isBotAdmin) {
        return sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
    }

    const arg = userMessage.replace(/^\$reject\s*/i, '').trim().toLowerCase();

    if (!arg) {
        return sock.sendMessage(chatId, {
            text: `❌ Usage:\n• *$reject all* — decline all pending requests\n• *$reject 1,2,5* — decline multiple requests\n\n_Run *$pending* first to see the numbered list._`,
        }, { quoted: message });
    }

    let requests = [];
    try {
        requests = await sock.groupRequestParticipantsList(chatId) || [];
    } catch (err) {
        console.error('[reject]', err.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to fetch pending requests.' }, { quoted: message });
    }

    if (requests.length === 0) {
        pendingCache.delete(chatId);
        return sock.sendMessage(chatId, { text: '✅ No pending requests to reject.' }, { quoted: message });
    }

    const jids = requests.map(r => (typeof r === 'string' ? r : r.jid || r.id || r));
    pendingCache.set(chatId, jids);

    if (arg === 'all') {
        try {
            await sock.groupRequestParticipantsUpdate(chatId, jids, 'reject');
            return sock.sendMessage(chatId, {
                text: [
                    `🚫 *Rejected all ${jids.length} pending request(s).*`,
                    ``,
                    jids.map(j => `• @${j.split('@')[0]}`).join('\n'),
                    ``,
                    `_Daratech_ ⚡`,
                ].join('\n'),
                mentions: jids,
            }, { quoted: message });
        } catch (err) {
            console.error('[reject:all]', err.message);
            return sock.sendMessage(chatId, { text: `❌ Failed to reject all: ${err.message}` }, { quoted: message });
        }
    }

    const { validIndices, invalidTokens } = parseIndices(arg, jids.length);

    if (validIndices.length === 0) {
        return sock.sendMessage(chatId, {
            text: `❌ Invalid input.\n\nThere are *${jids.length}* pending request(s). Please choose numbers between *1* and *${jids.length}* (e.g. *$reject 1,3,4*).\n\nRun *$pending* to view the list.`,
        }, { quoted: message });
    }

    const targetJids = validIndices.map(i => jids[i]);

    try {
        await sock.groupRequestParticipantsUpdate(chatId, targetJids, 'reject');

        const successLines = validIndices.map(i => `• Request #${i + 1}: @${jids[i].split('@')[0]}`);
        const invalidNote  = invalidTokens.length > 0 ? `\n\n⚠️ Skipped invalid numbers: *${invalidTokens.join(', ')}*` : '';

        return sock.sendMessage(chatId, {
            text: [
                `🚫 *Rejected ${targetJids.length} request(s).*`,
                ``,
                successLines.join('\n'),
                invalidNote,
                ``,
                `_Daratech_ ⚡`,
            ].join('\n'),
            mentions: targetJids,
        }, { quoted: message });
    } catch (err) {
        console.error('[reject:multi]', err.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to reject selected request(s): ${err.message}` }, { quoted: message });
    }
}

module.exports = { pendingCommand, acceptCommand, rejectCommand };
