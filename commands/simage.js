'use strict';
/**
 * simage.js — Convert a sticker to an image.
 * Uses Jimp (pure JS, no native binaries) instead of sharp.
 * Falls back to sending the raw WebP buffer if Jimp conversion fails.
 */

const fs          = require('fs');
const fsPromises  = require('fs/promises');
const path        = require('path');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

const tempDir = './temp';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

function scheduleFileDeletion(filePath) {
    setTimeout(() => {
        fs.unlink(filePath, () => {}); // silent
    }, 60_000);
}

const convertStickerToImage = async (sock, quotedMessage, chatId) => {
    try {
        const stickerMessage = quotedMessage.stickerMessage;
        if (!stickerMessage) {
            return sock.sendMessage(chatId, { text: '↩️ Reply to a sticker with *$simage* to convert it to an image.' });
        }

        // Download the sticker
        await sock.sendMessage(chatId, { text: '🖼️ Converting sticker to image……' });
        const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
        let buffer = Buffer.alloc(0);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        // Try Jimp conversion (webp → png)
        try {
            const Jimp = require('jimp');
            const img  = await Jimp.read(buffer);
            const pngBuffer = await img.getBufferAsync(Jimp.MIME_PNG);
            return sock.sendMessage(chatId, {
                image:   pngBuffer,
                caption: '🖼 Here is your converted image!\n\n_Daratech_ ⚡',
            });
        } catch (_jimpErr) {
            // Jimp failed (e.g. animated webp) — send raw WebP, WhatsApp handles it fine
            return sock.sendMessage(chatId, {
                image:   buffer,
                mimetype: 'image/webp',
                caption: '🖼 Here is your sticker as an image!\n\n_Daratech_ ⚡',
            });
        }
    } catch (error) {
        console.error('[simage]', error.message);
        return sock.sendMessage(chatId, { text: '❌ Failed to convert sticker. Try again.' });
    }
};

module.exports = convertStickerToImage;
