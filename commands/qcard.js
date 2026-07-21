'use strict';
/**
 * $q / $qcard — Telegram-style quote card sticker
 *
 * Reply to any text message with $q to generate a quote sticker.
 * Rendered via the zquote API — same design as the reference implementation.
 *
 * Flow: POST {username, text, avatar} → get image URL → download → ffmpeg → webpmux sticker
 */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { exec } = require('child_process');
const axios   = require('axios');
const webp    = require('node-webpmux');

let jidDecode, jidNormalizeUser;
try {
    ({ jidDecode, jidNormalizeUser } = require('@whiskeysockets/baileys'));
} catch {}

// ── Config ────────────────────────────────────────────────────────────────────
const API_URL  = 'https://zquote.onrender.com/api/quote';
const TMP      = path.join(process.cwd(), 'tmp');

// ── Shell helper ──────────────────────────────────────────────────────────────
function sh(cmd) {
    return new Promise((res, rej) =>
        exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (e, out, err) =>
            e ? rej(new Error(err || e.message)) : res(out)));
}

function cleanup(...files) {
    for (const f of files) try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
}

function tmpFile(suffix) {
    return path.join(TMP, `qcard_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${suffix}`);
}

// ── Normalise JID (handles @lid / @s.whatsapp.net / @c.us) ───────────────────
function normalizeJid(jid) {
    if (!jid) return null;
    try {
        const decoded = jidDecode ? jidDecode(jid) : null;
        if (!decoded) return jid;

        const { user, server } = decoded;

        // LID — try reverse-mapping file written by some Baileys forks
        if (server === 'lid' || server === 'hosted.lid') {
            const reverseFile = path.join(process.cwd(), 'session', `lid-mapping-${user}_reverse.json`);
            try {
                if (fs.existsSync(reverseFile)) {
                    const mapped = JSON.parse(fs.readFileSync(reverseFile, 'utf8'));
                    if (mapped && /^[0-9]{10,19}$/.test(mapped)) return `${mapped}@s.whatsapp.net`;
                }
            } catch {}
            return jid; // keep as-is; avatar fetch will just fail gracefully
        }

        if (server === 's.whatsapp.net' || server === 'c.us') return `${user}@s.whatsapp.net`;
        return jid;
    } catch {
        return jid;
    }
}

// ── Display name resolution ───────────────────────────────────────────────────
async function getDisplayName(sock, quotedSender, contextInfo, chatId) {
    const normalized = normalizeJid(quotedSender) || quotedSender;

    // 1. Bot's in-memory contact store
    const store = global.store || sock.store || {};
    if (store?.contacts?.[normalized]?.name)        return store.contacts[normalized].name;
    if (store?.contacts?.[normalized]?.notify)      return store.contacts[normalized].notify;
    if (store?.contacts?.[quotedSender]?.name)      return store.contacts[quotedSender].name;
    if (store?.contacts?.[quotedSender]?.notify)    return store.contacts[quotedSender].notify;

    // 2. Sock contacts (older Baileys)
    if (sock?.contacts?.[normalized]?.name)         return sock.contacts[normalized].name;
    if (sock?.contacts?.[normalized]?.notify)       return sock.contacts[normalized].notify;
    if (sock?.contacts?.[normalized]?.verifiedName) return sock.contacts[normalized].verifiedName;

    // 3. Group participant list
    if (chatId?.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(chatId);
            const p = meta.participants.find(x => x.id === quotedSender || x.id === normalized);
            if (p?.name)      return p.name;
            if (p?.notify)    return p.notify;
            if (p?.pushName)  return p.pushName;
        } catch {}
    }

    // 4. pushName from contextInfo — reject raw numeric LID values
    if (contextInfo?.pushName) {
        const pn = contextInfo.pushName.trim();
        if (pn && !/^\d{8,}$/.test(pn)) return pn;
    }

    // 5. Fallback: phone number from JID, or "Unknown" for LIDs
    const [local, domain] = (quotedSender || '').split('@');
    if (domain === 'lid') return 'Unknown';
    if (/^\d+$/.test(local)) return `+${local}`;
    return local || 'Unknown';
}

// ── Profile picture URL ───────────────────────────────────────────────────────
async function getProfilePic(sock, quotedSender) {
    const normalized = normalizeJid(quotedSender) || quotedSender;
    try {
        return await sock.profilePictureUrl(normalized, 'image');
    } catch {}
    if (quotedSender !== normalized) {
        try { return await sock.profilePictureUrl(quotedSender, 'image'); } catch {}
    }
    return 'default';
}

// ── Convert PNG/image buffer → WhatsApp sticker WebP ─────────────────────────
async function toSticker(imgBuf) {
    if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
    const inp  = tmpFile('_in.png');
    const outp = tmpFile('_stk.webp');
    try {
        fs.writeFileSync(inp, imgBuf);

        await sh(
            `ffmpeg -y -i "${inp}" ` +
            `-vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
            `-c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 80 -compression_level 6 ` +
            `"${outp}"`
        );

        const webpBuf = fs.readFileSync(outp);

        const img  = new webp.Image();
        await img.load(webpBuf);

        const meta   = { 'sticker-pack-id': crypto.randomBytes(32).toString('hex'), 'sticker-pack-name': 'Daratech', emojis: ['💬'] };
        const attr   = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
        const jBuf   = Buffer.from(JSON.stringify(meta), 'utf8');
        const exif   = Buffer.concat([attr, jBuf]);
        exif.writeUIntLE(jBuf.length, 14, 4);
        img.exif     = exif;

        return await img.save(null);
    } finally {
        cleanup(inp, outp);
    }
}

// ── Command entry point ───────────────────────────────────────────────────────
async function qcardCommand(sock, chatId, message) {
    try {
        const ctx       = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;
        const quotedJid = ctx?.participant || ctx?.remoteJid;

        if (!quotedMsg || !quotedJid) {
            return sock.sendMessage(chatId, {
                text: '💬 *Usage:* Reply to any message with *$q* to turn it into a quote sticker.',
            }, { quoted: message });
        }

        // Extract text
        const text = (
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            quotedMsg.imageMessage?.caption ||
            quotedMsg.videoMessage?.caption ||
            quotedMsg.documentMessage?.caption || ''
        ).trim();

        if (!text) {
            return sock.sendMessage(chatId, {
                text: '❌ Can only quote text messages (no media-only messages).',
            }, { quoted: message });
        }
        if (text.length > 500) {
            return sock.sendMessage(chatId, {
                text: `❌ Quote too long (${text.length}/500 chars). Reply to a shorter message.`,
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Resolve name and avatar in parallel
        const [username, avatar] = await Promise.all([
            getDisplayName(sock, quotedJid, ctx, chatId),
            getProfilePic(sock, quotedJid),
        ]);

        // ── Call zquote API ───────────────────────────────────────────────────
        const apiRes = await axios.post(API_URL, {
            username,
            text,
            avatar,
        }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        });

        if (!apiRes.data?.success) {
            throw new Error(apiRes.data?.error || 'API returned an error');
        }

        const imageUrl = apiRes.data?.data?.image?.url || apiRes.data?.image;
        if (!imageUrl) throw new Error('No image URL in API response');

        // ── Download image ────────────────────────────────────────────────────
        const imgRes = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
        });
        const imgBuf = Buffer.from(imgRes.data);

        // ── Convert & send ────────────────────────────────────────────────────
        const stickerBuf = await toSticker(imgBuf);
        await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[qcard]', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: `❌ Quote sticker failed.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = qcardCommand;
