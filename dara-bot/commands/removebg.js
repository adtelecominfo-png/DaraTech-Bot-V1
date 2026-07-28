'use strict';
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { UploadFileUgu } = require('../lib/uploader');
const { toolsGet } = require('../lib/gifted');
const fs   = require('fs');
const path = require('path');

async function getImgUrl(message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg = quoted?.imageMessage || message.message?.imageMessage || null;
    if (!imgMsg) return null;

    const stream = await downloadContentFromMessage(imgMsg, 'image');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);

    const tmpDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `rmbg_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, Buffer.concat(chunks));
    try {
        const res = await UploadFileUgu(tmpPath);
        return typeof res === 'string' ? res : (res.url || res.url_full);
    } finally {
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch {} }, 3000);
    }
}

module.exports = {
    name: 'removebg',
    alias: ['rmbg', 'nobg'],
    category: 'tools',
    desc: 'Remove background from image',
    async exec(sock, message, args) {
        const chatId = message.key.remoteJid;
        try {
            let imageUrl = args.length > 0 && args[0].startsWith('http') ? args[0] : null;
            if (!imageUrl) imageUrl = await getImgUrl(message);
            if (!imageUrl) {
                return sock.sendMessage(chatId, {
                    text: '📸 Send an image or reply to one with *$removebg*\nOr: *$removebg <image_url>*'
                }, { quoted: message });
            }
            await sock.sendPresenceUpdate('composing', chatId);
            await sock.sendMessage(chatId, { text: '🖼️ Background removal processing……' }, { quoted: message });
            const data = await toolsGet('removebg', { url: imageUrl });
            if (!data?.success || !data?.result?.image_url) throw new Error(data?.message || 'No result returned');
            await sock.sendMessage(chatId, {
                image: { url: data.result.image_url },
                caption: '✨ *Background Removed!*\n\n_Daratech_ ⚡'
            }, { quoted: message });
        } catch (e) {
            console.error('[removebg]', e.message);
            await sock.sendMessage(chatId, { text: '❌ Failed to remove background. Try again!' }, { quoted: message });
        }
    }
};
