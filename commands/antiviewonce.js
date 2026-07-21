'use strict';
const fs   = require('fs');
const path = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings  = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antiviewonce.json');

// ── Config helpers ────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return { enabled: false };
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return { enabled: false }; }
}

function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); }
    catch (err) { console.error('[antiviewonce] config save:', err.message); }
}

// ── $antiviewonce command ─────────────────────────────────────────────────────
async function handleAntiViewOnceCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner  = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner) {
        return sock.sendMessage(chatId,
            { text: '❌ Only the owner can use this command.' },
            { quoted: message });
    }

    const cfg = loadConfig();

    if (!match || match === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👁️ *ANTI-VIEWONCE* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${cfg.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$antiviewonce on*  — Enable\n` +
                  `┃ ▸ *$antiviewonce off* — Disable\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Every view-once sent in any chat will be forwarded to your DM instantly._\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'on') {
        if (cfg.enabled) {
            return sock.sendMessage(chatId,
                { text: '⚠️ Anti-ViewOnce is already *enabled*.' },
                { quoted: message });
        }
        cfg.enabled = true;
        saveConfig(cfg);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👁️ *ANTI-VIEWONCE* 」━━━\n` +
                  `┃\n` +
                  `┃ ✅ *Enabled successfully*\n` +
                  `┃ All view-once media will be\n` +
                  `┃ forwarded to your DM.\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'off') {
        if (!cfg.enabled) {
            return sock.sendMessage(chatId,
                { text: '⚠️ Anti-ViewOnce is already *disabled*.' },
                { quoted: message });
        }
        cfg.enabled = false;
        saveConfig(cfg);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👁️ *ANTI-VIEWONCE* 」━━━\n` +
                  `┃\n` +
                  `┃ ❌ *Disabled*\n` +
                  `┃ View-once media will no longer\n` +
                  `┃ be forwarded to your DM.\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '❌ Unknown option. Use *$antiviewonce on* or *$antiviewonce off*.' },
        { quoted: message });
}

// ── Auto-intercept on every incoming message ──────────────────────────────────
async function handleAntiViewOnce(sock, message) {
    try {
        const cfg = loadConfig();
        if (!cfg.enabled) return;

        // Detect view-once wrapper (v2 and legacy)
        const voMsg =
            message.message?.viewOnceMessageV2?.message ||
            message.message?.viewOnceMessage?.message;
        if (!voMsg) return;

        const imgMsg   = voMsg.imageMessage;
        const videoMsg = voMsg.videoMessage;
        if (!imgMsg && !videoMsg) return;

        // ── Resolve sender display ────────────────────────────────────────────
        const chatId   = message.key.remoteJid;
        let senderJid  = message.key.participant || message.key.remoteJid || '';

        // Strip device suffix e.g. 234801234:0@s.whatsapp.net → 2348012345@s.whatsapp.net
        senderJid = senderJid.replace(/:\d+@/, '@');

        let senderDisplay;
        if (senderJid.endsWith('@s.whatsapp.net')) {
            senderDisplay = `+${senderJid.split('@')[0]}`;
        } else {
            // LID — try contacts store
            try {
                const name = await sock.getName(senderJid);
                senderDisplay = (name && !name.includes('@')) ? name : senderJid.split('@')[0];
            } catch {
                senderDisplay = senderJid.split('@')[0];
            }
        }

        // ── Resolve chat label ────────────────────────────────────────────────
        let chatLabel = 'Private DM';
        if (chatId.endsWith('@g.us')) {
            try {
                const meta = await sock.groupMetadata(chatId);
                chatLabel  = meta.subject || 'Group';
            } catch { chatLabel = 'Group'; }
        }

        // ── Owner JID ─────────────────────────────────────────────────────────
        const ownerRaw = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
        if (!ownerRaw) return;
        const ownerJid = `${ownerRaw}@s.whatsapp.net`;

        // Don't forward the owner's own view-once back to themselves
        if (senderJid === ownerJid || message.key.fromMe) return;

        // ── Download & forward ────────────────────────────────────────────────
        const type       = imgMsg ? 'image' : 'video';
        const content    = imgMsg || videoMsg;
        const origCaption = (content.caption || '').trim();

        const stream = await downloadContentFromMessage(content, type);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        const caption =
            `╭━━━「 👁️ *VIEW-ONCE CAPTURED* 」━━━\n` +
            `┃\n` +
            `┃ 📎 *Type:* ${type === 'image' ? '🖼️ Image' : '🎬 Video'}\n` +
            `┃ 👤 *From:* ${senderDisplay}\n` +
            `┃ 💬 *Chat:* ${chatLabel}\n` +
            (origCaption ? `┃ 💬 *Caption:* ${origCaption}\n` : '') +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `_Daratech_ ⚡`;

        if (type === 'image') {
            await sock.sendMessage(ownerJid, { image: buffer, caption });
        } else {
            await sock.sendMessage(ownerJid, { video: buffer, caption });
        }

    } catch (err) {
        console.error('[antiviewonce]', err.message);
    }
}

module.exports = { handleAntiViewOnceCommand, handleAntiViewOnce };
