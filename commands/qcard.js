'use strict';
/**
 * $q / $qcard — Quote card sticker (local render, no external API)
 *
 * Reply to any text message with $q to generate a styled quote card sticker.
 * Rendered locally with ImageMagick + ffmpeg — no third-party API needed.
 *
 * Design: Dark glass card · accent bar · circular avatar · name · quote text · watermark
 */

const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');
const { exec } = require('child_process');
const axios   = require('axios');
const webp    = require('node-webpmux');

// ── helpers ───────────────────────────────────────────────────────────────────
const TMP = path.join(process.cwd(), 'tmp');
function tmpFile(suffix) {
    return path.join(TMP, `qcard_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${suffix}`);
}
function sh(cmd) {
    return new Promise((res, rej) =>
        exec(cmd, { maxBuffer: 20 * 1024 * 1024 }, (e, out, err) =>
            e ? rej(new Error(err || e.message)) : res(out)));
}
function cleanup(...files) {
    for (const f of files) try { if (f && fs.existsSync(f)) fs.unlinkSync(f); } catch {}
}

// ── accent colour palette (cycle by first char of name) ──────────────────────
const ACCENT_PALETTE = [
    '#7C3AED','#2563EB','#059669','#DC2626',
    '#D97706','#DB2777','#0891B2','#65A30D',
];
function accentFor(name = '') {
    const idx = name.charCodeAt(0) % ACCENT_PALETTE.length;
    return ACCENT_PALETTE[isNaN(idx) ? 0 : idx];
}

// ── circular avatar from buffer (or initials fallback) ───────────────────────
async function makeAvatarCircle(avatarBuf, name, accent, size = 90) {
    if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

    const initials = (name || '?')
        .split(/\s+/)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase() || '')
        .join('') || '?';

    const circlePng = tmpFile('_av.png');

    if (avatarBuf) {
        const rawPng = tmpFile('_avraw.png');
        const maskPng = tmpFile('_avmask.png');
        try {
            fs.writeFileSync(rawPng, avatarBuf);
            // crop square, resize, round to circle
            await sh(
                `convert "${rawPng}" -resize ${size}x${size}^ -gravity center -extent ${size}x${size} ` +
                `\\( -size ${size}x${size} xc:black -fill white -draw "circle ${size/2-1},${size/2-1} ${size/2-1},0" \\) ` +
                `-alpha off -compose CopyOpacity -composite "${circlePng}"`
            );
            cleanup(rawPng, maskPng);
            return circlePng;
        } catch {
            cleanup(rawPng, maskPng, circlePng);
        }
    }

    // Initials fallback circle
    const half = Math.round(size / 2) - 1;
    await sh(
        `convert -size ${size}x${size} xc:"${accent}" ` +
        `-fill none -strokewidth 0 ` +
        `\\( -size ${size}x${size} xc:black -fill white -draw "circle ${half},${half} ${half},0" \\) ` +
        `-alpha off -compose CopyOpacity -composite ` +
        `-gravity center -font DejaVu-Sans-Bold -pointsize ${Math.round(size * 0.38)} -fill white -annotate 0 "${initials}" ` +
        `"${circlePng}"`
    );
    return circlePng;
}

