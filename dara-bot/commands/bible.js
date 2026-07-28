'use strict';
const axios = require('axios');

const DAILY_VERSES = [
    'john 3:16','psalm 23:1','proverbs 3:5-6','philippians 4:13','jeremiah 29:11',
    'romans 8:28','isaiah 40:31','psalm 46:1','matthew 11:28','john 14:6',
    'romans 12:2','psalm 118:24','proverbs 31:25','joshua 1:9','2 timothy 1:7',
    'ephesians 2:8-9','galatians 5:22-23','psalm 27:1','john 16:33','romans 5:8',
    'isaiah 41:10','matthew 6:33','luke 1:37','1 corinthians 13:4','psalm 34:18',
    'hebrews 11:1','james 1:5','john 10:10','1 peter 5:7','revelation 21:4',
];

async function bibleCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const ref = text.split(' ').slice(1).join(' ').trim();
    if (!ref) return sock.sendMessage(chatId, { text: '📖 Usage: $bible <reference>\nExample: $bible john 3:16\nExample: $bible psalm 23\n\nFor daily verse: $dailyverse' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '📖 Fetching scripture……' }, { quoted: message });
        const { data } = await axios.get(`https://bible-api.com/${encodeURIComponent(ref)}`, { timeout: 10000 });
        if (data.error) return sock.sendMessage(chatId, { text: `❌ Verse not found: "${ref}"` }, { quoted: message });
        const verses = data.verses || [];
        const verseText = verses.map(v => `[${v.verse}] ${v.text.trim()}`).join('\n') || data.text?.trim() || 'No text found.';
        await sock.sendMessage(chatId, {
            text: `╭━═『 📖 *BIBLE* 』═━╮\n┃ 📜 *${data.reference}*\n┃ 📚 *Translation:* ${data.translation_name || 'WEB'}\n╰━━━━━━━━━━━━━━━╯\n\n${verseText}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: `❌ Could not fetch verse for "${ref}".` }, { quoted: message }); }
}

async function dailyVerseCommand(sock, chatId, message) {
    const day = Math.floor(Date.now() / 86400000);
    const ref = DAILY_VERSES[day % DAILY_VERSES.length];
    try {
        await sock.sendMessage(chatId, { text: '📅 Fetching verse of the day……' }, { quoted: message });
        const { data } = await axios.get(`https://bible-api.com/${encodeURIComponent(ref)}`, { timeout: 10000 });
        const verseText = (data.verses || []).map(v => v.text.trim()).join(' ') || data.text?.trim() || 'No text found.';
        await sock.sendMessage(chatId, {
            text: `╭━═『 📅 *VERSE OF THE DAY* 』━╮\n┃ 📜 *${data.reference}*\n╰━━━━━━━━━━━━━━━━━━━╯\n\n"${verseText}"\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch daily verse.' }, { quoted: message }); }
}

module.exports = { bibleCommand, dailyVerseCommand };
