'use strict';
const fs   = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const settings      = require('../settings');
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

// ── Detect view-once across ALL known Baileys v7 message shapes ───────────────
// Returns { type:'image'|'video'|'audio', mediaMsg, surrogateMsg } or null
function extractViewOnce(message) {
    const msg = message?.message;
    if (!msg) return null;

    // Helper — create a surrogate message object that downloadMediaMessage can handle
    const surrogate = (content) => ({ key: message.key, message: content });

    // 1. Flat delivery — imageMessage/videoMessage/audioMessage with viewOnce: true
    if (msg.imageMessage?.viewOnce)
        return { type: 'image', mediaMsg: msg.imageMessage, surrogateMsg: surrogate(msg) };
    if (msg.videoMessage?.viewOnce)
        return { type: 'video', mediaMsg: msg.videoMessage, surrogateMsg: surrogate(msg) };
    if (msg.audioMessage?.viewOnce)
        return { type: 'audio', mediaMsg: msg.audioMessage, surrogateMsg: surrogate(msg) };

    // 2. Wrapped: viewOnceMessageV2
    const v2 = msg.viewOnceMessageV2?.message;
    if (v2) {
        if (v2.imageMessage) return { type: 'image', mediaMsg: v2.imageMessage, surrogateMsg: surrogate(v2) };
        if (v2.videoMessage) return { type: 'video', mediaMsg: v2.videoMessage, surrogateMsg: surrogate(v2) };
        if (v2.audioMessage) return { type: 'audio', mediaMsg: v2.audioMessage, surrogateMsg: surrogate(v2) };
    }

    // 3. Wrapped: viewOnceMessageV2Extension
    const v2e = msg.viewOnceMessageV2Extension?.message;
    if (v2e) {
        if (v2e.imageMessage) return { type: 'image', mediaMsg: v2e.imageMessage, surrogateMsg: surrogate(v2e) };
        if (v2e.videoMessage) return { type: 'video', mediaMsg: v2e.videoMessage, surrogateMsg: surrogate(v2e) };
        if (v2e.audioMessage) return { type: 'audio', mediaMsg: v2e.audioMessage, surrogateMsg: surrogate(v2e) };
    }

    // 4. Legacy: viewOnceMessage
    const v1 = msg.viewOnceMessage?.message;
    if (v1) {
        if (v1.imageMessage) return { type: 'image', mediaMsg: v1.imageMessage, surrogateMsg: surrogate(v1) };
        if (v1.videoMessage) return { type: 'video', mediaMsg: v1.videoMessage, surrogateMsg: surrogate(v1) };
        if (v1.audioMessage) return { type: 'audio', mediaMsg: v1.audioMessage, surrogateMsg: surrogate(v1) };
    }

    // 5. Ephemeral-wrapped view-once
    const eph = msg.ephemeralMessage?.message;
    if (eph) {
        if (eph.imageMessage?.viewOnce) return { type: 'image', mediaMsg: eph.imageMessage, surrogateMsg: surrogate(eph) };
        if (eph.videoMessage?.viewOnce) return { type: 'video', mediaMsg: eph.videoMessage, surrogateMsg: surrogate(eph) };
        if (eph.audioMessage?.viewOnce) return { type: 'audio', mediaMsg: eph.audioMessage, surrogateMsg: surrogate(eph) };
        const ev = eph.viewOnceMessage?.message || eph.viewOnceMessageV2?.message;
        if (ev) {
            if (ev.imageMessage) return { type: 'image', mediaMsg: ev.imageMessage, surrogateMsg: surrogate(ev) };
            if (ev.videoMessage) return { type: 'video', mediaMsg: ev.videoMessage, surrogateMsg: surrogate(ev) };
            if (ev.audioMessage) return { type: 'audio', mediaMsg: ev.audioMessage, surrogateMsg: surrogate(ev) };
        }
    }

    return null;
}

