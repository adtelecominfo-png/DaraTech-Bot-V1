'use strict';
/**
 * gcstatus.js — Post text / image / video / audio as a WhatsApp Group Status
 *
 * $gcstatus <text>              — post a text status (uses saved color or default purple)
 * $gcstatus (reply to image)   — post image as group status
 * $gcstatus (reply to video)   — post video as group status
 * $gcstatus (reply to audio)   — post audio as group status
 * $gcstatus color #hex         — save a custom background color for text statuses in this group
 * $gcstatus color reset        — reset color back to default purple
 *
 * Admin-only, group-only.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { PassThrough } = require('stream');

const {
    generateWAMessageContent,
    generateWAMessageFromContent,
    downloadContentFromMessage,
} = require('@whiskeysockets/baileys');

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_COLOR = '#9C27B0'; // purple
const CONFIG_PATH   = path.join(__dirname, '../data/gcstatus.json');

function loadColors() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveColors(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}
function getColor(groupId) {
    return loadColors()[groupId] || DEFAULT_COLOR;
}
function setColor(groupId, color) {
    const cfg = loadColors();
    cfg[groupId] = color;
    saveColors(cfg);
}
function resetColor(groupId) {
    const cfg = loadColors();
    delete cfg[groupId];
    saveColors(cfg);
}

// ── Auth helper ───────────────────────────────────────────────────────────────
const isOwnerOrSudo = require('../lib/isOwner');

async function checkAuth(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ *$gcstatus* is a group-only command.' }, { quoted: message });
        return false;
    }
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (isOwner) return true;
    try {
        const meta = await sock.groupMetadata(chatId);
        if (meta.participants.some(p => p.id === senderId && p.admin)) return true;
    } catch {}
    await sock.sendMessage(chatId, { text: '❌ Only group admins can use *$gcstatus*.' }, { quoted: message });
    return false;
}

// ── Download quoted media buffer ──────────────────────────────────────────────
async function downloadQuotedMedia(quotedMsg, mtype) {
    const typeMap = {
        imageMessage:   'image',
        videoMessage:   'video',
        audioMessage:   'audio',
        stickerMessage: 'sticker',
    };
    const dlType = typeMap[mtype];
    if (!dlType) return null;

    const mediaObj = quotedMsg[mtype];
    if (!mediaObj) return null;

    const stream = await downloadContentFromMessage(mediaObj, dlType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

// ── Convert audio to OGG/Opus voice note ─────────────────────────────────────
function toVoiceNote(buffer) {
    return new Promise((resolve) => {
        try {
            const ffmpeg = require('fluent-ffmpeg');
            const input  = new PassThrough();
            const output = new PassThrough();
            const chunks = [];

            input.end(buffer);

            ffmpeg(input)
                .noVideo()
                .audioCodec('libopus')
                .format('ogg')
                .audioChannels(1)
                .audioFrequency(48000)
                .on('error', () => resolve(buffer))
                .on('end',   () => resolve(Buffer.concat(chunks)))
                .pipe(output);

            output.on('data', c => chunks.push(c));
        } catch {
            resolve(buffer);
        }
    });
}

// ── Core group-status sender ──────────────────────────────────────────────────
async function postGroupStatus(sock, groupId, content) {
    const bgColor = content._bgColor || DEFAULT_COLOR;
    delete content._bgColor;

    // Build inner message content (handles upload of image/video/audio buffers)
    const inside = await generateWAMessageContent(content, {
        upload: sock.waUploadToServer,
        backgroundColor: bgColor,
    });

    const secret = crypto.randomBytes(32);

    const msg = generateWAMessageFromContent(
        groupId,
        {
            messageContextInfo: { messageSecret: secret },
            groupStatusMessageV2: {
                message: {
                    ...inside,
                    messageContextInfo: { messageSecret: secret },
                },
            },
        },
        {}
    );

    await sock.relayMessage(groupId, msg.message, { messageId: msg.key.id });
    return msg;
}

// ── Validate hex color ────────────────────────────────────────────────────────
function isValidHex(str) {
    return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(str);
}

// ── Main command handler ──────────────────────────────────────────────────────
async function gcstatusCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1); // remove $gcstatus prefix
    const text = args.join(' ').trim();

    // ── $gcstatus color #hex | reset ─────────────────────────────────────────
    if (args[0]?.toLowerCase() === 'color') {
        const val = args[1]?.toLowerCase();

        if (!val) {
            const cur = getColor(chatId);
            return sock.sendMessage(chatId, {
                text: `╭━━━「 🎨 *GC STATUS COLOR* 」━━━\n` +
                      `┃\n` +
                      `┃ Current color: *${cur}*\n` +
                      `┃ (${cur === DEFAULT_COLOR ? 'default purple' : 'custom'})\n` +
                      `┃\n` +
                      `┃ ▸ *$gcstatus color #HEX*  — set color\n` +
                      `┃ ▸ *$gcstatus color reset* — restore default\n` +
                      `┃\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        if (val === 'reset') {
            resetColor(chatId);
            return sock.sendMessage(chatId, {
                text: `🎨 *GC Status color reset* to default purple (*${DEFAULT_COLOR}*).\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        const hex = args[1]; // preserve original case for hex
        if (!isValidHex(hex)) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid color. Use a hex code like *#FF5733* or *#9C27B0*.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        setColor(chatId, hex);
        return sock.sendMessage(chatId, {
            text: `✅ *GC Status color set to ${hex}!*\n\nAll future text statuses in this group will use this color.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    // ── Detect quoted message ─────────────────────────────────────────────────
    const ctxInfo    = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg  = ctxInfo?.quotedMessage;
    const mtype      = quotedMsg ? Object.keys(quotedMsg)[0] : null;

    // ── No quoted message → TEXT status ──────────────────────────────────────
    if (!quotedMsg) {
        if (!text) {
            return sock.sendMessage(chatId, {
                text: `╭━━━「 📢 *GROUP STATUS* 」━━━\n` +
                      `┃\n` +
                      `┃ Post content as a group status update.\n` +
                      `┃\n` +
                      `┃ *TEXT STATUS:*\n` +
                      `┃ ▸ $gcstatus <your message>\n` +
                      `┃\n` +
                      `┃ *MEDIA STATUS:*\n` +
                      `┃ ▸ Reply to an image/video/audio\n` +
                      `┃   with *$gcstatus [optional caption]*\n` +
                      `┃\n` +
                      `┃ *CUSTOM COLOR (text only):*\n` +
                      `┃ ▸ $gcstatus color #FF5733\n` +
                      `┃ ▸ $gcstatus color reset\n` +
                      `┃\n` +
                      `┃ Default color: 🟣 Purple\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '📢 _Posting text group status…_' }, { quoted: message });

        try {
            await postGroupStatus(sock, chatId, {
                text,
                _bgColor: getColor(chatId),
            });
            return sock.sendMessage(chatId, {
                text: `✅ *Text group status posted!*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/text]', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post text status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    // ── IMAGE / STICKER ───────────────────────────────────────────────────────
    if (mtype === 'imageMessage' || mtype === 'stickerMessage') {
        await sock.sendMessage(chatId, { text: '📢 _Posting image group status…_' }, { quoted: message });

        let buf;
        try {
            buf = await downloadQuotedMedia(quotedMsg, mtype);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download image.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read image data.' }, { quoted: message });

        try {
            await postGroupStatus(sock, chatId, {
                image:   buf,
                caption: text || '',
            });
            return sock.sendMessage(chatId, { text: `✅ *Image group status posted!*\n\n_Daratech_ ⚡` }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/image]', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post image status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    // ── VIDEO ─────────────────────────────────────────────────────────────────
    if (mtype === 'videoMessage') {
        await sock.sendMessage(chatId, { text: '📢 _Posting video group status…_' }, { quoted: message });

        let buf;
        try {
            buf = await downloadQuotedMedia(quotedMsg, mtype);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download video.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read video data.' }, { quoted: message });

        try {
            await postGroupStatus(sock, chatId, {
                video:   buf,
                caption: text || '',
            });
            return sock.sendMessage(chatId, { text: `✅ *Video group status posted!*\n\n_Daratech_ ⚡` }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/video]', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post video status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    // ── AUDIO ─────────────────────────────────────────────────────────────────
    if (mtype === 'audioMessage') {
        await sock.sendMessage(chatId, { text: '📢 _Posting audio group status…_' }, { quoted: message });

        let buf;
        try {
            buf = await downloadQuotedMedia(quotedMsg, mtype);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download audio.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read audio data.' }, { quoted: message });

        // Convert to OGG/Opus voice note format
        const vn = await toVoiceNote(buf);

        try {
            await postGroupStatus(sock, chatId, {
                audio:    vn,
                mimetype: 'audio/ogg; codecs=opus',
                ptt:      true,
            });
            return sock.sendMessage(chatId, { text: `✅ *Audio group status posted!*\n\n_Daratech_ ⚡` }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/audio]', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post audio status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    // ── Unsupported type ──────────────────────────────────────────────────────
    return sock.sendMessage(chatId, {
        text: '❌ Unsupported media type. Reply to an *image*, *video*, or *audio* message.\n\n_Daratech_ ⚡'
    }, { quoted: message });
}

module.exports = gcstatusCommand;
