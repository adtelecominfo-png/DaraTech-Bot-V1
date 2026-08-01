'use strict';
/**
 * gcstatus.js — Post text / image / video / audio as a WhatsApp Group Status
 *
 * $gcstatus <text>                    — text status (saved or random color)
 * $gcstatus <text>,<color>            — text status with inline color
 * $gcstatus (reply to image)          — image status
 * $gcstatus (reply to video)          — video status
 * $gcstatus (reply to audio)          — audio status
 * $gcstatus color <name>              — save background color for this group
 * $gcstatus color random              — enable random color for this group
 * $gcstatus color reset               — reset to default purple
 *
 * Admin-only, group-only.
 *
 * Core sending uses prepareWAMessageMedia (not generateWAMessageContent) —
 * this is the correct Baileys path for groupStatusMessageV2 media.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const { PassThrough } = require('stream');

const {
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    downloadContentFromMessage,
    downloadMediaMessage,
    proto,
} = require('@whiskeysockets/baileys');

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIG_PATH = path.join(__dirname, '../data/gcstatus.json');

function loadColors() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveColors(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}
function getGroupColor(groupId) {
    return loadColors()[groupId] ?? null;  // null → random; 'purple' → stored name
}
function setGroupColor(groupId, value) {
    const cfg = loadColors();
    cfg[groupId] = value;
    saveColors(cfg);
}
function resetGroupColor(groupId) {
    const cfg = loadColors();
    delete cfg[groupId];
    saveColors(cfg);
}

// ── Color name → ARGB integer map ────────────────────────────────────────────
// ARGB format: 0xFF<RR><GG><BB>  (alpha always 0xFF = fully opaque)
const COLOR_MAP = {
    purple:   0xFF9C27B0,
    violet:   0xFF7B1FA2,
    pink:     0xFFE91E63,
    hotpink:  0xFFFF4081,
    red:      0xFFF44336,
    orange:   0xFFFF5722,
    amber:    0xFFFF8F00,
    yellow:   0xFFFFC107,
    lime:     0xFF8BC34A,
    green:    0xFF4CAF50,
    teal:     0xFF009688,
    cyan:     0xFF00BCD4,
    blue:     0xFF2196F3,
    navy:     0xFF1565C0,
    indigo:   0xFF3F51B5,
    black:    0xFF212121,
    dark:     0xFF263238,
    grey:     0xFF607D8B,
    white:    0xFFFAFAFA,
    brown:    0xFF795548,
    gold:     0xFFF9A825,
    maroon:   0xFF880E4F,
};

const COLOR_NAMES = Object.keys(COLOR_MAP).join(', ');
const DEFAULT_ARGB = COLOR_MAP.purple;

/** Resolve a color name string → ARGB integer, or null if unknown. */
function resolveArgb(name) {
    const lower = (name || '').toLowerCase().trim();
    if (COLOR_MAP[lower] !== undefined) return COLOR_MAP[lower];
    // bare hex like #9C27B0 or 9C27B0
    const hex = lower.replace('#', '');
    if (/^[0-9a-f]{6}$/.test(hex)) return (0xFF000000 + parseInt(hex, 16)) >>> 0;
    return null;
}

