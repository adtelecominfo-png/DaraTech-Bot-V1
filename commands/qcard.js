'use strict';
const axios = require('axios');

/**
 * $q — Quote card command
 * Reply to any message with $q to generate a stylish quote card image.
 * Uses the sender's name, profile pic, and the replied message text.
 */
async function qcardCommand(sock, chatId, message) {
    try {
        const ctx      = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = ctx?.quotedMessage;
        const quotedJid = ctx?.participant || ctx?.remoteJid;

        if (!quotedMsg || !quotedJid) {
            return sock.sendMessage(chatId, {
                text: '🖼️ *Usage:* Reply to any message with *$q* to turn it into a quote card.',
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

        // Sender name — prefer the push name stored in context
        const username = ctx.pushName || quotedJid.split('@')[0];

        // Sender profile picture (fall back to a default avatar)
        let avatar = 'https://i.ibb.co/9Hb9Kjry/85fc730b7326.jpg';
        try {
            avatar = await sock.profilePictureUrl(quotedJid, 'image');
        } catch {}

        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const res = await axios.post(
            'https://zquote.onrender.com/api/quote',
            { username, text: text.trim(), avatar },
            { responseType: 'arraybuffer', timeout: 30000,
              headers: { 'Content-Type': 'application/json' } }
        );

        const buf = Buffer.from(res.data);
        await sock.sendMessage(chatId, {
            image: buf,
            caption: `_Daratech_ ⚡`,
        }, { quoted: message });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error('[qcard]', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Quote card failed.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = qcardCommand;
