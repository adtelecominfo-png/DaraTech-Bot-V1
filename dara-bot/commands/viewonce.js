const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const settings = require('../settings');

// $vv — re-send view-once in the same chat
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

// $vv2 / $vvdm — download view-once and send to bot owner's DM privately
// noReact=true: skip the ✅ reaction (used when triggered by 👀 emoji)
async function vvdmCommand(sock, chatId, message, noReact = false) {
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

    // Get the ORIGINAL sender of the view-once (from contextInfo), not whoever ran $vv2
    const contextInfo = message.message?.extendedTextMessage?.contextInfo || {};
    const voSenderJid = contextInfo.participant || contextInfo.remoteJid || message.key.participant || message.key.remoteJid || '';

    // Strip device suffix (:0, :1 …) e.g. "2348012345678:0@s.whatsapp.net" → "2348012345678@s.whatsapp.net"
    const rawJid = voSenderJid.replace(/:\d+@/, '@');
    const isRealJid = rawJid.endsWith('@s.whatsapp.net');
    const jidNum = rawJid.split('@')[0];

    let senderDisplay;
    if (isRealJid) {
        // Plain phone number — safe to show with +
        senderDisplay = `+${jidNum}`;
    } else {
        // LID or unknown — try to resolve display name via sock.getName (uses contacts store)
        try {
            const name = await sock.getName(rawJid);
            // getName sometimes returns the raw JID if unresolved; prefer a clean name
            senderDisplay = (name && !name.includes('@')) ? name : jidNum;
        } catch {
            senderDisplay = jidNum;
        }
    }

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

        // React ✅ only when triggered by an explicit command (not 👀 emoji)
        if (!noReact) {
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        }
    } catch (err) {
        console.error('[vvdm]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to send to DM.\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = viewonceCommand;
module.exports.vvdmCommand = vvdmCommand;