/** Pick the ARGB color for a group, falling back to random or default. */
function pickArgb(groupId, inlineColor) {
    if (inlineColor !== null && inlineColor !== undefined) return inlineColor;

    const saved = getGroupColor(groupId);
    if (saved === 'random' || saved === null) {
        // random vivid color
        const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
        return (0xFF000000 + parseInt(randomHex, 16)) >>> 0;
    }
    return resolveArgb(saved) ?? DEFAULT_ARGB;
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
async function downloadQuotedMedia(quotedMsg, mtype, sock) {
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

    try {
        const fakeMsg = { message: { [mtype]: mediaObj } };
        const buf = await downloadMediaMessage(
            fakeMsg, 'buffer', {},
            { reuploadRequest: sock?.updateMediaMessage }
        );
        if (buf && buf.length) return buf;
    } catch (_) {}

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
// Uses prepareWAMessageMedia (not generateWAMessageContent) — this is the
// correct Baileys path for groupStatusMessageV2 with media.  The reference
// implementation confirms: upload via prepareWAMessageMedia, extract the
// sub-message (imageMessage / videoMessage / audioMessage), wrap in
// groupStatusMessageV2.message, then proto.Message.fromObject() the payload.
// No messageContextInfo / messageSecret is needed.
// Do NOT pass explicit mimetype / jpegThumbnail / dimensions to
// prepareWAMessageMedia — Baileys computes those internally from the buffer,
// and supplying them externally can corrupt the upload or cause silent discard.
async function postGroupStatus(sock, groupId, content) {
    let messagePayload;

    if (content.image || content.video || content.audio) {
        // ── MEDIA path ────────────────────────────────────────────────────────
        let mediaOptions = {};

        if (content.image) {
            mediaOptions = {
                image:   Buffer.isBuffer(content.image) ? content.image : Buffer.from(content.image),
                caption: content.caption || '',
            };
        } else if (content.video) {
            mediaOptions = {
                video:   content.video,
                caption: content.caption || '',
            };
        } else if (content.audio) {
            mediaOptions = {
                audio:    content.audio,
                mimetype: content.mimetype || 'audio/ogg; codecs=opus',
                ptt:      content.ptt ?? true,
            };
            if (content.seconds)  mediaOptions.seconds  = content.seconds;
            if (content.waveform) mediaOptions.waveform = content.waveform;
        }

        const prepared = await prepareWAMessageMedia(
            mediaOptions,
            { upload: sock.waUploadToServer }
        );

        let mediaMessage = {};
        if (content.image)      mediaMessage = { imageMessage:  prepared.imageMessage  };
        else if (content.video) mediaMessage = { videoMessage:  prepared.videoMessage  };
        else if (content.audio) mediaMessage = { audioMessage:  prepared.audioMessage  };

        messagePayload = {
            groupStatusMessageV2: { message: mediaMessage },
        };

    } else {
        // ── TEXT path ─────────────────────────────────────────────────────────
        messagePayload = {
            groupStatusMessageV2: {
                message: {
                    extendedTextMessage: {
                        text:            content.text,
                        backgroundArgb:  content.bgArgb ?? DEFAULT_ARGB,
                        font:            2,
                    },
                },
            },
        };
    }

    const msg = generateWAMessageFromContent(
        groupId,
        proto.Message.fromObject(messagePayload),
        { userJid: sock.user?.id }
    );

    await sock.relayMessage(groupId, msg.message, { messageId: msg.key.id });
    return msg;
}

// ── Main command handler ──────────────────────────────────────────────────────
async function gcstatusCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = raw.split(/\s+/).slice(1);
    const text = args.join(' ').trim();

    // ── $gcstatus color <name|random|reset> ──────────────────────────────────
    if (args[0]?.toLowerCase() === 'color') {
        const val = args[1]?.toLowerCase();

        if (!val) {
            const saved = getGroupColor(chatId);
            const displayName = saved === 'random' ? 'random 🎲' : (saved || 'purple (default)');
            return sock.sendMessage(chatId, {
                text:
                    `╭━━━「 🎨 *GC STATUS COLOR* 」━━━\n` +
                    `┃\n` +
                    `┃ Current: *${displayName}*\n` +
                    `┃\n` +
                    `┃ ▸ *$gcstatus color <name>*   — set color\n` +
                    `┃ ▸ *$gcstatus color random*   — random each time\n` +
                    `┃ ▸ *$gcstatus color reset*    — restore default\n` +
                    `┃\n` +
                    `┃ *Colors:* ${COLOR_NAMES}\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        if (val === 'reset') {
            resetGroupColor(chatId);
            return sock.sendMessage(chatId, {
                text: `🎨 *GC Status color reset* to default *purple*.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        if (val === 'random') {
            setGroupColor(chatId, 'random');
            return sock.sendMessage(chatId, {
                text: `🎲 *GC Status color set to random!*\n\nA new color will be picked each time you post a text status.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        if (!resolveArgb(val)) {
            return sock.sendMessage(chatId, {
                text: `❌ Unknown color *"${val}"*.\n\nAvailable:\n${COLOR_NAMES}\n\nor use *random*.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        setGroupColor(chatId, val);
        return sock.sendMessage(chatId, {
            text: `✅ *GC Status color set to ${val}!*\n\nFuture text statuses in this group will use this color.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    // ── Detect quoted message ─────────────────────────────────────────────────
    const ctxInfo   = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctxInfo?.quotedMessage;
    const mtype     = quotedMsg ? Object.keys(quotedMsg)[0] : null;

    // ── No quoted message → TEXT status ──────────────────────────────────────
    if (!quotedMsg) {
        if (!text) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━━━「 📢 *GROUP STATUS* 」━━━\n` +
                    `┃\n` +
                    `┃ Post content as a group status update.\n` +
                    `┃\n` +
                    `┃ *TEXT STATUS:*\n` +
                    `┃ ▸ $gcstatus <message>\n` +
                    `┃ ▸ $gcstatus <message>,<color>\n` +
                    `┃\n` +
                    `┃ *MEDIA STATUS:*\n` +
                    `┃ ▸ Reply to an image/video/audio\n` +
                    `┃   with *$gcstatus [optional caption]*\n` +
                    `┃\n` +
                    `┃ *COLOR CONTROL:*\n` +
                    `┃ ▸ $gcstatus color red\n` +
                    `┃ ▸ $gcstatus color random\n` +
                    `┃ ▸ $gcstatus color reset\n` +
                    `┃\n` +
                    `┃ *Colors:* ${COLOR_NAMES}\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        // Support inline color: "$gcstatus Hello World,blue"
        let statusText   = text;
        let inlineArgb   = null;
        if (text.includes(',')) {
            const comma = text.lastIndexOf(',');
            const maybeColor = text.slice(comma + 1).trim();
            const resolved   = resolveArgb(maybeColor);
            if (resolved !== null) {
                statusText  = text.slice(0, comma).trim();
                inlineArgb  = resolved;
            }
        }

        await sock.sendMessage(chatId, { text: '📢 _Posting text group status…_' }, { quoted: message });

        try {
            await postGroupStatus(sock, chatId, {
                text:    statusText,
                bgArgb:  pickArgb(chatId, inlineArgb),
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
            buf = await downloadQuotedMedia(quotedMsg, mtype, sock);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download image.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read image data.' }, { quoted: message });

        const imgMime = mtype === 'stickerMessage' ? 'image/webp' : (quotedMsg[mtype]?.mimetype || 'image/jpeg');
        try {
            await postGroupStatus(sock, chatId, {
                image:   buf,
                mimetype: imgMime,
                caption:  text || '',
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
            buf = await downloadQuotedMedia(quotedMsg, mtype, sock);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download video.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read video data.' }, { quoted: message });

        const vidMime = quotedMsg[mtype]?.mimetype || 'video/mp4';
        try {
            await postGroupStatus(sock, chatId, {
                video:    buf,
                mimetype: vidMime,
                caption:  text || '',
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
            buf = await downloadQuotedMedia(quotedMsg, mtype, sock);
        } catch (err) {
            return sock.sendMessage(chatId, { text: `❌ Failed to download audio.\n\n_${err.message}_` }, { quoted: message });
        }
        if (!buf) return sock.sendMessage(chatId, { text: '❌ Could not read audio data.' }, { quoted: message });

        const audioMsg = quotedMsg.audioMessage || {};
        const vn       = await toVoiceNote(buf);

        try {
            await postGroupStatus(sock, chatId, {
                audio:    vn,
                mimetype: 'audio/ogg; codecs=opus',
                ptt:      true,
                seconds:  audioMsg.seconds,
                waveform: audioMsg.waveform,
            });
            return sock.sendMessage(chatId, { text: `✅ *Audio group status posted!*\n\n_Daratech_ ⚡` }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/audio]', err.message);
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post audio status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    return sock.sendMessage(chatId, {
        text: '❌ Unsupported media type. Reply to an *image*, *video*, or *audio* message.\n\n_Daratech_ ⚡'
    }, { quoted: message });
}

module.exports = gcstatusCommand;
