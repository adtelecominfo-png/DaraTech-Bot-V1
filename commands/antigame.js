'use strict';
/**
 * antigame.js — Block game/interactive messages in the group
 *
 * WhatsApp game messages (polls used as games, interactive messages,
 * list-response game flows, native interactive messages) are detected
 * and the configured action is taken.
 *
 * $antigame on              — enable (default action: delete)
 * $antigame off             — disable
 * $antigame action delete   — silently delete
 * $antigame action warn     — warn sender
 * $antigame action kick     — kick sender
 * $antigame get             — show current config
 * Aliases: $antiga
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antigame.json');

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
    } catch (e) { console.error('[antigame/save]', e.message); }
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

async function antigameCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw    = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args   = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub    = args[0];
    const cfg    = getGroupCfg(chatId);
    const isOn   = !!cfg.antigame;
    const action = cfg.antigameAction || 'delete';

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🎮 *ANTI GAME* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action: *${action}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antigame on / off*\n` +
                  `┃ ▸ *$antigame action delete|warn|kick*\n` +
                  `┃ ▸ *$antigame get*\n` +
                  `┃\n` +
                  `┃ Blocks game & interactive messages\n` +
                  `┃ from non-admin members.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Game is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigame: true, antigameAction: action });
        return sock.sendMessage(chatId, { text: `✅ *Anti Game enabled!*\n\nGame messages will be *${action}d*.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Game is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigame: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti Game disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'action') {
        const newAction = args[1];
        if (!newAction || !['delete', 'warn', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, { text: `❌ Use: *$antigame action delete|warn|kick*\n\n_Daratech_ ⚡` }, { quoted: message });
        }
        setGroupFlags(chatId, { antigameAction: newAction, antigame: true });
        return sock.sendMessage(chatId, { text: `✅ *Anti Game action set to ${newAction}!*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antigame* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
function isGameMessage(msg) {
    if (!msg) return false;
    // Native interactive/game message types
    if (msg.interactiveMessage)        return true;
    if (msg.pollCreationMessage)       return true;
    if (msg.pollUpdateMessage)         return true;
    if (msg.listMessage)               return true;
    if (msg.listResponseMessage)       return true;
    if (msg.buttonsMessage)            return true;
    if (msg.buttonsResponseMessage)    return true;
    if (msg.templateMessage)           return true;
    if (msg.gameMessage)               return true;
    // Ephemeral-wrapped
    const ep = msg.ephemeralMessage?.message;
    if (ep && isGameMessage(ep))       return true;
    return false;
}

async function handleAntiGame(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.antigame) return;

        if (!isGameMessage(message.message)) return;

        const senderId = message.key.participant || chatId;

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        const action = cfg.antigameAction || 'delete';

        // Always delete
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId }
            });
        } catch {}

        const tag = `@${senderId.split('@')[0]}`;

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti Game*\n\n${tag} was kicked for sending game messages.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else if (action === 'warn') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Game*\n\n${tag}, game messages are not allowed in this group.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antigame/detect]', err.message);
    }
}

module.exports = { antigameCommand, handleAntiGame };
