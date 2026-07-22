'use strict';
/**
 * antigroupmention.js — Block status mentions of the group
 *
 * When someone tags this group in their WhatsApp Status, WhatsApp delivers a
 * statusMentionMessage into the group chat.  This feature detects that and
 * either deletes the notification and/or kicks the person.
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

const CONFIG_PATH = path.join(__dirname, '../data/antimedia.json');

// ── Config helpers ─────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}
function getGroupConfig(groupId) {
    return loadConfig()[groupId] || {};
}
function setGroupFlag(groupId, key, val) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    c[groupId][key] = val;
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

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-status mention is already *enabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'antigroupmention', true);
        if (!cfg.antigroupmentionAction) setGroupFlag(chatId, 'antigroupmentionAction', 'delete');
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Status Mention enabled!*\n\nIf anyone tags this group in their WhatsApp Status, the notification will be *${action}d*.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-status mention is already *disabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'antigroupmention', false);
        return sock.sendMessage(chatId, { text: `✅ *Anti Status Mention disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'set') {
        const newAction = args[1];
        if (!newAction || !['delete', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid action.\n\nUse:\n▸ *$antigroupmention set delete*\n▸ *$antigroupmention set kick*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
        setGroupFlag(chatId, 'antigroupmentionAction', newAction);
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Status Mention action set to ${newAction}!*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$antigroupmention* to see usage.\n\n_Daratech_ ⚡` }, { quoted: message });
}

// ── Detection hook (called for every incoming message) ────────────────────────
async function handleAntigroupmentionMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupConfig(chatId);
        if (!cfg.antigroupmention) return;

        // Detect a WhatsApp Status mention of this group.
        //
        // When someone tags a group in their status, Baileys delivers a
        // statusMentionMessage into the group chat.  Some builds also surface it
        // under extendedTextMessage with groupMentions carrying the group JID.
        const isStatusMention = !!(
            message.message?.statusMentionMessage ||
            message.message?.extendedTextMessage?.contextInfo?.groupMentions?.some(
                gm => (gm.groupJid || gm) === chatId
            )
        );

        if (!isStatusMention) return;

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
