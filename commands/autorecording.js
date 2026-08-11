'use strict';
/**
 * autorecording.js — Toggle "recording audio…" presence indicator
 * $autorecording on/off  (owner only)
 * When enabled, bot sends recording presence on every incoming message.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/autorecording.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return { enabled: false }; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

function isEnabled() { return !!loadConfig().enabled; }

// Called from main.js on every message
async function handleAutoRecording(sock, chatId) {
    if (!isEnabled()) return;
    try {
        await sock.sendPresenceUpdate('recording', chatId);
        setTimeout(() => sock.sendPresenceUpdate('available', chatId).catch(() => {}), 3000);
    } catch { /* ignore */ }
}

async function handleAutoRecordingCommand(sock, chatId, senderId, message) {
    const isOwner = isAuthorizedOwnerSession(sock) &&
        (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId));
    if (!isOwner) {
        return sock.sendMessage(chatId,
            { text: '❌ Only the owner can use this command.' },
            { quoted: message });
    }

    const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.trim().split(/\s+/).slice(1).join(' ').trim().toLowerCase();
    const cfg   = loadConfig();

    if (!match || match === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🎙️ *AUTO RECORDING* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$autorecording on*  — Enable\n` +
                  `┃ ▸ *$autorecording off* — Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Shows "recording…" on every message._\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'on') {
        if (cfg.enabled) return sock.sendMessage(chatId, { text: '⚠️ Already *enabled*.' }, { quoted: message });
        cfg.enabled = true; saveConfig(cfg);
        return sock.sendMessage(chatId, { text: '✅ *Auto Recording enabled!*\n\n_Daratech_ ⚡' }, { quoted: message });
    }
    if (match === 'off') {
        if (!cfg.enabled) return sock.sendMessage(chatId, { text: '⚠️ Already *disabled*.' }, { quoted: message });
        cfg.enabled = false; saveConfig(cfg);
        return sock.sendMessage(chatId, { text: '❌ *Auto Recording disabled.*\n\n_Daratech_ ⚡' }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '❌ Use *$autorecording on* or *$autorecording off*.' },
        { quoted: message });
}

module.exports = { handleAutoRecording, handleAutoRecordingCommand, isEnabled };
