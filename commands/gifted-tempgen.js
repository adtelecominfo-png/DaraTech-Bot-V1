'use strict';
/**
 * commands/gifted-tempgen.js — Gifted Tempgen API commands (temp phone / SMS)
 * Base: https://api.gifted.co.ke/api/tempgen/
 *
 * Working endpoints:
 *   tempgen/sms/generate → result.{number, country, availableCountries, expiresIn}
 *   tempgen/sms/inbox    → params: number → result[] (SMS messages)
 *   tempgen/v2/generate  → result.{email, mode, expiresIn}  (email — backup)
 *   tempgen/v2/inbox     → params: email → result[] (emails)
 *
 * Note: .tempmail / .tempmail inbox is handled by commands/tempmail.js.
 * This file adds temp phone / SMS commands alongside it.
 */

const { tempgenGet } = require('../lib/gifted');

// Per-user temp phone number storage (in-memory, resets on restart)
const phoneStore = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getQ(message) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } });
    } catch (_) {}
}

function userId(message) {
    return message.key.participant || message.key.remoteJid;
}

// ─── .tempphone — generate a temporary SMS number ─────────────────────────────

async function tempphoneCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await tempgenGet('sms/generate');
        if (!data?.success || !data?.result?.number) throw new Error(data?.error || 'Could not generate number');
        const r = data.result;
        phoneStore.set(userId(message), r.number);

        const countries = (r.availableCountries || []).join(', ') || 'random';
        const txt =
            `📲 *TEMP PHONE NUMBER*\n\n` +
            `▸ 📞 *Number:* \`${r.number}\`\n` +
            `▸ 🌍 *Country:* ${r.country || 'Random'}\n` +
            `▸ ⏳ *Expires:* ${r.expiresIn || '10 minutes'}\n\n` +
            `📋 *Available Countries:*\n${countries}\n\n` +
            `💡 To check incoming SMS:\n*.smsinbox* (uses your saved number)\n*.smsinbox <number>* (specific number)\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tempgen:tempphone]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Could not generate temp phone number.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── .smsinbox [number] — check SMS inbox of temp phone number ────────────────

async function smsinboxCommand(sock, chatId, message) {
    const arg = getQ(message);
    const number = arg || phoneStore.get(userId(message));

    if (!number) {
        return sock.sendMessage(chatId, {
            text: '📲 No number found. Generate one first with *.tempphone*\nOr specify: *.smsinbox <number>*',
        }, { quoted: message });
    }

    await react(sock, message, '⏳');
    try {
        const data = await tempgenGet('sms/inbox', { number });
        if (!data?.success) throw new Error(data?.error || 'Inbox check failed');
        const msgs = data?.result || [];

        if (!msgs.length) {
            return sock.sendMessage(chatId, {
                text: `📭 *SMS INBOX — ${number}*\n\nNo messages yet. Share this number to receive SMS.\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }

        let txt = `📬 *SMS INBOX — ${number}*\n`;
        txt += `_${msgs.length} message(s)_\n${'─'.repeat(28)}\n\n`;
        msgs.slice(0, 8).forEach((m, i) => {
            txt += `*${i + 1}. From:* ${m.from || m.sender || 'Unknown'}\n`;
            txt += `   *Message:* ${(m.text || m.body || m.message || '').slice(0, 300)}\n`;
            if (m.time || m.date) txt += `   *Time:* ${m.time || m.date}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tempgen:smsinbox]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ SMS inbox check failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = { tempphoneCommand, smsinboxCommand };
