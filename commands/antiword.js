'use strict';
/**
 * antiword.js — Block specific words in the group
 *
 * $antiword on              — enable word filtering
 * $antiword off             — disable
 * $antiword add <word>      — add a banned word
 * $antiword remove <word>   — remove a banned word
 * $antiword list            — show all banned words
 * $antiword clear           — remove all banned words
 * $antiword action delete|warn|kick  — set action
 * $antiword get             — show current config
 * Aliases: $bw, $bannedword
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antiword.json');

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
    } catch (e) { console.error('[antiword/save]', e.message); }
}
function getGroupCfg(groupId) { return loadConfig()[groupId] || { enabled: false, words: [], action: 'delete' }; }
function setGroupData(groupId, data) {
    const c = loadConfig();
    c[groupId] = data;
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

async function antiwordCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1);
    const sub  = args[0]?.toLowerCase();
    const cfg  = getGroupCfg(chatId);

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🚫 *ANTI WORD* 」━━━\n` +
                  `┃\n` +
                  `┃ Status:      ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action:      *${cfg.action || 'delete'}*\n` +
                  `┃ Banned words: *${cfg.words?.length || 0}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antiword on / off*\n` +
                  `┃ ▸ *$antiword add <word>*\n` +
                  `┃ ▸ *$antiword remove <word>*\n` +
                  `┃ ▸ *$antiword list*\n` +
                  `┃ ▸ *$antiword clear*\n` +
                  `┃ ▸ *$antiword action delete|warn|kick*\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        cfg.enabled = true; setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: `✅ *Anti Word enabled!*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'off') {
        cfg.enabled = false; setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: `✅ *Anti Word disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'add') {
        const word = args.slice(1).join(' ').toLowerCase().trim();
        if (!word) return sock.sendMessage(chatId, { text: '❌ Usage: *$antiword add <word>*' }, { quoted: message });
        if (!cfg.words) cfg.words = [];
        if (cfg.words.includes(word)) return sock.sendMessage(chatId, { text: `⚠️ *"${word}"* is already in the list.` }, { quoted: message });
        cfg.words.push(word);
        setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: `✅ Added *"${word}"* to banned words.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'remove') {
        const word = args.slice(1).join(' ').toLowerCase().trim();
        if (!word) return sock.sendMessage(chatId, { text: '❌ Usage: *$antiword remove <word>*' }, { quoted: message });
        if (!cfg.words?.includes(word)) return sock.sendMessage(chatId, { text: `⚠️ *"${word}"* is not in the list.` }, { quoted: message });
        cfg.words = cfg.words.filter(w => w !== word);
        setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: `✅ Removed *"${word}"* from banned words.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'list') {
        if (!cfg.words?.length) return sock.sendMessage(chatId, { text: '📋 No banned words set for this group.' }, { quoted: message });
        return sock.sendMessage(chatId, {
            text: `📋 *Banned Words (${cfg.words.length}):*\n\n${cfg.words.map((w, i) => `${i + 1}. ${w}`).join('\n')}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'clear') {
        cfg.words = []; setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: '✅ All banned words cleared.\n\n_Daratech_ ⚡' }, { quoted: message });
    }

    if (sub === 'action') {
        const newAction = args[1]?.toLowerCase();
        if (!newAction || !['delete', 'warn', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, { text: '❌ Use: *$antiword action delete|warn|kick*' }, { quoted: message });
        }
        cfg.action = newAction; setGroupData(chatId, cfg);
        return sock.sendMessage(chatId, { text: `✅ Action set to *${newAction}*.\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antiword* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
function getMessageText(msg) {
    if (!msg) return '';
    return (
        msg.conversation ||
        msg.extendedTextMessage?.text ||
        msg.imageMessage?.caption ||
        msg.videoMessage?.caption ||
        msg.documentMessage?.caption ||
        ''
    ).toLowerCase();
}

async function handleAntiWord(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.enabled || !cfg.words?.length) return;

        const text = getMessageText(message.message);
        if (!text) return;

        const found = cfg.words.find(w => text.includes(w));
        if (!found) return;

        const senderId = message.key.participant || chatId;

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        const action = cfg.action || 'delete';

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
                    text: `🚫 *Anti Word*\n\n${tag} was kicked for using a banned word.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else if (action === 'warn') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti Word*\n\n${tag}, the word *"${found}"* is not allowed in this group.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
    } catch (err) {
        console.error('[antiword/detect]', err.message);
    }
}

module.exports = { antiwordCommand, handleAntiWord };
