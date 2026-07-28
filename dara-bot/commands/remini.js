'use strict';
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { get } = require('../lib/gifted');

async function reminiCommand(sock, chatId, message) {
    try {
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMsg = quoted?.imageMessage || message.message?.imageMessage;

        if (!imageMsg) {
            return sock.sendMessage(chatId, {
                text: '📸 *REMINI / ENHANCE*\n\nReply to an image with *$remini* to enhance/upscale it.\n\n_Daratech_ ⚡',
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: '✨ Enhancing your image... please wait.' }, { quoted: message });

        // Download the image
        const stream = await downloadContentFromMessage(imageMsg, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Upload to catbox first to get a public URL
        const FormData = require('form-data');
        const form = new FormData();
        form.append('reqtype', 'fileupload');
        form.append('userhash', '');
        form.append('fileToUpload', buffer, { filename: 'image.jpg', contentType: 'image/jpeg' });

        const uploadRes = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders(),
            timeout: 30000,
        });

        const imageUrl = uploadRes.data?.trim();
        if (!imageUrl || !imageUrl.startsWith('http')) throw new Error('Upload failed');

        // Pass URL to GiftedTech remini endpoint
        const data = await get('/tools/remini', { url: imageUrl });
        const resultUrl = data?.result?.url || data?.result?.image || data?.result;
        if (!resultUrl || typeof resultUrl !== 'string') throw new Error('No enhanced image returned');

        const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption: `✨ *ENHANCED IMAGE*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[remini]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to enhance the image. Please try again with a clearer photo.',
        }, { quoted: message });
    }
}

module.exports = { reminiCommand };
