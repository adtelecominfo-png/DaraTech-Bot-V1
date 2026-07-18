'use strict';
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');
const { davidGet, DAVID_BASE } = require('../lib/gifted');

async function getImgUrl(sock, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        return await uploadImage(Buffer.concat(chunks));
    }
    return null;
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
            if (!imageUrl) imageUrl = await getImgUrl(sock, message);
            if (!imageUrl) {
                return sock.sendMessage(chatId, {
                    text: '📸 Send an image or reply to one with *.removebg*\nOr: *.removebg <image_url>*'
                }, { quoted: message });
            }
            await sock.sendPresenceUpdate('composing', chatId);
            const resultUrl = `${DAVID_BASE}/removebg?url=${encodeURIComponent(imageUrl)}`;
            await sock.sendMessage(chatId, {
                image: { url: resultUrl },
                caption: '✨ *Background removed!*\n\n🚀 *Daratech Bot*'
            }, { quoted: message });
        } catch (e) {
            console.error('[removebg]', e.message);
            await sock.sendMessage(chatId, { text: '❌ Failed to remove background. Try again!' }, { quoted: message });
        }
    }
};
