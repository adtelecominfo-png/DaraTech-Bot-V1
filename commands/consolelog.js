'use strict';
/**
 * consolelog.js — Send the last N server console entries to chat (owner-only)
 *
 * $consolelog        → last 20 log lines
 * $consolelog <n>    → last n lines (max 50)
 * $consolelog clear  → clear the in-memory log buffer
 */

const isOwnerOrSudo = require('../lib/isOwner');
const { getLogBuffer, clearLogBuffer } = require('../lib/logger');

async function consolelogCommand(sock, chatId, senderId, message, userMessage) {
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner) {
        return sock.sendMessage(chatId,
            { text: '❌ *$consolelog* is owner-only.' },
            { quoted: message }
        );
    }

    const arg = userMessage.replace(/^\$consolelog/i, '').trim().toLowerCase();

    // ── clear ──
    if (arg === 'clear') {
        clearLogBuffer();
        return sock.sendMessage(chatId,
            { text: '🗑️ *Console log buffer cleared.*\n\n_Daratech_ ⚡' },
            { quoted: message }
        );
    }

    // ── fetch last N ──
    let n = parseInt(arg, 10);
    if (!n || n < 1)  n = 20;
    if (n > 50)       n = 50;

    const lines = getLogBuffer(n);

    if (!lines.length) {
        return sock.sendMessage(chatId,
            { text: '📭 *No log entries captured yet.*\n\n_Daratech_ ⚡' },
            { quoted: message }
        );
    }

    const header =
        `╭━━━「 🖥️ *CONSOLE LOG* 」━━━\n` +
        `┃ Last *${lines.length}* entr${lines.length === 1 ? 'y' : 'ies'}\n` +
        `┃\n`;

    const body = lines
        .map((l, i) => `┃ *${String(i + 1).padStart(2, '0')}* ${l}`)
        .join('\n');

    const footer = `\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`;

    return sock.sendMessage(chatId,
        { text: header + body + footer },
        { quoted: message }
    );
}

module.exports = consolelogCommand;
