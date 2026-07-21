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

        // Skip the bot's own outgoing messages
        if (message.key.fromMe) return;

        const msg = message.message;
        if (!msg) return;

        // ── Detect view-once — all known Baileys v7 structures ────────────────
        // Wrapped: viewOnceMessageV2 / viewOnceMessageV2Extension / viewOnceMessage
        // Flat:    imageMessage / videoMessage with viewOnce: true (Baileys auto-unwrap)
        let imgMsg   = null;
        let videoMsg = null;

        const voContainer =
            msg.viewOnceMessageV2?.message ||
            msg.viewOnceMessageV2Extension?.message ||
            msg.viewOnceMessage?.message;

        if (voContainer) {
            imgMsg   = voContainer.imageMessage  || null;
            videoMsg = voContainer.videoMessage  || null;
        } else {
            if (msg.imageMessage?.viewOnce) imgMsg   = msg.imageMessage;
            if (msg.videoMessage?.viewOnce) videoMsg = msg.videoMessage;
        }

        if (!imgMsg && !videoMsg) return;

        // ── Owner JID — who to send the captured media to ─────────────────────
        const ownerRaw = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
        if (!ownerRaw) return;
        const ownerJid = `${ownerRaw}@s.whatsapp.net`;

        // Bot's own JID — to skip forwarding the owner's own view-once
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // ── Resolve sender ────────────────────────────────────────────────────
        const chatId  = message.key.remoteJid;
        let senderJid = (message.key.participant || chatId || '').replace(/:\d+@/, '@');

        // Don't loop — skip if sender is the owner or the bot itself
        if (senderJid === ownerJid || senderJid === botJid) return;

        let senderDisplay;
        if (senderJid.endsWith('@s.whatsapp.net')) {
            senderDisplay = `+${senderJid.split('@')[0]}`;
        } else {
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

        const type        = imgMsg ? 'image' : 'video';
        const content     = imgMsg || videoMsg;
        const origCaption = (content.caption || '').trim();

        const header =
            `╭━━━「 👁️ *VIEW-ONCE CAPTURED* 」━━━\n` +
            `┃\n` +
            `┃ 📎 *Type:* ${type === 'image' ? '🖼️ Image' : '🎬 Video'}\n` +
            `┃ 👤 *From:* ${senderDisplay}\n` +
            `┃ 💬 *Chat:* ${chatLabel}\n` +
            (origCaption ? `┃ 📝 *Caption:* ${origCaption}\n` : '') +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `_Daratech_ ⚡`;

        // ── Download & forward ────────────────────────────────────────────────
        try {
            const stream = await downloadContentFromMessage(content, type);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const buffer = Buffer.concat(chunks);

            if (type === 'image') {
                await sock.sendMessage(ownerJid, { image: buffer, caption: header });
            } else {
                await sock.sendMessage(ownerJid, { video: buffer, caption: header });
            }

            console.log(`[antiviewonce] ✅ forwarded ${type} from ${senderDisplay} in ${chatLabel}`);

        } catch (dlErr) {
            // Download failed — still notify owner with text so they know it happened
            console.error('[antiviewonce] download failed:', dlErr.message);
            await sock.sendMessage(ownerJid, {
                text: header + `\n\n⚠️ _Media download failed: ${dlErr.message}_`
            });
        }

    } catch (err) {
        console.error('[antiviewonce] fatal:', err.message);
    }
}

module.exports = { handleAntiViewOnceCommand, handleAntiViewOnce };
