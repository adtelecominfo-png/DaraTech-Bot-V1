'use strict';
const axios = require('axios');

async function urbanCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const word = text.split(' ').slice(1).join(' ').trim();
    if (!word) return sock.sendMessage(chatId, { text: '🏙️ Usage: $urban <word>\nExample: $urban sus' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '🏙️ Looking up definition……' }, { quoted: message });
        const { data } = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`, { timeout: 10000 });
        const entry = data.list?.[0];
        if (!entry) return sock.sendMessage(chatId, { text: `❌ No Urban Dictionary definition for "*${word}*".` }, { quoted: message });
        const def = entry.definition.replace(/\[|\]/g, '').slice(0, 600);
        const ex = entry.example?.replace(/\[|\]/g, '').slice(0, 200);
        const txt =
            `╭━═『 🏙️ *URBAN DICTIONARY* 』━╮\n` +
            `┃ 🔤 *${entry.word}*\n` +
            `┃ 👍 ${entry.thumbs_up}  👎 ${entry.thumbs_down}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `📖 *Definition:*\n${def}\n\n` +
            `${ex ? `💬 *Example:*\n_${ex}_\n\n` : ''}` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Urban Dictionary lookup failed for "*${word}*".` }, { quoted: message });
    }
}

module.exports = { urbanCommand };
