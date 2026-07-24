'use strict';
/**
 * alwaysonline.js — Keep the bot appearing permanently online
 *
 * $alwaysonline on   — enable always-online presence
 * $alwaysonline off  — disable, return to normal presence
 * $alwaysonline      — show current status
 *
 * Owner-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/alwaysonline.json');
let   _interval   = null;

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return { enabled: false }; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
    catch (e) { console.error('[alwaysonline/save]', e.message); }
}

function startPresence(sock) {
    if (_interval) return;
    _interval = setInterval(() => {
        sock.sendPresenceUpdate('available').catch(() => {});
    }, 10_000);
}
function stopPresence(sock) {
    if (_interval) { clearInterval(_interval); _interval = null; }
    sock.sendPresenceUpdate('unavailable').catch(() => {});
}

// Called once on bot connect to restore saved state
async function initAlwaysOnline(sock) {
    if (loadConfig().enabled) startPresence(sock);
}

async function alwaysonlineCommand(sock, chatId, senderId, message) {
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner)
        return sock.sendMessage(chatId, { text: '❌ Owner-only command.' }, { quoted: message });

    const raw = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const sub = raw.split(/\s+/)[1]?.toLowerCase();
    const cfg = loadConfig();

    if (!sub) {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🟢 *ALWAYS ONLINE* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$alwaysonline on*  — Enable\n` +
                  `┃ ▸ *$alwaysonline off* — Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (cfg.enabled) return sock.sendMessage(chatId, { text: '⚠️ Already-online is already *enabled*.' }, { quoted: message });
        cfg.enabled = true;
        saveConfig(cfg);
        startPresence(sock);
        return sock.sendMessage(chatId, { text: `✅ *Always Online ENABLED*\n\nBot now appears permanently online.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        if (!cfg.enabled) return sock.sendMessage(chatId, { text: '⚠️ Always-online is already *disabled*.' }, { quoted: message });
        cfg.enabled = false;
        saveConfig(cfg);
        stopPresence(sock);
        return sock.sendMessage(chatId, { text: `✅ *Always Online DISABLED*\n\nBot presence is now normal.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Use *$alwaysonline on* or *$alwaysonline off*.' }, { quoted: message });
}

module.exports = { alwaysonlineCommand, initAlwaysOnline };