// ── $antiviewonce command ─────────────────────────────────────────────────────
async function handleAntiViewOnceCommand(sock, chatId, message, match) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner  = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner)
        return sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });

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
        if (cfg.enabled)
            return sock.sendMessage(chatId, { text: '⚠️ Anti-ViewOnce is already *enabled*.' }, { quoted: message });
        cfg.enabled = true;
        saveConfig(cfg);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👁️ *ANTI-VIEWONCE* 」━━━\n┃\n┃ ✅ *Enabled successfully*\n┃ All view-once media will be\n┃ forwarded to your DM.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (match === 'off') {
        if (!cfg.enabled)
            return sock.sendMessage(chatId, { text: '⚠️ Anti-ViewOnce is already *disabled*.' }, { quoted: message });
        cfg.enabled = false;
        saveConfig(cfg);
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `╭━━━「 👁️ *ANTI-VIEWONCE* 」━━━\n┃\n┃ ❌ *Disabled*\n┃ View-once media will no longer\n┃ be forwarded to your DM.\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId,
        { text: '❌ Unknown option. Use *$antiviewonce on* or *$antiviewonce off*.' },
        { quoted: message });
}

// ── Auto-intercept every incoming message ─────────────────────────────────────
async function handleAntiViewOnce(sock, message) {
    try {
        if (!loadConfig().enabled) return;
        if (message.key.fromMe) return;

        const detected = extractViewOnce(message);
        if (!detected) return;

        const { type, mediaMsg, surrogateMsg } = detected;

        // ── Owner JID to send to ──────────────────────────────────────────────
        const ownerRaw = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
        if (!ownerRaw) return;
        const ownerJid = `${ownerRaw}@s.whatsapp.net`;
        const botJid   = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        // ── Sender resolution ─────────────────────────────────────────────────
        const chatId  = message.key.remoteJid;
        let senderJid = (message.key.participant || chatId || '').replace(/:\d+@/, '@');
        if (senderJid === ownerJid || senderJid === botJid) return;

        let senderDisplay = senderJid.endsWith('@s.whatsapp.net')
            ? `+${senderJid.split('@')[0]}`
            : senderJid.split('@')[0];
        try {
            if (!senderJid.endsWith('@s.whatsapp.net')) {
                const name = await sock.getName(senderJid);
                if (name && !name.includes('@')) senderDisplay = name;
            }
        } catch {}

        // ── Chat label ────────────────────────────────────────────────────────
        let chatLabel = 'Private DM';
        if (chatId.endsWith('@g.us')) {
            try { chatLabel = (await sock.groupMetadata(chatId)).subject || 'Group'; }
            catch { chatLabel = 'Group'; }
        }

        const origCaption = (mediaMsg.caption || '').trim();
        const typeLabel   = type === 'image' ? '🖼️ Image' : type === 'video' ? '🎬 Video' : '🎵 Audio';

        const header =
            `╭━━━「 👁️ *VIEW-ONCE CAPTURED* 」━━━\n` +
            `┃\n` +
            `┃ 📎 *Type:* ${typeLabel}\n` +
            `┃ 👤 *From:* ${senderDisplay}\n` +
            `┃ 💬 *Chat:* ${chatLabel}\n` +
            (origCaption ? `┃ 📝 *Caption:* ${origCaption}\n` : '') +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `_Daratech_ ⚡`;

        // ── Download using downloadMediaMessage (handles all viewonce wrappers) ──
        let buffer;
        try {
            buffer = await downloadMediaMessage(
                surrogateMsg,
                'buffer',
                {},
                { reuploadRequest: sock.updateMediaMessage }
            );
        } catch (dlErr) {
            console.error('[antiviewonce] download failed:', dlErr.message);
            await sock.sendMessage(ownerJid, {
                text: header + `\n\n⚠️ _Media download failed: ${dlErr.message}_`
            });
            return;
        }

        if (!buffer || buffer.length === 0) {
            await sock.sendMessage(ownerJid, {
                text: header + `\n\n⚠️ _Empty buffer — media could not be read._`
            });
            return;
        }

        // ── Forward to owner DM ───────────────────────────────────────────────
        if (type === 'image') {
            await sock.sendMessage(ownerJid, { image: buffer, caption: header });
        } else if (type === 'video') {
            await sock.sendMessage(ownerJid, { video: buffer, caption: header });
        } else {
            await sock.sendMessage(ownerJid, {
                audio: buffer, mimetype: 'audio/mpeg', ptt: false, caption: header
            });
        }

        console.log(`[antiviewonce] ✅ forwarded ${type} from ${senderDisplay} in ${chatLabel}`);

    } catch (err) {
        console.error('[antiviewonce] fatal:', err.message);
    }
}

module.exports = { handleAntiViewOnceCommand, handleAntiViewOnce };
