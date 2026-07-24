'use strict';
/**
 * antiforwarding.js — Block forwarded messages in the group
 *
 * $antiforwarding on                — enable (default action: delete)
 * $antiforwarding off               — disable
 * $antiforwarding action delete     — silently delete forwarded messages
 * $antiforwarding action warn       — warn the sender
 * $antiforwarding action kick       — kick the sender
 * $antiforwarding get               — show current config
 * Aliases: $af, $antiforward
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antiforwarding.json');

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
    } catch (e) { console.error('[antiforwarding/save]', e.message); }
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

async function antiforwardingCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw    = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args   = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub    = args[0];
    const cfg    = getGroupCfg(chatId);
    const isOn   = !!cfg.antiforwarding;
    const action = cfg.antiforwardingAction || 'delete';

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 ↩️ *ANTI FORWARDING* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action: *${action}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antiforwarding on*\n` +
                  `┃ ▸ *$antiforwarding off*\n` +
                  `┃ ▸ *$antiforwarding action delete*\n` +
                  `┃ ▸ *$antiforwarding action warn*\n` +
                  `┃ ▸ *$antiforwarding action kick*\n` +
                  `┃ ▸ *$antiforwarding get*\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Forwarding is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antiforwarding: true, antiforwardingAction: action });
        return sock.sendMessage(chatId, { text: `✅ *Anti Forwarding enabled!*\n\nForwarded messages will be *${action}d*.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti-Forwarding is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antiforwarding: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti Forwarding disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'action') {
        const newAction = args[1];
        if (!newAction || !['delete', 'warn', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid action.\n\n▸ *$antiforwarding action delete*\n▸ *$antiforwarding action warn*\n▸ *$antiforwarding action kick*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
        setGroupFlags(chatId, { antiforwardingAction: newAction, antiforwarding: true });
        return sock.sendMessage(chatId, { text: `✅ *Anti Forwarding action set to ${newAction} and enabled!*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antiforwarding* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
function isForwardedMessage(msg) {
    if (!msg) return false;
    // Check contextInfo.isForwarded or forwardingScore > 0 on any message layer
    const layers = [
        msg.extendedTextMessage,
        msg.imageMessage,
        msg.videoMessage,
        msg.audioMessage,
        msg.documentMessage,
        msg.stickerMessage,
        msg.ephemeralMessage?.message?.extendedTextMessage,
        msg.ephemeralMessage?.message?.imageMessage,
        msg.ephemeralMessage?.message?.videoMessage,
    ];
    return layers.some(l => l?.contextInfo?.isForwarded || (l?.contextInfo?.forwardingScore > 0));
}

async function handleAntiForwarding(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.antiforwarding) return;

        if (!isForwardedMessage(message.message)) return;

        const senderId = message.key.participant || chatId;

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        const action = cfg.antiforwardingAction || 'delete';

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
                    text: `🚫 *Anti Forwarding*\n\n${tag} was kicked for forwarding messages.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else if (action === 'warn') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Forwarding*\n\n${tag}, forwarding messages is not allowed in this group.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antiforwarding/detect]', err.message);
    }
}

module.exports = { antiforwardingCommand, handleAntiForwarding };
