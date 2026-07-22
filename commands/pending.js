'use strict';
/**
 * pending.js — View & accept pending group join requests
 *
 * $pending              — list all pending join requests (numbered)
 * $accept all           — approve every pending request
 * $accept [n]           — approve request #n from the $pending list
 *
 * Admin-only, group-only.  Bot must be admin.
 */

const isAdmin = require('../lib/isAdmin');

// Per-group cache of the last fetched pending JID list so $accept [n] can
// reference positions without re-fetching.  Invalidated on every $pending
// or $accept call.
const pendingCache = new Map();

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

    // Normalise — Baileys may return objects { jid, requestMethod } or plain strings
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
            `_Use *$accept all* or *$accept [n]* to approve._`,
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
            text: `❌ Usage:\n• *$accept all* — approve all pending requests\n• *$accept 1* — approve request #1\n\n_Run *$pending* first to see the numbered list._`,
        }, { quoted: message });
    }

    // Always fetch a fresh list so we act on live data
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

    // ── Accept all ────────────────────────────────────────────────────────────
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

    // ── Accept by number ──────────────────────────────────────────────────────
    const n = parseInt(arg, 10);
    if (isNaN(n) || n < 1 || n > jids.length) {
        return sock.sendMessage(chatId, {
            text: `❌ *${arg}* is not a valid number.\n\nThere are *${jids.length}* pending request(s) — pick a number between *1* and *${jids.length}*.\n\nRun *$pending* to see the list.`,
        }, { quoted: message });
    }

    const targetJid = jids[n - 1];
    try {
        await sock.groupRequestParticipantsUpdate(chatId, [targetJid], 'approve');
        return sock.sendMessage(chatId, {
            text: [
                `✅ *Request #${n} accepted!*`,
                ``,
                `@${targetJid.split('@')[0]} has been approved to join.`,
                ``,
                `_Daratech_ ⚡`,
            ].join('\n'),
            mentions: [targetJid],
        }, { quoted: message });
    } catch (err) {
        console.error('[accept:n]', err.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to accept request #${n}: ${err.message}` }, { quoted: message });
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
            text: `❌ Usage:\n• *$reject all* — decline all pending requests\n• *$reject 1* — decline request #1\n\n_Run *$pending* first to see the numbered list._`,
        }, { quoted: message });
    }

    // Always fetch a fresh list
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

    // ── Reject all ────────────────────────────────────────────────────────────
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

    // ── Reject by number ──────────────────────────────────────────────────────
    const n = parseInt(arg, 10);
    if (isNaN(n) || n < 1 || n > jids.length) {
        return sock.sendMessage(chatId, {
            text: `❌ *${arg}* is not a valid number.\n\nThere are *${jids.length}* pending request(s) — pick a number between *1* and *${jids.length}*.\n\nRun *$pending* to see the list.`,
        }, { quoted: message });
    }

    const targetJid = jids[n - 1];
    try {
        await sock.groupRequestParticipantsUpdate(chatId, [targetJid], 'reject');
        return sock.sendMessage(chatId, {
            text: [
                `🚫 *Request #${n} rejected.*`,
                ``,
                `@${targetJid.split('@')[0]}'s join request has been declined.`,
                ``,
                `_Daratech_ ⚡`,
            ].join('\n'),
            mentions: [targetJid],
        }, { quoted: message });
    } catch (err) {
        console.error('[reject:n]', err.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to reject request #${n}: ${err.message}` }, { quoted: message });
    }
}

module.exports = { pendingCommand, acceptCommand, rejectCommand };
