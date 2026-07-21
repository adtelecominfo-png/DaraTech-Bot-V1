'use strict';
const axios  = require('axios');
const fs     = require('fs');
const path   = require('path');
const { exec } = require('child_process');

/**
 * $q — Quote card command
 * Reply to any message with $q to generate a stylish quote card sticker.
 * Uses the sender's name, profile pic, and the replied message text.
 */

// Convert any image buffer → WebP sticker buffer via ffmpeg
function toWebp(buffer) {
    return new Promise((resolve, reject) => {
        const tmpDir  = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const inFile  = path.join(tmpDir, `qcard_in_${Date.now()}.png`);
        const outFile = path.join(tmpDir, `qcard_out_${Date.now()}.webp`);

        fs.writeFileSync(inFile, buffer);

        exec(
            `ffmpeg -y -i "${inFile}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=white" "${outFile}"`,
            (err) => {
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
            }
        );
    });
}

async function qcardCommand(sock, chatId, message) {
    try {
        const ctx       = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;
        const quotedJid = ctx?.participant || ctx?.remoteJid;

        if (!quotedMsg || !quotedJid) {
            return sock.sendMessage(chatId, {
                text: '🖼️ *Usage:* Reply to any message with *$q* to turn it into a quote card sticker.',
            }, { quoted: message });
        }

        // Extract text from the quoted message
        const text =
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text ||
            quotedMsg.imageMessage?.caption ||
            quotedMsg.videoMessage?.caption ||
            quotedMsg.documentMessage?.caption || '';

        if (!text.trim()) {
            return sock.sendMessage(chatId, {
                text: '❌ Can only quote text messages.',
            }, { quoted: message });
        }

        const username = ctx.pushName || quotedJid.split('@')[0];

        // Profile picture with fallback
        let avatar = 'https://i.ibb.co/9Hb9Kjry/85fc730b7326.jpg';
        try {
            avatar = await sock.profilePictureUrl(quotedJid, 'image');
        } catch {}

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        // Fetch quote card image
        let imageBuf;
        try {
            const res = await axios.post(
                'https://zquote.onrender.com/api/quote',
                { username, text: text.trim(), avatar },
                {
                    responseType: 'arraybuffer',
                    timeout: 45000,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
            imageBuf = Buffer.from(res.data);
        } catch (apiErr) {
            console.error('[qcard/api]', apiErr.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Quote card API failed — server may be down. Try again shortly.\n\n_${apiErr.message}_`,
            }, { quoted: message });
        }

        // Convert to WebP sticker
        let stickerBuf;
        try {
            stickerBuf = await toWebp(imageBuf);
        } catch (convErr) {
            console.error('[qcard/webp]', convErr.message);
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: `❌ Failed to convert quote card to sticker.\n\n_${convErr.message}_`,
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { sticker: stickerBuf }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[qcard]', err.message);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } }).catch(() => {});
        await sock.sendMessage(chatId, {
            text: `❌ Quote card failed.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = qcardCommand;
