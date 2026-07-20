const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

// .vv — re-send view-once in the same chat
async function viewonceCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    if (quotedImage && quotedImage.viewOnce) {
        const stream = await downloadContentFromMessage(quotedImage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { image: buffer, fileName: 'media.jpg', caption: quotedImage.caption || '' }, { quoted: message });
    } else if (quotedVideo && quotedVideo.viewOnce) {
        const stream = await downloadContentFromMessage(quotedVideo, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(chatId, { video: buffer, fileName: 'media.mp4', caption: quotedVideo.caption || '' }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
    }
}

// .vv2 / .vvdm — download view-once and send to bot owner's DM privately
async function vvdmCommand(sock, chatId, message) {
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage = quoted?.imageMessage;
    const quotedVideo = quoted?.videoMessage;

    if (!quotedImage?.viewOnce && !quotedVideo?.viewOnce) {
        return sock.sendMessage(chatId, { text: '❌ Please reply to a view-once image or video.' }, { quoted: message });
    }

    // Build owner JID
    const ownerRaw = (settings.ownerNumber || '').replace(/[^0-9]/g, '');
    if (!ownerRaw) {
        return sock.sendMessage(chatId, { text: '❌ Owner number not configured.' }, { quoted: message });
    }
    const ownerJid = `${ownerRaw}@s.whatsapp.net`;

    const senderRaw = (message.key.participant || message.key.remoteJid || '').split('@')[0].split(':')[0];
    const senderDisplay = `+${senderRaw}`;

    // Resolve chat label — show real group name if in a group
    let chatLabel = 'Private';
    if (chatId.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(chatId);
            chatLabel = meta.subject || 'Group';
        } catch {
            chatLabel = 'Group';
        }
    }

    try {
        if (quotedImage && quotedImage.viewOnce) {
            const stream = await downloadContentFromMessage(quotedImage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(ownerJid, {
                image: buffer,
                caption: `📥 *View-once image*\nFrom: ${senderDisplay}\nChat: ${chatLabel}`,
            });
        } else {
            const stream = await downloadContentFromMessage(quotedVideo, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(ownerJid, {
                video: buffer,
                caption: `📥 *View-once video*\nFrom: ${senderDisplay}\nChat: ${chatLabel}`,
            });
        }

        // React ✅ on the original message instead of sending a text reply
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error('[vvdm]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to send to DM.\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = viewonceCommand;
module.exports.vvdmCommand = vvdmCommand;
