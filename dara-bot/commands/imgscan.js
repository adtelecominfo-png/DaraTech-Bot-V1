'use strict';
const { get } = require('../lib/gifted');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Upload an image buffer to uguu.se and return a public URL.
 */
async function uploadImage(buffer, mimetype = 'image/jpeg') {
    const ext = (mimetype || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const tmpDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `imgscan_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    try {
        const form = new FormData();
        form.append('files[]', fs.createReadStream(tmpPath));
        const { data } = await axios.post('https://uguu.se/upload.php', form, {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            timeout: 30000,
        });
        const fileObj = data?.files?.[0];
        const url = typeof fileObj === 'string' ? fileObj : (fileObj?.url || fileObj?.url_full);
        if (!url || !url.startsWith('http')) throw new Error('uguu.se upload returned no URL');
        return url;
    } finally {
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch {} }, 5000);
    }
}

async function imgscanCommand(sock, chatId, message) {
    try {
        const ctx    = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        // Decide which message contains the image
        const isReply    = !!quoted?.imageMessage;
        const isDirect   = !!message.message?.imageMessage;

        if (!isReply && !isDirect) {
            return sock.sendMessage(chatId, {
                text: '🔍 Usage: Reply to an image with *$imgscan* or send an image with caption *$imgscan*',
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `╭━═ 『 *SCANNING* 』 ═━╮\n┃ 🤖 AI Image Analysis\n┃ ⏳ Processing...\n╰━━━━━━━━━━━━━━━━╯`,
        }, { quoted: message });

        // Build the WAMessage descriptor the same way take.js does
        const dlMsg = isReply
            ? { key: ctx.stanzaId, message: quoted }
            : { key: message.key,  message: message.message };

        const mimetype = isReply
            ? quoted.imageMessage.mimetype
            : message.message.imageMessage.mimetype;

        const buffer = await downloadMediaMessage(
            dlMsg, 'buffer', {},
            { reuploadRequest: sock.updateMediaMessage }
        );
        if (!buffer || buffer.length === 0) throw new Error('Media download returned empty buffer');

        const imageUrl = await uploadImage(buffer, mimetype || 'image/jpeg');
        const data = await get('/ai/overchat', {
            model: 'gpt4',
            q: `Analyze and describe in detail what is shown in this image: ${imageUrl}`,
        });
        if (!data?.success || !data?.result) throw new Error('Image scan returned no result');

        await sock.sendMessage(chatId, {
            text: `╭━═ 『 *SCAN RESULT* 』 ═━╮\n\n${data.result}\n\n╰━━━━━━━━━━━━━━━━━━╯\n\n🚀 *Daratech Bot*`,
        }, { quoted: message });
    } catch (err) {
        console.error('[imgscan]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Image scan failed. Try again.' }, { quoted: message });
    }
}

module.exports = imgscanCommand;
