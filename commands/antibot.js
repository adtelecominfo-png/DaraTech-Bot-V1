'use strict';
/**
 * antibot.js — Block bot accounts from joining the group
 *
 * When enabled, any participant that joins with a bot-like JID (LID device
 * format or known bot patterns) is automatically removed.
 *
 * $antibot on       — enable protection (auto-kick bots on join)
 * $antibot off      — disable
 * $antibot scan     — scan current members and kick detected bots now
 * $antibot get      — show current config
 * Aliases: $ab
 *
 * Admin-only, group-only. Bot must be admin.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antibot.json');

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
    } catch (e) { console.error('[antibot/save]', e.message); }
}
function getGroupCfg(groupId) { return loadConfig()[groupId] || {}; }
function setGroupFlags(groupId, updates) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    Object.assign(c[groupId], updates);
    saveConfig(c);
}

// Heuristic: JID has a device suffix (bot-hosting platforms use multi-device
// accounts that show up as user:device@s.whatsapp.net or lid-format JIDs)
function looksLikeBot(jid) {
    if (!jid) return false;
    // Multi-device LID bots often have ':N@' suffix
    if (jid.includes(':') && jid.includes('@s.whatsapp.net')) return true;
    // LID format accounts (newer WA multi-device)
    if (jid.endsWith('@lid')) return true;
    return false;
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

async function antibotCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const sub  = raw.split(/\s+/)[1]?.toLowerCase();
    const cfg  = getGroupCfg(chatId);
    const isOn = !!cfg.antibot;

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🤖 *ANTI BOT* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$antibot on*    — Enable auto-kick bots\n` +
                  `┃ ▸ *$antibot off*   — Disable\n` +
                  `┃ ▸ *$antibot scan*  — Kick all bots right now\n` +
                  `┃ ▸ *$antibot get*   — Show status\n` +
                  `┃\n` +
                  `┃ Detects and removes bot accounts\n` +
                  `┃ from the group automatically.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Bot is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antibot: true });
        return sock.sendMessage(chatId, { text: `✅ *Anti Bot enabled!*\n\nBot accounts will be kicked automatically.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Bot is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antibot: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti Bot disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'scan') {
        try {
            const meta  = await sock.groupMetadata(chatId);
            const bots  = meta.participants.filter(p => !p.admin && looksLikeBot(p.id));
            if (bots.length === 0) {
                return sock.sendMessage(chatId, { text: `✅ No bot accounts detected in this group.\n\n_Daratech_ ⚡` }, { quoted: message });
            }
            const botJids = bots.map(b => b.id);
            await sock.groupParticipantsUpdate(chatId, botJids, 'remove');
            return sock.sendMessage(chatId, {
                text: `🤖 *Anti Bot Scan*\n\nKicked *${bots.length}* bot account(s):\n${botJids.map(j => `• @${j.split('@')[0]}`).join('\n')}\n\n_Daratech_ ⚡`,
                mentions: botJids,
            }, { quoted: message });
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Scan failed: ${err.message}` }, { quoted: message });
        }
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antibot* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook — called on group-participants.update ──────────────────────
async function handleAntibotJoin(sock, update) {
    try {
        const { id: chatId, participants, action } = update;
        if (action !== 'add') return;
        if (!chatId?.endsWith('@g.us')) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.antibot) return;

        const bots = participants.filter(looksLikeBot);
        if (bots.length === 0) return;

        await sock.groupParticipantsUpdate(chatId, bots, 'remove');
        await sock.sendMessage(chatId, {
            text: `🤖 *Anti Bot*\n\n${bots.map(j => `@${j.split('@')[0]}`).join(', ')} was removed — bot account detected.\n\n_Daratech_ ⚡`,
            mentions: bots,
        });
    } catch (err) {
        console.error('[antibot/join]', err.message);
    }
}

module.exports = { antibotCommand, handleAntibotJoin };
