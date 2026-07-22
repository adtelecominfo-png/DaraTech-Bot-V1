'use strict';
/**
 * antigroupmention.js — Block status mentions of the group
 *
 * When someone tags this group in their WhatsApp Status, WhatsApp delivers a
 * statusMentionMessage (or wraps it inside ephemeralMessage / viewOnceMessage,
 * or puts the group JID in extendedTextMessage.contextInfo.groupMentions).
 * This feature detects all those variants and either deletes the notification
 * and/or kicks the person.
 *
 * $antigroupmention on           — enable protection (default action: delete)
 * $antigroupmention off          — disable protection
 * $antigroupmention set delete   — delete the status-mention notification
 * $antigroupmention set kick     — kick the person who mentioned the group
 * $antigroupmention get          — show current config
 * Aliases: $agm
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const DATA_DIR   = path.join(__dirname, '../data');
const CONFIG_PATH = path.join(DATA_DIR, 'antimedia.json');

// ── Config helpers ─────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function saveConfig(cfg) {
    try {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) {
        console.error('[antigroupmention/saveConfig]', e.message);
    }
}
function getGroupConfig(groupId) {
    return loadConfig()[groupId] || {};
}
function setGroupFlags(groupId, updates) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    Object.assign(c[groupId], updates);
    saveConfig(c);
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
async function antigroupmentionCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub  = args[0];

    const cfg    = getGroupConfig(chatId);
    const isOn   = !!cfg.antigroupmention;
    const action = cfg.antigroupmentionAction || 'delete';

    // ── get / status / no arg ──────────────────────────────────────────────────
    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🔇 *ANTI STATUS MENTION* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action: *${action}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antigroupmention on*\n` +
                  `┃ ▸ *$antigroupmention off*\n` +
                  `┃ ▸ *$antigroupmention set delete*\n` +
                  `┃ ▸ *$antigroupmention set kick*\n` +
                  `┃ ▸ *$antigroupmention get*\n` +
                  `┃\n` +
                  `┃ Protects against members tagging\n` +
                  `┃ this group in their WhatsApp Status.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    // ── on ─────────────────────────────────────────────────────────────────────
    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-status mention is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigroupmention: true, antigroupmentionAction: action });
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Status Mention enabled!*\n\nIf anyone tags this group in their WhatsApp Status, the notification will be *${action}d*.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    // ── off ────────────────────────────────────────────────────────────────────
    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-status mention is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigroupmention: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti Status Mention disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    // ── set ────────────────────────────────────────────────────────────────────
    if (sub === 'set') {
        const newAction = args[1];
        if (!newAction || !['delete', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid action.\n\nUse:\n▸ *$antigroupmention set delete*\n▸ *$antigroupmention set kick*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
        // Auto-enable when setting an action (matches reference logic)
        setGroupFlags(chatId, { antigroupmentionAction: newAction, antigroupmention: true });
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Status Mention action set to ${newAction} and enabled!*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$antigroupmention* to see usage.\n\n_Daratech_ ⚡` }, { quoted: message });
}

// ── Detection helpers ──────────────────────────────────────────────────────────

/**
 * Unwrap nested message wrappers that Baileys uses:
 *   ephemeralMessage → message
 *   viewOnceMessage  → message
 *   documentWithCaptionMessage → message
 * Returns the innermost message object.
 */
function unwrapMessage(msg) {
    if (!msg) return null;
    return (
        msg.ephemeralMessage?.message     ||
        msg.viewOnceMessage?.message      ||
        msg.viewOnceMessageV2?.message    ||
        msg.documentWithCaptionMessage?.message ||
        msg
    );
}

/**
 * Returns true if this message is a WhatsApp Status group-mention notification.
 *
 * Baileys can deliver it in several shapes depending on the WA version:
 *  1. message.message.statusMentionMessage            (most common)
 *  2. unwrapped inner message has statusMentionMessage
 *  3. extendedTextMessage.contextInfo.groupMentions[] contains the group JID
 *  4. Any contextInfo.groupMentions[] on any unwrapped layer
 */
function isStatusMention(message, chatId) {
    const outer = message.message;
    if (!outer) return false;

    // Shape 1 — direct statusMentionMessage
    if (outer.statusMentionMessage) return true;

    // Shape 2 — wrapped inside ephemeral/viewOnce/etc.
    const inner = unwrapMessage(outer);
    if (inner && inner !== outer && inner.statusMentionMessage) return true;

    // Shape 3 / 4 — groupMentions in contextInfo (any layer)
    const matchesGroup = (gm) => {
        const jid = typeof gm === 'string' ? gm : (gm.groupJid || gm.jid || '');
        return jid === chatId || jid.split('@')[0] === chatId.split('@')[0];
    };

    const checkGroupMentions = (msgObj) => {
        if (!msgObj) return false;
        const ctx = msgObj.extendedTextMessage?.contextInfo ||
                    msgObj.imageMessage?.contextInfo         ||
                    msgObj.videoMessage?.contextInfo         ||
                    msgObj.stickerMessage?.contextInfo       ||
                    msgObj.documentMessage?.contextInfo;
        return !!(ctx?.groupMentions?.some(matchesGroup));
    };

    if (checkGroupMentions(outer)) return true;
    if (inner && inner !== outer && checkGroupMentions(inner)) return true;

    return false;
}

// ── Detection hook (called for every incoming message) ────────────────────────
async function handleAntigroupmentionMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupConfig(chatId);
        if (!cfg.antigroupmention) return;

        if (!isStatusMention(message, chatId)) return;

        const senderId = message.key.participant || message.key.remoteJid;

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        const action = cfg.antigroupmentionAction || 'delete';

        // Always delete the status-mention notification from the group
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe: false,
                    id: message.key.id,
                    participant: senderId,
                },
            });
        } catch {}

        const tag = `@${senderId.split('@')[0]}`;

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti Status Mention*\n\n${tag} was kicked for tagging this group in their WhatsApp Status.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Status Mention*\n\n${tag}, tagging this group in your WhatsApp Status is not allowed here.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antigroupmention/detect]', err.message);
    }
}

module.exports = { antigroupmentionCommand, handleAntigroupmentionMessage };
