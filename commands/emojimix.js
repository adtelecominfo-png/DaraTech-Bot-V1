'use strict';
const { get } = require('../lib/gifted');

async function emojimixCommand(sock, chatId, msg) {
    try {
        const text = msg.message?.conversation?.trim() || msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        if (!args[0] || !args[0].includes('+')) {
            return sock.sendMessage(chatId, {
                text: '🎴 *EMOJI MIX*\n\nUsage: .emojimix 😎+🥰\n\nSeparate two emojis with a *+* sign',
            }, { quoted: msg });
        }

        const [emoji1, emoji2] = args[0].split('+').map(e => e.trim());
        if (!emoji1 || !emoji2) {
            return sock.sendMessage(chatId, { text: '❌ Please provide two emojis. Example: .emojimix 😎+🥰' }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: `🎭 Mixing ${emoji1} + ${emoji2}...` }, { quoted: msg });

        const data = await get('/tools/emojimix', { emoji1, emoji2 });
        const imgUrl = data?.result?.image || data?.result?.url || data?.result;
        if (!imgUrl || typeof imgUrl !== 'string') throw new Error('No emoji mix image returned');

        await sock.sendMessage(chatId, {
            image: { url: imgUrl },
            caption:
                `╭━═『 *EMOJI MIX* 』═━╮\n` +
                `┃ 😂 *Emoji 1:* ${emoji1}\n` +
                `┃ 🙄 *Emoji 2:* ${emoji2}\n` +
                `╰━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`,
        }, { quoted: msg });
    } catch (err) {
        console.error('[emojimix]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to mix emojis. Try different ones.\n\nExample: .emojimix 😎+🥰',
        }, { quoted: msg });
    }
}

module.exports = emojimixCommand;
