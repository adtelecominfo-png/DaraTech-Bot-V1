'use strict';
/**
 * antispam.js — Rate-limit members to prevent flooding
 *
 * Tracks messages per user per group. If a member sends more than `limit`
 * messages within `cooldown` seconds, the configured action is taken.
 *
 * $antispam on                — enable (default: 5 msgs / 10s, action: warn)
 * $antispam off               — disable
 * $antispam action delete     — delete spam messages only
 * $antispam action warn       — warn then kick after maxWarns
 * $antispam action kick       — kick immediately on trigger
 * $antispam limit <n> <secs>  — e.g. $antispam limit 5 10
 * $antispam get               — show current config
 * Aliases: $antisp
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antispam.json');

// In-memory tracker: Map<groupId_senderId, { count, resetAt }>
const tracker = new Map();

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) { console.error('[antispam/save]', e.message); }
}
function getGroupCfg(groupId) { return loadConfig()[groupId] || {}; }
function setGroupFlags(groupId, updates) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    Object.assign(c[groupId], updates);
    saveConfig(c);
}

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

async function antispamCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub  = args[0];
    const cfg  = getGroupCfg(chatId);
    const isOn = cfg.antispam !== false && !!cfg.antispam;
    const action   = cfg.antispamAction   || 'warn';
    const limit    = cfg.antispamLimit    || 5;
    const cooldown = cfg.antispamCooldown || 10;
    const maxWarns = cfg.antispamMaxWarns || 3;

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🛑 *ANTI SPAM* 」━━━\n` +
                  `┃\n` +
                  `┃ Status:   ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action:   *${action}*\n` +
                  `┃ Limit:    *${limit} msgs / ${cooldown}s*\n` +
                  `┃ MaxWarns: *${maxWarns}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antispam on / off*\n` +
                  `┃ ▸ *$antispam action delete|warn|kick*\n` +
                  `┃ ▸ *$antispam limit <msgs> <secs>*\n` +
                  `┃ ▸ *$antispam get*\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Spam is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antispam: true });
        return sock.sendMessage(chatId, { text: `✅ *Anti Spam enabled!*\nLimit: *${limit} msgs / ${cooldown}s*, action: *${action}*.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Spam is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antispam: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti Spam disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'action') {
        const newAction = args[1];
        if (!newAction || !['delete', 'warn', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, { text: `❌ Use: *$antispam action delete|warn|kick*\n\n_Daratech_ ⚡` }, { quoted: message });
        }
        setGroupFlags(chatId, { antispamAction: newAction, antispam: true });
        return sock.sendMessage(chatId, { text: `✅ *Anti Spam action set to ${newAction}!*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'limit') {
        const msgs = parseInt(args[1]);
        const secs = parseInt(args[2]);
        if (!msgs || msgs < 1) return sock.sendMessage(chatId, { text: `❌ Usage: *$antispam limit <msgs> <secs>*\nExample: $antispam limit 5 10\n\n_Daratech_ ⚡` }, { quoted: message });
        setGroupFlags(chatId, { antispamLimit: msgs, antispamCooldown: secs > 0 ? secs : cooldown, antispam: true });
        return sock.sendMessage(chatId, {
            text: `✅ *Spam limit updated:* ${msgs} msgs / ${secs > 0 ? secs : cooldown}s\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antispam* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
async function handleAntiSpam(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.antispam) return;

        const senderId = message.key.participant || chatId;
        const key      = `${chatId}_${senderId}`;
        const limit    = cfg.antispamLimit    || 5;
        const cooldown = (cfg.antispamCooldown || 10) * 1000;
        const now      = Date.now();

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        // Update tracker
        const entry = tracker.get(key) || { count: 0, resetAt: now + cooldown };
        if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + cooldown; }
        entry.count++;
        tracker.set(key, entry);

        if (entry.count < limit) return;

        // Spam detected — reset tracker
        tracker.delete(key);

        const action   = cfg.antispamAction   || 'warn';
        const maxWarns = cfg.antispamMaxWarns  || 3;
        const tag      = `@${senderId.split('@')[0]}`;

        // Always delete the triggering message
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId }
            });
        } catch {}

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti Spam*\n\n${tag} was kicked for flooding the group.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else if (action === 'delete') {
            // Already deleted — no extra message
        } else {
            // warn
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Spam*\n\n${tag}, please stop flooding the group!\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antispam/detect]', err.message);
    }
}

module.exports = { antispamCommand, handleAntiSpam };
