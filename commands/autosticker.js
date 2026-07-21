'use strict';
/**
 * autosticker.js — Auto-convert images/videos to stickers for non-admins
 *
 * $autosticker on    — enable auto-sticker conversion in this group
 * $autosticker off   — disable
 * $autosticker get   — show current status
 * Aliases: $autos, $asticker
 *
 * Admin-only to toggle. Applies to all non-admin members.
 */

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antimedia.json');

// ── Config helpers ─────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}
function getGroupConfig(groupId) {
    return loadConfig()[groupId] || {};
}
function setGroupFlag(groupId, key, val) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    c[groupId][key] = val;
    saveConfig(c);
}

// ── Auth ───────────────────────────────────────────────────────────────────────
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

// ── Convert buffer → WebP sticker ─────────────────────────────────────────────
function toSticker(buffer, isVideo) {
    return new Promise((resolve, reject) => {
        const tmpDir  = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const inExt  = isVideo ? 'mp4' : 'jpg';
        const inFile  = path.join(tmpDir, `as_in_${Date.now()}.${inExt}`);
        const outFile = path.join(tmpDir, `as_out_${Date.now()}.webp`);

        fs.writeFileSync(inFile, buffer);

        const ffmpegArgs = isVideo
            ? `-t 8 -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -c:v libwebp -lossless 0 -compression_level 6 -q:v 50 -loop 0 -preset default -an -vsync 0`
            : `-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000"`;

        const cmd = `ffmpeg -y -i "${inFile}" ${ffmpegArgs} "${outFile}"`;
        exec(cmd, (err) => {
            try { fs.unlinkSync(inFile); } catch {}
            if (err) {
                try { fs.unlinkSync(outFile); } catch {}
                return reject(err);
            }
            try {
                const result = fs.readFileSync(outFile);
                fs.unlinkSync(outFile);
                resolve(result);
            } catch (e) { reject(e); }
        });
    });
}

// ── Command handler ────────────────────────────────────────────────────────────
async function autostickerCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const sub  = raw.split(/\s+/)[1]?.toLowerCase();

    const cfg  = getGroupConfig(chatId);
    const isOn = !!cfg.autosticker;

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🖼️ *AUTO STICKER* 」━━━\n` +
                  `┃\n` +
                  `┃ Status: ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃\n` +
                  `┃ ▸ *$autosticker on*  — Enable\n` +
                  `┃ ▸ *$autosticker off* — Disable\n` +
                  `┃ ▸ *$autosticker get* — Show status\n` +
                  `┃\n` +
                  `┃ When enabled, images & videos sent\n` +
                  `┃ by non-admins are auto-converted\n` +
                  `┃ to stickers.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Auto sticker is already *enabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'autosticker', true);
        return sock.sendMessage(chatId, {
            text: `✅ *Auto Sticker enabled!*\n\nImages & videos from non-admins will be auto-converted to stickers.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Auto sticker is already *disabled*.' }, { quoted: message });
        setGroupFlag(chatId, 'autosticker', false);
        return sock.sendMessage(chatId, { text: `✅ *Auto Sticker disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: `❓ Unknown option. Use *$autosticker* to see usage.\n\n_Daratech_ ⚡` }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
async function handleAutostickerMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupConfig(chatId);
        if (!cfg.autosticker) return;

        const msg     = message.message;
        const isImage = !!msg?.imageMessage;
        const isVideo = !!msg?.videoMessage;
        if (!isImage && !isVideo) return;

        const senderId = message.key.participant || message.key.remoteJid;

        // Skip admins
        try {
            const meta   = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        // Download + convert
        const buffer = await downloadMediaMessage(message, 'buffer', {}, {
            logger: undefined,
            reuploadRequest: sock.updateMediaMessage,
        });
        if (!buffer) return;

        const webpBuf = await toSticker(buffer, isVideo);

        await sock.sendMessage(chatId, { sticker: webpBuf }, { quoted: message });
    } catch (err) {
        console.error('[autosticker/detect]', err.message);
    }
}

module.exports = { autostickerCommand, handleAutostickerMessage };
