'use strict';
const { davidGet } = require('../lib/gifted');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const FormData = require('form-data');
const axios = require('axios');

async function uploadToCatbox(buffer, mimetype = 'image/jpeg') {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('userhash', '');
    form.append('fileToUpload', buffer, { filename: 'image.jpg', contentType: mimetype });
    const { data } = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
        timeout: 30000,
    });
    if (!data || !data.startsWith('https://')) throw new Error('Catbox upload failed');
    return data.trim();
}

async function imgscanCommand(sock, chatId, message) {
    try {
        const ctx = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;
        const msgToScan = quoted || message.message;
        const imgMsg = msgToScan?.imageMessage;
        if (!imgMsg) {
            return sock.sendMessage(chatId, { text: '🔍 Usage: Reply to an image with *$imgscan* or send image with caption $imgscan' }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            text: `╭━═ 『 *SCANNING* 』 ═━╮\n┃ 🤖 AI Image Analysis\n┃ ⏳ Processing...\n╰━━━━━━━━━━━━━━━━╯`,
        }, { quoted: message });
        const buffer = await downloadMediaMessage({ message: msgToScan }, 'buffer', {});
        const imageUrl = await uploadToCatbox(buffer, imgMsg.mimetype || 'image/jpeg');
        const data = await davidGet(`/imgscan?url=${encodeURIComponent(imageUrl)}`);
        if (!data?.success) throw new Error('Image scan returned no result');
        await sock.sendMessage(chatId, {
            text: `╭━═ 『 *SCAN RESULT* 』 ═━╮\n\n${data.result}\n\n╰━━━━━━━━━━━━━━━━━━╯\n\n🚀 *Daratech Bot*`,
        }, { quoted: message });
    } catch (err) {
        console.error('[imgscan]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Image scan failed. Try again.' }, { quoted: message });
    }
}

module.exports = imgscanCommand;
