'use strict';
/**
 * dnd.js — Do Not Disturb mode
 *
 * When enabled, any message that tags the bot owner is automatically
 * deleted and the sender is notified.
 *
 * $dnd on              — enable DND
 * $dnd off             — disable DND
 * $dnd msg <text>      — set a custom DND reply message
 * $dnd                 — show current status
 *
 * Owner-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const settings      = require('../settings');

const CONFIG_PATH = path.join(__dirname, '../data/dnd.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false, customMsg: null };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return { enabled: false, customMsg: null }; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
    catch (e) { console.error('[dnd/save]', e.message); }
}

async function dndCommand(sock, chatId, senderId, message) {
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner)
        return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: message });

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1);
    const sub  = args[0]?.toLowerCase();
    const cfg  = loadConfig();

    if (!sub) {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🔕 *DO NOT DISTURB* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${cfg.enabled ? '🔴 ON' : '🟢 OFF'}\n` +
                  (cfg.customMsg ? `┃ Message: _${cfg.customMsg}_\n` : '') +
                  `┃\n` +
                  `┃ ▸ *$dnd on*          — Enable\n` +
                  `┃ ▸ *$dnd off*         — Disable\n` +
                  `┃ ▸ *$dnd msg <text>*  — Set custom reply\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        cfg.enabled = true;
        saveConfig(cfg);
        return sock.sendMessage(chatId, { text: `🔕 *DND ON* — Tags and replies to owner will be deleted.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        cfg.enabled = false;
        saveConfig(cfg);
        return sock.sendMessage(chatId, { text: `🔔 *DND OFF* — Owner can now be tagged freely.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'msg') {
        const msg = args.slice(1).join(' ').trim();
        if (!msg) return sock.sendMessage(chatId, { text: '❌ Usage: *$dnd msg <your message>*' }, { quoted: message });
        cfg.customMsg = msg;
        saveConfig(cfg);
        return sock.sendMessage(chatId, { text: `✅ DND message set:\n_${msg}_\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Use *$dnd on/off* or *$dnd msg <text>*.' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
async function handleDND(sock, message) {
    try {
        const cfg = loadConfig();
        if (!cfg.enabled) return;
        if (message.key.fromMe) return;

        const ownerRaw = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
        if (!ownerRaw) return;
        const ownerJid = `${ownerRaw}@s.whatsapp.net`;

        const msg     = message.message;
        if (!msg) return;

        const chatId   = message.key.remoteJid;
        const senderId = message.key.participant || chatId;

        // Get mentioned JIDs from any message type
        const ctx      = msg.extendedTextMessage?.contextInfo ||
                         msg.imageMessage?.contextInfo        ||
                         msg.videoMessage?.contextInfo        ||
                         msg.stickerMessage?.contextInfo      ||
                         msg.documentMessage?.contextInfo;

        const mentions = ctx?.mentionedJid || [];
        const quoted   = ctx?.participant || ctx?.remoteJid;

        const ownerTagged = mentions.some(j => j === ownerJid) || quoted === ownerJid;
        if (!ownerTagged) return;

        // Delete the tagging message
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId }
            });
        } catch {}

        // Send DND notice to the sender
        const notice = cfg.customMsg
            ? cfg.customMsg.replace('{user}', `@${senderId.split('@')[0]}`)
            : `🔕 *Do Not Disturb*\n\n@${senderId.split('@')[0]}, the owner is currently unavailable. Please try later.`;

        await sock.sendMessage(chatId, {
            text: `${notice}\n\n_Daratech_ ⚡`,
            mentions: [senderId],
        });
    } catch (err) {
        console.error('[dnd/detect]', err.message);
    }
}

module.exports = { dndCommand, handleDND };
