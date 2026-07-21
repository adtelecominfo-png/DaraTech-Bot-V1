'use strict';
/**
 * $q — Quote card sticker
 * Reply to any text message with $q to generate a Telegram-style quote sticker.
 *
 * Fix: API returns JSON { success, data: { image: { url } } } — must download
 * the image URL separately, then convert to WebP sticker via ffmpeg + webpmux.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const axios  = require('axios');
const webp   = require('node-webpmux');

const API_URL = 'https://zquote.onrender.com/api/quote';

// ── WebP sticker conversion ────────────────────────────────────────────────────
async function convertToSticker(imageBuffer) {
    const tmpDir  = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const ts      = Date.now();
    const inFile  = path.join(tmpDir, `qcard_in_${ts}.png`);
    const outFile = path.join(tmpDir, `qcard_out_${ts}.webp`);

    fs.writeFileSync(inFile, imageBuffer);

    await new Promise((resolve, reject) => {
        exec(
            `ffmpeg -y -i "${inFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 80 -compression_level 6 "${outFile}"`,
            (err) => (err ? reject(err) : resolve())
        );
    });

    try { fs.unlinkSync(inFile); } catch {}

    if (!fs.existsSync(outFile)) throw new Error('ffmpeg produced no output file');

    const webpBuf = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch {}

    // Add EXIF sticker metadata
    const img  = new webp.Image();
    await img.load(webpBuf);

    const json       = { 'sticker-pack-id': crypto.randomBytes(32).toString('hex'), 'sticker-pack-name': 'Daratech', emojis: ['💬'] };
    const exifAttr   = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
    const jsonBuf    = Buffer.from(JSON.stringify(json), 'utf8');
    const exif       = Buffer.concat([exifAttr, jsonBuf]);
    exif.writeUIntLE(jsonBuf.length, 14, 4);
    img.exif = exif;

    return img.save(null);
}

// ── Main command ───────────────────────────────────────────────────────────────
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

        // Extract quoted text
        const text = (
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            quotedMsg.imageMessage?.caption ||
            quotedMsg.videoMessage?.caption ||
            quotedMsg.documentMessage?.caption || ''
        ).trim();

        if (!text) {
            return sock.sendMessage(chatId, {
                text: '❌ Can only quote text messages.',
            }, { quoted: message });
        }

        if (text.length > 500) {
            return sock.sendMessage(chatId, {
                text: `❌ Quote too long (${text.length}/500 chars). Reply to a shorter message.`,
            }, { quoted: message });
        }

        const username = ctx.pushName || quotedJid.split('@')[0];

        // Profile picture — 'default' tells the API to use its own fallback
        let avatar = 'default';
        try { avatar = await sock.profilePictureUrl(quotedJid, 'image'); } catch {}

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Step 1 — call API, get JSON back
        let imageUrl;
        try {
            const res = await axios.post(
                API_URL,
                { username, text, avatar },
                { timeout: 45000, headers: { 'Content-Type': 'application/json' } }
            );

            if (!res.data?.success) {
                throw new Error(res.data?.error || 'API returned success: false');
            }

            imageUrl = res.data.data?.image?.url || res.data.image;
            if (!imageUrl) throw new Error('No image URL in API response');

        } catch (apiErr) {
            console.error('[qcard/api]', apiErr.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Quote API failed — server may be down.\n\n_${apiErr.message}_`,
            }, { quoted: message });
        }

        // Step 2 — download the image from the returned URL
        let imageBuf;
        try {
            const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });
            imageBuf = Buffer.from(imgRes.data);
        } catch (dlErr) {
            console.error('[qcard/download]', dlErr.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Failed to download quote image.\n\n_${dlErr.message}_`,
            }, { quoted: message });
        }

        // Step 3 — convert to WebP sticker
        let stickerBuf;
        try {
            stickerBuf = await convertToSticker(imageBuf);
        } catch (convErr) {
            console.error('[qcard/webp]', convErr.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Failed to convert to sticker.\n\n_${convErr.message}_`,
            }, { quoted: message });
        }

        // Step 4 — send
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
