'use strict';
/**
 * clean.js — Purge recent messages in a group
 *
 * $clean [n]       — delete the bot's last n messages (default 20, max 100)
 * $clean all       — delete bot's last 100 messages
 * $clean (reply)   — delete all recent messages from the replied-to sender
 * Aliases: $purge
 *
 * Admin-only, group-only.
 */

const isOwnerOrSudo = require('../lib/isOwner');

// Small in-memory rolling store: last 200 messages per chat
// (resets on bot restart — that's fine for a purge command)
const recentMessages = new Map(); // chatId → [{key, senderId}]
const MAX_STORED = 200;

function storeForClean(message) {
    const chatId = message.key?.remoteJid;
    if (!chatId?.endsWith('@g.us')) return;
    if (!recentMessages.has(chatId)) recentMessages.set(chatId, []);
    const list = recentMessages.get(chatId);
    list.push({
        key:      message.key,
        senderId: message.key.participant || message.key.remoteJid,
        fromMe:   !!message.key.fromMe,
    });
    if (list.length > MAX_STORED) list.shift();
}

// ── Auth ───────────────────────────────────────────────────────────────────────
async function checkAuth(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Group-only command.' }, { quoted: message });
        return false;
    }
    if (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId)) return true;
    try {
        const meta = await sock.groupMetadata(chatId);
        if (meta.participants.some(p => p.id === senderId && p.admin)) return true;
    } catch {}
    await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
    return false;
}

// ── Command handler ────────────────────────────────────────────────────────────
async function cleanCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1);
    const arg  = args[0]?.toLowerCase();

    const stored = recentMessages.get(chatId) || [];

    // Reply to a message → purge that sender's messages
    const ctxInfo   = message.message?.extendedTextMessage?.contextInfo;
    const quotedPart = ctxInfo?.participant;
    if (quotedPart && !arg) {
        const targets = stored.filter(m => m.senderId === quotedPart).slice(-50);
        if (targets.length === 0) {
            return sock.sendMessage(chatId, {
                text: `❌ No recent cached messages found from that user.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        const notice = await sock.sendMessage(chatId, {
            text: `🗑️ _Deleting ${targets.length} message(s) from @${quotedPart.split('@')[0]}…_`,
            mentions: [quotedPart],
        });

        let deleted = 0;
        for (const m of targets) {
            try {
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: m.fromMe, id: m.key.id, participant: m.senderId },
                });
                deleted++;
                await new Promise(r => setTimeout(r, 120));
            } catch {}
        }

        try { await sock.sendMessage(chatId, { delete: notice.key }); } catch {}
        const done = await sock.sendMessage(chatId, {
            text: `✅ *Deleted ${deleted} message(s).*\n\n_Daratech_ ⚡`
        }, { quoted: message });
        setTimeout(async () => { try { await sock.sendMessage(chatId, { delete: done.key }); } catch {} }, 5000);
        return;
    }

    // Count-based purge of bot's own messages
    const count = arg === 'all' ? 100 : (parseInt(arg, 10) || 20);
    const limit = Math.min(Math.max(count, 1), 100);

    const targets = stored.filter(m => m.fromMe).slice(-limit);
    if (targets.length === 0) {
        return sock.sendMessage(chatId, {
            text: `❌ No recent bot messages cached. Messages are cached after the bot restarts.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    const notice = await sock.sendMessage(chatId, { text: `🗑️ _Clearing ${targets.length} bot message(s)…_` });

    let deleted = 0;
    for (const m of targets) {
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: true, id: m.key.id, participant: m.senderId },
            });
            deleted++;
            await new Promise(r => setTimeout(r, 120));
        } catch {}
    }

    try { await sock.sendMessage(chatId, { delete: notice.key }); } catch {}
    const done = await sock.sendMessage(chatId, {
        text: `✅ *Cleared ${deleted} message(s).*\n\n_Daratech_ ⚡`
    });
    setTimeout(async () => { try { await sock.sendMessage(chatId, { delete: done.key }); } catch {} }, 5000);
}

module.exports = { cleanCommand, storeForClean };
