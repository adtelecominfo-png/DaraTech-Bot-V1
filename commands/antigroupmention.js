'use strict';
/**
 * antigroupmention.js — Block @group / @everyone group-wide mentions
 *
 * $antigroupmention on           — enable protection (default action: delete)
 * $antigroupmention off          — disable protection
 * $antigroupmention set delete   — set action to delete
 * $antigroupmention set kick     — set action to kick
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
            text: `╭━━━「 🔇 *ANTI GROUP MENTION* 」━━━\n` +
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
                  `┃ Protects against @group / @everyone\n` +
                  `┃ mass-mention used by non-admins.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-group mention is already *enabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'antigroupmention', true);
        if (!cfg.antigroupmentionAction) setGroupFlag(chatId, 'antigroupmentionAction', 'delete');
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Group Mention enabled!*\n\nNon-admins who use @group or @everyone will have their message *${action}d*.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-group mention is already *disabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'antigroupmention', false);
        return sock.sendMessage(chatId, { text: `✅ *Anti Group Mention disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
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
            text: `✅ *Anti Group Mention action set to ${newAction}!*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$antigroupmention* to see usage.\n\n_Daratech_ ⚡` }, { quoted: message });
}

// ── Detection hook (called for every incoming group message) ──────────────────
async function handleAntigroupmentionMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupConfig(chatId);
        if (!cfg.antigroupmention) return;

        const senderId = message.key.participant || message.key.remoteJid;

        // Check if sender is admin — skip enforcement for admins
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        // Detect @group / @everyone mention
        // In Baileys, group-wide mentions appear as groupMentions or the group JID in mentionedJid
        const ctxInfo      = message.message?.extendedTextMessage?.contextInfo
                          || message.message?.imageMessage?.contextInfo
                          || message.message?.videoMessage?.contextInfo;
        const groupMentions  = ctxInfo?.groupMentions || [];
        const mentionedJids  = ctxInfo?.mentionedJid  || [];

        const isGroupMention = groupMentions.length > 0 || mentionedJids.includes(chatId);
        if (!isGroupMention) return;

        const action = cfg.antigroupmentionAction || 'delete';

        // Delete the message first
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

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                const tag = `@${senderId.split('@')[0]}`;
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti Group Mention*\n\n${tag} was kicked for using @group mention.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else {
            const tag = `@${senderId.split('@')[0]}`;
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Group Mention*\n\n${tag}, @group/@everyone mentions are not allowed here.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antigroupmention/detect]', err.message);
    }
}

module.exports = { antigroupmentionCommand, handleAntigroupmentionMessage };
