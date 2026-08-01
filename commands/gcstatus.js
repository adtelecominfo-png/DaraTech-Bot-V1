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
 */

const fs   = require('fs');
const path = require('path');
const pino = require('pino');

const {
    prepareWAMessageMedia,
    generateWAMessageFromContent,
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
    return loadColors()[groupId] ?? null;
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

const COLOR_NAMES  = Object.keys(COLOR_MAP).join(', ');
const DEFAULT_ARGB = COLOR_MAP.purple;

function resolveArgb(name) {
    const lower = (name || '').toLowerCase().trim();
    if (COLOR_MAP[lower] !== undefined) return COLOR_MAP[lower];
    const hex = lower.replace('#', '');
    if (/^[0-9a-f]{6}$/.test(hex)) return (0xFF000000 + parseInt(hex, 16)) >>> 0;
    return null;
}

function pickArgb(groupId, inlineColor) {
    if (inlineColor !== null && inlineColor !== undefined) return inlineColor;
    const saved = getGroupColor(groupId);
    if (saved === 'random' || saved === null) {
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

// ── Core relay helper ─────────────────────────────────────────────────────────
// IMPORTANT: do NOT wrap payload in proto.Message.fromObject() — that mangles
// the binary fields (mediaKey, fileSha256, fileEncSha256) inside the
// groupStatusMessageV2 envelope, causing media to silently fail on clients.
async function relayGroupStatus(sock, groupId, payload) {
    const generated = generateWAMessageFromContent(
        groupId,
        payload,
        { userJid: sock.user.id }
    );
    await sock.relayMessage(groupId, generated.message, { messageId: generated.key.id });
    return generated;
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
            const saved       = getGroupColor(chatId);
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
    const quotedMsg = ctxInfo?.quotedMessage || null;
    const mtype     = quotedMsg ? Object.keys(quotedMsg)[0] : null;

    // Build a proper targetMessage with the real key so downloadMediaMessage works
    const targetMessage = quotedMsg
        ? {
            key: {
                remoteJid:   chatId,
                id:          ctxInfo.stanzaId,
                participant: ctxInfo.participant,
            },
            message: quotedMsg,
        }
        : message;

    const content = targetMessage.message || {};

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
        let statusText = text;
        let inlineArgb = null;
        if (text.includes(',')) {
            const comma      = text.lastIndexOf(',');
            const maybeColor = text.slice(comma + 1).trim();
            const resolved   = resolveArgb(maybeColor);
            if (resolved !== null) {
                statusText = text.slice(0, comma).trim();
                inlineArgb = resolved;
            }
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        try {
            await relayGroupStatus(sock, chatId, {
                groupStatusMessageV2: {
                    message: {
                        extendedTextMessage: {
                            text:           statusText,
                            backgroundArgb: pickArgb(chatId, inlineArgb),
                            font:           2,
                        },
                    },
                },
            });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `✅ *Text group status posted!*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        } catch (err) {
            console.error('[gcstatus/text]', err);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Failed to post text status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
    }

    // ── MEDIA: IMAGE / STICKER / VIDEO / AUDIO ────────────────────────────────
    const isImage = !!(mtype === 'imageMessage' || mtype === 'stickerMessage');
    const isVideo = mtype === 'videoMessage';
    const isAudio = mtype === 'audioMessage';

    if (!isImage && !isVideo && !isAudio) {
        return sock.sendMessage(chatId, {
            text: '❌ Unsupported media type. Reply to an *image*, *video*, or *audio* message.\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

    try {
        // Download using the real key so re-upload works correctly
        const mediaBuffer = await downloadMediaMessage(
            targetMessage,
            'buffer',
            {},
            {
                logger:          pino({ level: 'silent' }),
                reuploadRequest: sock.updateMediaMessage,
            }
        );

        if (!mediaBuffer || !mediaBuffer.length) throw new Error('Empty media buffer');

        let mediaOptions = {};
        if (isImage) {
            mediaOptions = { image: mediaBuffer, caption: text || '' };
        } else if (isVideo) {
            mediaOptions = { video: mediaBuffer, caption: text || '' };
        } else if (isAudio) {
            mediaOptions = {
                audio:    mediaBuffer,
                mimetype: content.audioMessage?.mimetype || 'audio/mp4',
                ptt:      false,
            };
        }

        if (!sock.waUploadToServer) throw new Error('sock.waUploadToServer is not available');

        const preparedMedia = await prepareWAMessageMedia(mediaOptions, {
            upload: sock.waUploadToServer,
        });

        console.log('[gcstatus] preparedMedia keys:', Object.keys(preparedMedia));
        const subMsg = isImage ? preparedMedia.imageMessage
                     : isVideo ? preparedMedia.videoMessage
                     : preparedMedia.audioMessage;
        console.log('[gcstatus] subMsg url:', subMsg?.url, 'directPath:', subMsg?.directPath,
                    'mediaKey:', subMsg?.mediaKey ? 'present' : 'MISSING',
                    'fileEncSha256:', subMsg?.fileEncSha256 ? 'present' : 'MISSING');

        // proto.Message.fromObject() must wrap the ENTIRE groupStatusMessageV2 payload.
        // relayMessage serialises via protobufjs which needs type metadata to correctly
        // encode nested binary fields (mediaKey, fileSha256, fileEncSha256).
        // Wrapping only the inner message or using a plain object loses that type info.
        let finalMediaMessage = {};
        if (isImage) finalMediaMessage = { imageMessage:  preparedMedia.imageMessage  };
        if (isVideo) finalMediaMessage = { videoMessage:  preparedMedia.videoMessage  };
        if (isAudio) finalMediaMessage = { audioMessage:  preparedMedia.audioMessage  };

        const fullPayload = proto.Message.fromObject({
            groupStatusMessageV2: { message: finalMediaMessage },
        });

        await relayGroupStatus(sock, chatId, fullPayload);

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `✅ *${isImage ? 'Image' : isVideo ? 'Video' : 'Audio'} group status posted!*\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[gcstatus/media]', err);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `❌ Failed to post media status.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = gcstatusCommand;
