'use strict';
/**
 * antileave.js — Notify the group when a member leaves
 * $antileave on/off  → toggle per group (admin only)
 * handleAntiLeave    → called from group-participants.update (remove)
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antileave.json');

// ── Config helpers ────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
    catch (err) { console.error('[antileave] config save:', err.message); }
}
function isEnabled(groupId) {
    return !!loadConfig()[groupId]?.enabled;
}

// ── $antileave command ────────────────────────────────────────────────────────
async function handleAntiLeaveCommand(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId,
            { text: '❌ This command can only be used in groups.' },
            { quoted: message });
    }

    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);

    // Must be admin or owner
    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const me   = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        isAdmin = meta.participants.some(
            p => (p.id === senderId || p.id === me) && p.admin
        );
    } catch {}

    if (!isOwner && !isAdmin) {
        return sock.sendMessage(chatId,
            { text: '❌ Only group admins can use this command.' },
            { quoted: message });
    }

    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.split(' ').slice(1).join(' ').trim().toLowerCase();
    const cfg   = loadConfig();

    if (!match || match === 'status') {
        const on = !!cfg[chatId]?.enabled;
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🚪 *ANTI-LEAVE* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${on ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$antileave on*  — Enable\n` +
                  `┃ ▸ *$antileave off* — Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Posts a farewell message when someone leaves._\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'on') {
        if (cfg[chatId]?.enabled)
            return sock.sendMessage(chatId, { text: '⚠️ Anti-Leave is already *enabled* in this group.' }, { quoted: message });
        cfg[chatId] = { enabled: true };
        saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `✅ *Anti-Leave enabled!*\n\nA farewell message will be sent whenever someone leaves.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'off') {
        if (!cfg[chatId]?.enabled)
            return sock.sendMessage(chatId, { text: '⚠️ Anti-Leave is already *disabled* in this group.' }, { quoted: message });
        cfg[chatId] = { enabled: false };
        saveConfig(cfg);
        return sock.sendMessage(chatId, {
            text: `❌ *Anti-Leave disabled.*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '❌ Unknown option. Use *$antileave on* or *$antileave off*.' },
        { quoted: message });
}

// ── Leave event handler ───────────────────────────────────────────────────────
async function handleAntiLeave(sock, groupId, participants) {
    try {
        if (!isEnabled(groupId)) return;

        let groupName = 'this group';
        try {
            const meta = await sock.groupMetadata(groupId);
            groupName = meta.subject;
        } catch {}

        for (const jid of participants) {
            // Resolve clean number / display
            const clean = jid.replace(/:\d+@/, '@');
            const num   = clean.split('@')[0];
            const display = `+${num}`;

            await sock.sendMessage(groupId, {
                text: `╭━━━「 🚪 *MEMBER LEFT* 」━━━\n` +
                      `┃\n` +
                      `┃ 👤 ${display}\n` +
                      `┃ has left *${groupName}*\n` +
                      `┃\n` +
                      `┃ We'll miss you 💔\n` +
                      `┃\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `_Daratech_ ⚡`,
                mentions: [clean]
            });
        }
    } catch (err) {
        console.error('[antileave]', err.message);
    }
}

module.exports = { handleAntiLeaveCommand, handleAntiLeave };
