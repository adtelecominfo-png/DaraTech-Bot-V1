'use strict';
/**
 * antigroupmention.js — Block status mentions of the group
 *
 * When someone tags this group in their WhatsApp Status, WhatsApp delivers the
 * message to the group with one or more of these signals:
 *
 *   • message.isMentionedInStatus = true   (the PRIMARY flag — always present)
 *   • message.messageStubType = 210        (WAMessageStubType.STATUS_MENTION)
 *   • message.message.groupStatusMentionMessage (nested proto message)
 *   • message.message.groupMentionedMessage
 *   • message.message.statusMentionMessage
 *
 * The sender (status poster) is in message.key.participant.
 * message.messageStubParameters[0] is also the sender JID for stub messages.
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
const { WAMessageStubType } = require('@whiskeysockets/baileys');

const DATA_DIR    = path.join(__dirname, '../data');
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
        setGroupFlags(chatId, { antigroupmentionAction: newAction, antigroupmention: true });
        return sock.sendMessage(chatId, {
            text: `✅ *Anti Status Mention action set to ${newAction} and enabled!*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$antigroupmention* to see usage.\n\n_Daratech_ ⚡` }, { quoted: message });
}

// ── Detection ─────────────────────────────────────────────────────────────────

/**
 * Determines if this message is a WhatsApp group-status-mention notification.
 *
 * WhatsApp signals this event in multiple ways:
 *   1. message.isMentionedInStatus = true           (PRIMARY flag on WebMessageInfo)
 *   2. messageStubType === 210 / STATUS_MENTION     (stub notification shape)
 *   3. message.message.groupStatusMentionMessage    (proto message shape)
 *   4. message.message.groupMentionedMessage        (older proto shape)
 *   5. message.message.statusMentionMessage         (alternate shape)
 */
function isGroupStatusMention(message) {
    // 1. Primary flag — the most reliable indicator
    if (message.isMentionedInStatus === true) return true;

    // 2. Stub type 210
    const stubType = message.messageStubType;
    if (
        stubType === 210 ||
        stubType === 'STATUS_MENTION' ||
        (WAMessageStubType && stubType === WAMessageStubType.STATUS_MENTION)
    ) return true;

    // 3-5. Nested message proto types
    const msg = message.message;
    if (!msg) return false;

    if (msg.groupStatusMentionMessage) return true;
    if (msg.groupMentionedMessage)     return true;
    if (msg.statusMentionMessage)      return true;

    // Check one level deep (ephemeral / viewOnce wrappers)
    const inner =
        msg.ephemeralMessage?.message         ||
        msg.viewOnceMessage?.message          ||
        msg.viewOnceMessageV2?.message        ||
        msg.documentWithCaptionMessage?.message;

    if (inner) {
        if (inner.groupStatusMentionMessage) return true;
        if (inner.groupMentionedMessage)     return true;
        if (inner.statusMentionMessage)      return true;
    }

    return false;
}

/**
 * Extracts the actual user JID of who posted the status.
 * For group messages and stub messages, this lives in different places.
 */
function extractSenderJid(message) {
    // For group messages: key.participant is the member's JID
    const kp = message.key?.participant;
    if (kp && !kp.endsWith('@g.us')) return kp;

    // For stub messages: params[0] is the member's JID or phone number
    const params = message.messageStubParameters || [];
    if (params.length > 0) {
        const p = params[0];
        if (typeof p === 'string' && p.length > 0) {
            if (!p.endsWith('@g.us')) {
                return p.includes('@') ? p : `${p}@s.whatsapp.net`;
            }
        }
    }

    // Fallback: check message.participant (some Baileys builds set this)
    const mp = message.participant;
    if (mp && !mp.endsWith('@g.us')) return mp;

    return null;
}

// ── Detection hook (called for every incoming message in main.js) ─────────────
async function handleAntigroupmentionMessage(sock, message) {
    try {
        const chatId = message.key?.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;

        const cfg = getGroupConfig(chatId);
        if (!cfg.antigroupmention) return;

        if (!isGroupStatusMention(message)) return;

        const senderId = extractSenderJid(message);
        if (!senderId) {
            console.log('[antigroupmention] Could not extract sender JID — skipping');
            return;
        }

        const botNum = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
        const senderNum = senderId.split(':')[0].split('@')[0];

        // Never act on the bot itself
        if (botNum && senderNum === botNum) return;

        // Skip group admins and bot owner/sudo
        try {
            const meta = await sock.groupMetadata(chatId);
            const member = meta.participants.find(p => p.id.split(':')[0].split('@')[0] === senderNum);
            if (member?.admin) return;
        } catch { return; }

        if (await isOwnerOrSudo(senderId, sock, chatId)) return;

        console.log(`[antigroupmention] ✅ Triggered — sender: ${senderId}, group: ${chatId}`);

        const action = cfg.antigroupmentionAction || 'delete';

        // ── Delete the status-mention notification ──────────────────────────
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid: chatId,
                    fromMe:    false,
                    id:        message.key.id,
                    participant: senderId,
                },
            });
        } catch (delErr) {
            console.error('[antigroupmention/delete]', delErr.message);
        }

        // ── Kick or warn ────────────────────────────────────────────────────
        const tag = `@${senderNum}`;

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti Status Mention*\n\n${tag} was kicked for tagging this group in their WhatsApp Status.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch (kickErr) {
                console.error('[antigroupmention/kick]', kickErr.message);
            }
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
