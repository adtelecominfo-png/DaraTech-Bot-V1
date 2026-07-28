'use strict';
/**
 * commands/tempmail.js — Temporary email using tempgen/v2
 * Base: https://api.gifted.co.ke/api/tempgen/v2/
 *
 * $tempmail           → generate new temp email (mode=random)
 * $tempmail inbox     → check inbox of saved email
 * $tempmail inbox <email> → check inbox of specific email
 */

const { sportsGet } = require('../lib/gifted'); // sportsGet hits api.gifted.co.ke/api/<endpoint>

// Per-user temp email storage (in-memory, resets on restart)
const emailStore = new Map();

async function tempmailCommand(sock, chatId, message) {
    const text = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args = text.split(/\s+/).slice(1);
    const sub  = args[0]?.toLowerCase();

    try {
        // ── $tempmail inbox [email] ────────────────────────────────────────
        if (sub === 'inbox') {
            const email = args[1] || emailStore.get(message.key.participant || message.key.remoteJid);
            if (!email) {
                return sock.sendMessage(chatId, {
                    text: '❌ No email found. Generate one first with *$tempmail*',
                }, { quoted: message });
            }

            await sock.sendMessage(chatId, { text: `📬 _Checking inbox for: *${email}*..._` }, { quoted: message });

            const data = await sportsGet('tempgen/v2/inbox', { email });
            if (!data?.success) throw new Error(data?.error || 'Inbox check failed');

            const msgs = data?.result || [];
            if (!msgs.length) {
                return sock.sendMessage(chatId, {
                    text: `📭 *INBOX — ${email}*\n\nNo messages yet. Share this address to receive emails.\n\n_Daratech_ ⚡`,
                }, { quoted: message });
            }

            let reply = `📬 *INBOX — ${email}*\n`;
            reply += `_${msgs.length} message(s)_\n${'─'.repeat(30)}\n\n`;
            msgs.slice(0, 5).forEach((m, i) => {
                reply += `*${i + 1}. From:* ${m.from || m.sender || 'Unknown'}\n`;
                reply += `   *Subject:* ${m.subject || '(no subject)'}\n`;
                reply += `   *Body:* ${(m.body || m.text || m.message || '').slice(0, 250)}\n\n`;
            });
            reply += `_Daratech_ ⚡`;
            return sock.sendMessage(chatId, { text: reply }, { quoted: message });
        }

        // ── $tempmail — generate new address ──────────────────────────────
        await sock.sendMessage(chatId, { text: '⏳ _Generating temp email..._' }, { quoted: message });

        const data  = await sportsGet('tempgen/v2/generate', { mode: 'random' });
        if (!data?.success || !data?.result?.email) throw new Error(data?.error || 'No email generated');

        const r      = data.result;
        const senderId = message.key.participant || message.key.remoteJid;
        emailStore.set(senderId, r.email);

        const modes = (r.availableModes || []).join(' · ') || 'random';
        const reply =
            `📧 *TEMP EMAIL GENERATED*\n\n` +
            `▸ 📩 *Address:*\n\`${r.email}\`\n\n` +
            `▸ ⏳ *Expires:* ${r.expiresIn || '10 minutes'}\n` +
            `▸ 🎲 *Modes:* ${modes}\n\n` +
            `📥 Check inbox: *$tempmail inbox*\n` +
            `📥 Or specify: *$tempmail inbox ${r.email}*\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: reply }, { quoted: message });

    } catch (err) {
        console.error('[tempmail]', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Temp mail service failed. Try again.\n\n_${err.message}_`,
        }, { quoted: message });
    }
}

module.exports = tempmailCommand;
