'use strict';
const { getImageUrl } = require('../lib/pollinations');

async function soraCommand(sock, chatId, message) {
    try {
        const rawText =
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() || '';
        const prompt = rawText.replace(/^\.(sora|veo3)\s*/i, '').trim() ||
            (message.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation || '').trim();

        if (!prompt) {
            return sock.sendMessage(chatId, {
                text: '🎬 Usage: *$sora <describe the scene>*\nExample: *$sora an eagle soaring over snowy mountains*'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });
        await sock.sendMessage(chatId, { text: '🎬 Generating image scene…' }, { quoted: message });

        // Pollinations does not support video; generate a high-quality image instead
        const imgUrl = getImageUrl(prompt, 'flux', 1280, 720);
        await sock.sendMessage(chatId, {
            image: { url: imgUrl },
            caption: `🎬 *${prompt}*\n\n✨ *Daratech Bot*`
        }, { quoted: message });

    } catch (err) {
        console.error('[sora]', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Generation failed.\n\n_${err.message}_`
        }, { quoted: message });
    }
}

module.exports = soraCommand;
