'use strict';
/**
 * autoreactstatus.js — Auto-react to contacts' status updates
 * $autoreactstatus on/off [emoji]   (owner only)
 * When enabled, bot reacts to every status update with the configured emoji.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/autoreactstatus.json');
const DEFAULT_EMOJI = '🔥';

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false, emoji: DEFAULT_EMOJI };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return { enabled: false, emoji: DEFAULT_EMOJI }; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}

function isEnabled() { return !!loadConfig().enabled; }
function getEmoji()  { return loadConfig().emoji || DEFAULT_EMOJI; }

// Called from main.js on status updates (messages.upsert where remoteJid = 'status@broadcast')
async function handleAutoReactStatus(sock, message) {
    if (!isEnabled()) return;
    if (message.key.fromMe) return;
    try {
        const emoji = getEmoji();
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch { /* ignore */ }
}

async function handleAutoReactStatusCommand(sock, chatId, senderId, message) {
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner) {
        return sock.sendMessage(chatId,
            { text: '❌ Only the owner can use this command.' },
            { quoted: message });
    }

    const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const parts = text.trim().split(/\s+/).slice(1);
    const match = (parts[0] || '').toLowerCase();
    const emoji = parts[1] || null;
    const cfg   = loadConfig();

    if (!match || match === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 ❤️ *AUTO REACT STATUS* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Emoji:  ${cfg.emoji || DEFAULT_EMOJI}\n` +
                  `┃\n` +
                  `┃ ▸ *$autoreactstatus on*        — Enable\n` +
                  `┃ ▸ *$autoreactstatus on 🔥*    — Enable with emoji\n` +
                  `┃ ▸ *$autoreactstatus off*       — Disable\n` +
                  `┃ ▸ *$autoreactstatus emoji 😍* — Change emoji\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'on') {
        cfg.enabled = true;
        if (emoji) cfg.emoji = emoji;
        saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `✅ *Auto React Status enabled!*\nReacting with: ${cfg.emoji}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
    if (match === 'off') {
        cfg.enabled = false; saveConfig(cfg);
        return sock.sendMessage(chatId, { text: '❌ *Auto React Status disabled.*\n\n_Daratech_ ⚡' }, { quoted: message });
    }
    if (match === 'emoji' && emoji) {
        cfg.emoji = emoji; saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `✅ *Reaction emoji set to:* ${emoji}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '❌ Use *$autoreactstatus on/off* or *$autoreactstatus emoji <emoji>*.' },
        { quoted: message });
}

module.exports = { handleAutoReactStatus, handleAutoReactStatusCommand };
