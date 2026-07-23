'use strict';
/**
 * reportnum.js — Report a phone number to WhatsApp as spam
 *
 * Usage:
 *   $reportnum <number>           — single report (number with country code)
 *   $reportnum @mention           — single report (tag a user)
 *   $reportnum (reply)            — single report (reply to their message)
 *   $reportnum <number> mass      — massive report (default 5×)
 *   $reportnum <number> mass <n>  — massive report n times (max 20)
 *
 * Examples:
 *   $reportnum 2348012345678
 *   $reportnum 2348012345678 mass
 *   $reportnum 2348012345678 mass 10
 *
 * Owner-only. Works in DM or group.
 */

const isOwnerOrSudo = require('../lib/isOwner');

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve the target JID from args / mention / reply */
function resolveTarget(rawArgs, message) {
    // 1. Explicit phone number in args (digits only, 7–15 chars)
    if (rawArgs[0] && /^\d{7,15}$/.test(rawArgs[0])) {
        return `${rawArgs[0]}@s.whatsapp.net`;
    }

    // 2. @mention in the message
    const ctx =
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo;

    if (ctx?.mentionedJid?.length) {
        return ctx.mentionedJid[0];
    }

    // 3. Quoted / replied-to message participant
    if (ctx?.participant) {
        return ctx.participant.replace(/:\d+@/, '@');
    }

    return null;
}

/** Sleep helper */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send one WhatsApp spam-report IQ node.
 * Baileys exposes sock.query() for low-level IQ stanzas.
 */
async function sendSpamReport(sock, targetJid) {
    return sock.query({
        tag: 'iq',
        attrs: {
            to: 's.whatsapp.net',
            type: 'set',
            xmlns: 'spam',
        },
        content: [
            {
                tag: 'report',
                attrs: {
                    jid: targetJid,
                    type: 'spam',
                },
            },
        ],
    });
}

// ── Main command ───────────────────────────────────────────────────────────────
async function reportnumCommand(sock, chatId, senderId, message) {
    try {
        // Auth: owner/sudo only
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return sock.sendMessage(chatId,
                { text: '❌ Only the bot owner can use *$reportnum*.' },
                { quoted: message });
        }

        // Parse command text
        const raw  = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            ''
        ).trim();

        // args[0] = number (optional), args[1] = 'mass' (optional), args[2] = count (optional)
        const allArgs = raw.split(/\s+/).slice(1); // drop '$reportnum'
        // Strip mention formatting (+, @, etc.) from first arg if present
        const firstArg = (allArgs[0] || '').replace(/[^0-9]/g, '');
        const cleanArgs = firstArg ? [firstArg, ...allArgs.slice(1)] : allArgs.slice(0);

        const isMass  = cleanArgs.some(a => a.toLowerCase() === 'mass');
        const countRaw = isMass
            ? parseInt(cleanArgs.find(a => /^\d+$/.test(a) && a !== cleanArgs[0]) || '5')
            : 1;
        const count = Math.min(Math.max(countRaw || 5, 1), 20); // clamp 1–20

        const targetJid = resolveTarget(cleanArgs, message);

        if (!targetJid) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━━━「 🚨 *REPORT NUMBER* 」━━━\n` +
                    `┃\n` +
                    `┃ ▸ *$reportnum <number>*\n` +
                    `┃   e.g. $reportnum 2348012345678\n` +
                    `┃\n` +
                    `┃ ▸ *$reportnum @mention*\n` +
                    `┃ ▸ *$reportnum* (reply to message)\n` +
                    `┃\n` +
                    `┃ ── Massive Report ──\n` +
                    `┃ ▸ *$reportnum <number> mass*\n` +
                    `┃   (5 reports, default)\n` +
                    `┃ ▸ *$reportnum <number> mass <n>*\n` +
                    `┃   (n reports, max 20)\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        // Safety: don't report yourself or the bot
        const botJid = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net';
        if (targetJid === botJid) {
            return sock.sendMessage(chatId, { text: '❌ Cannot report the bot itself.' }, { quoted: message });
        }

        const displayNum = targetJid.split('@')[0];
        const modeLabel  = isMass ? `🔁 *Massive* (${count}×)` : `1️⃣ *Single*`;

        // Send progress message
        const progressMsg = await sock.sendMessage(chatId, {
            text:
                `╭━━━「 🚨 *REPORTING* 」━━━\n` +
                `┃\n` +
                `┃ 📱 Number : *+${displayNum}*\n` +
                `┃ 🔧 Mode   : ${modeLabel}\n` +
                `┃ ⏳ Status : Sending report(s)…\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });

        let successCount = 0;
        let failCount    = 0;

        for (let i = 0; i < count; i++) {
            try {
                await sendSpamReport(sock, targetJid);
                successCount++;
            } catch (err) {
                failCount++;
                console.error(`[reportnum] attempt ${i + 1} failed:`, err.message);
            }
            // Delay between reports to avoid rate-limit (600ms between each)
            if (i < count - 1) await sleep(600);
        }

        // Final status
        const statusLine = failCount === 0
            ? `✅ All *${successCount}* report(s) sent successfully!`
            : `✅ *${successCount}* sent  |  ❌ *${failCount}* failed`;

        await sock.sendMessage(chatId, {
            text:
                `╭━━━「 🚨 *REPORT COMPLETE* 」━━━\n` +
                `┃\n` +
                `┃ 📱 Number  : *+${displayNum}*\n` +
                `┃ 🔧 Mode    : ${modeLabel}\n` +
                `┃ ${statusLine}\n` +
                `┃\n` +
                `┃ ⚠️ _This reports the number to\n` +
                `┃    WhatsApp as spam/abuse._\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[reportnum] fatal:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ *Report failed:* ${err.message}`
        }, { quoted: message });
    }
}

module.exports = reportnumCommand;