// ── word-wrap helper via ImageMagick caption: ─────────────────────────────────
async function makeTextBlock(text, width, pointsize, colour, font) {
    const out = tmpFile('_txt.png');
    // escape special chars for IM
    const safe = text.replace(/[\\'"]/g, '\\$&').replace(/`/g, '\\`');
    await sh(
        `convert -size ${width}x -background none ` +
        `-font "${font}" -pointsize ${pointsize} -fill "${colour}" ` +
        `-gravity NorthWest caption:"${safe}" "${out}"`
    );
    return out;
}

// ── main card builder ─────────────────────────────────────────────────────────
async function buildCard(username, text, avatarBuf) {
    if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

    const accent  = accentFor(username);
    const W       = 900;   // card width (larger → more readable at 512px sticker size)
    const PAD     = 28;    // outer padding
    const AVSIZE  = 110;   // avatar diameter
    const BARCOL  = accent;
    const BAR_W   = 8;
    const TEXT_X  = PAD + BAR_W + 16 + AVSIZE + 22;  // left of text column
    const TEXT_W  = W - TEXT_X - PAD;                  // width of text column
    const NAME_PT = 36;
    const TEXT_PT = 30;
    const WM_PT   = 22;

    // 1. build text block to measure height
    const textPng = await makeTextBlock(text, TEXT_W, TEXT_PT, '#E2E8F0', 'DejaVu-Sans');
    const sizeOut = await sh(`identify -format "%wx%h" "${textPng}"`);
    const [, textH] = sizeOut.trim().split('x').map(Number);

    // dynamic card height: name(44) + gap(10) + text + gap(24) + watermark(28) + padding×2
    const CONTENT_H = 44 + 10 + Math.max(textH, AVSIZE) + 24 + 28;
    const H         = Math.max(CONTENT_H + PAD * 2, 180);

    // 2. avatar
    const avPng = await makeAvatarCircle(avatarBuf, username, accent, AVSIZE);

    // 3. compose card
    const cardPng = tmpFile('_card.png');
    const AV_Y    = Math.round((H - AVSIZE) / 2);
    const NAME_Y  = AV_Y + 28;          // baseline of name
    const TEXT_Y  = NAME_Y + 10;        // top of text block
    const WM_Y    = H - PAD - WM_PT;   // watermark baseline

    // escape username for shell
    const safeUser = username.replace(/[\\'"]/g, '\\$&').replace(/`/g, '\\`');

    await sh(
        // Base: dark gradient background
        `convert -size ${W}x${H} gradient:"#0F1020-#1A1B2E" ` +
        // Inner card panel with rounded rect
        `\\( -size ${W - PAD*2}x${H - PAD*2} xc:"#1E2140" -fill "#1E2140" ` +
        `   -draw "roundrectangle 0,0 ${W-PAD*2-1},${H-PAD*2-1} 14,14" \\) ` +
        `-gravity NorthWest -geometry +${PAD}+${PAD} -composite ` +
        // Accent bar
        `\\( -size ${BAR_W}x${H - PAD*2 - 28} xc:"${BARCOL}" ` +
        `   -draw "roundrectangle 0,0 ${BAR_W-1},${H-PAD*2-29} 3,3" \\) ` +
        `-gravity NorthWest -geometry +${PAD+2}+${PAD+14} -composite ` +
        // Avatar circle
        `\\( "${avPng}" \\) -gravity NorthWest -geometry +${PAD+BAR_W+14}+${AV_Y} -composite ` +
        // Name label
        `-font "DejaVu-Sans-Bold" -pointsize ${NAME_PT} -fill "${accent}" ` +
        `-gravity NorthWest -annotate +${TEXT_X}+${NAME_Y} "${safeUser}" ` +
        // Quote text block
        `\\( "${textPng}" \\) -gravity NorthWest -geometry +${TEXT_X}+${TEXT_Y} -composite ` +
        // Decorative large quote mark top-right
        `-font "DejaVu-Sans-Bold" -pointsize 80 -fill "#ffffff08" ` +
        `-gravity NorthEast -annotate +${PAD}+${PAD - 20} '"' ` +
        // Watermark
        `-font "DejaVu-Sans" -pointsize ${WM_PT} -fill "#4A5568" ` +
        `-gravity NorthWest -annotate +${TEXT_X}+${WM_Y} "✦ Daratech" ` +
        `"${cardPng}"`
    );

    cleanup(textPng, avPng);
    return cardPng;
}

// ── WebP sticker packaging ────────────────────────────────────────────────────
async function toSticker(pngPath) {
    const webpPath = tmpFile('_stk.webp');

    // Scale to 512 wide (sticker max), preserve ratio, transparent bg
    await sh(
        `ffmpeg -y -i "${pngPath}" ` +
        `-vf "scale=512:-1:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" ` +
        `-c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 85 -compression_level 5 ` +
        `"${webpPath}"`
    );

    const buf    = fs.readFileSync(webpPath);
    cleanup(webpPath);

    const img    = new webp.Image();
    await img.load(buf);

    const meta   = { 'sticker-pack-id': crypto.randomBytes(32).toString('hex'), 'sticker-pack-name': 'Daratech', emojis: ['💬'] };
    const attr   = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
    const jBuf   = Buffer.from(JSON.stringify(meta), 'utf8');
    const exif   = Buffer.concat([attr, jBuf]);
    exif.writeUIntLE(jBuf.length, 14, 4);
    img.exif     = exif;

    return img.save(null);
}

// ── Name extraction: handles JID / LID gracefully ─────────────────────────────
function resolveName(ctx, quotedJid, message) {
    // 1. pushName from contextInfo — only if it looks like a real name (not a raw LID number)
    if (ctx?.pushName) {
        const pn = ctx.pushName.trim();
        // Reject pure-numeric strings (LID numbers like "239213085720600")
        if (pn && !/^\d{8,}$/.test(pn)) return pn;
    }

    // 2. Fall back to the top-level pushName of the message (the current sender's name)
    //    only if the quoted JID matches the message sender — i.e. bot is replying to itself
    if (message?.pushName) {
        const pn = message.pushName.trim();
        if (pn && !/^\d{8,}$/.test(pn)) return pn;
    }

    // 3. Parse the JID
    if (!quotedJid) return 'Unknown';
    const [local, domain] = quotedJid.split('@');

    // LID (@lid) — opaque internal ID, meaningless as a display name
    if (domain === 'lid') return 'Unknown';

    // JID (@s.whatsapp.net) — format as phone number if numeric
    if (/^\d+$/.test(local)) return `+${local}`;

    return local || 'Unknown';
}

// ── Command entry point ───────────────────────────────────────────────────────
async function qcardCommand(sock, chatId, message) {
    let cardPng = null;
    try {
        const ctx       = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;
        const quotedJid = ctx?.participant || ctx?.remoteJid;

        if (!quotedMsg || !quotedJid) {
            return sock.sendMessage(chatId, {
                text: '💬 *Usage:* Reply to any message with *$q* to turn it into a quote sticker.',
            }, { quoted: message });
        }

        // Extract text from all message types
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

        const username = resolveName(ctx, quotedJid, message);

        // Download profile picture (silent fail → initials fallback)
        let avatarBuf = null;
        try {
            const picUrl = await sock.profilePictureUrl(quotedJid, 'image');
            const res    = await axios.get(picUrl, { responseType: 'arraybuffer', timeout: 8000 });
            avatarBuf    = Buffer.from(res.data);
        } catch {}

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Build & send
        cardPng = await buildCard(username, text, avatarBuf);
        const stickerBuf = await toSticker(cardPng);
        cleanup(cardPng);
        cardPng = null;

        await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[qcard]', err.message);
        if (cardPng) cleanup(cardPng);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: `❌ Quote sticker failed.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = qcardCommand;
