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

/**
 * Resolve the target JID from args / mention / reply.
 * Returns { jid, usedArgs } or null.
 *
 * Number args: collect all consecutive digit-like tokens BEFORE 'mass',
 * strip non-digits (spaces, dashes, parentheses), join them, require 7–15 digits.
 */
function resolveTarget(rawArgs, message) {
    // 1. Build phone number from args — collect tokens before 'mass' keyword
    const numTokens = [];
    for (const a of rawArgs) {
        if (a.toLowerCase() === 'mass') break;
        // Only consume tokens that are digit-ish (digits, spaces already stripped by caller)
        if (/^[\d\s\-().+]+$/.test(a)) numTokens.push(a);
        else break;
    }
    if (numTokens.length) {
        const digits = numTokens.join('').replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15) {
            return { jid: `${digits}@s.whatsapp.net`, usedArgs: numTokens.length };
        }
    }

    // 2. @mention in the message
    const ctx =
        message.message?.extendedTextMessage?.contextInfo ||
        message.message?.imageMessage?.contextInfo ||
        message.message?.videoMessage?.contextInfo;

    if (ctx?.mentionedJid?.length) {
        return { jid: ctx.mentionedJid[0], usedArgs: 0 };
    }

    // 3. Quoted / replied-to message participant
    if (ctx?.participant) {
        return { jid: ctx.participant.replace(/:\d+@/, '@'), usedArgs: 0 };
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

        // Parse command text — split on whitespace but keep all tokens
        const raw     = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            ''
        ).trim();
        const allArgs = raw.split(/\s+/).slice(1); // drop '$reportnum'

        const resolved = resolveTarget(allArgs, message);

        if (!resolved) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━━━「 🚨 *REPORT NUMBER* 」━━━\n` +
                    `┃\n` +
                    `┃ ▸ *$reportnum <number>*\n` +
                    `┃   e.g. $reportnum 2348012345678\n` +
                    `┃   (spaces in number are fine)\n` +
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

        const { jid: targetJid, usedArgs } = resolved;

        // Safety: don't report the bot itself
        const botJid = (sock.user?.id || '').split(':')[0] + '@s.whatsapp.net';
        if (targetJid === botJid) {
            return sock.sendMessage(chatId, { text: '❌ Cannot report the bot itself.' }, { quoted: message });
        }

        // Determine mass/count from remaining args (after the number tokens)
        const remainingArgs = allArgs.slice(usedArgs);
        const isMass  = remainingArgs.some(a => a.toLowerCase() === 'mass');
        const countRaw = isMass
            ? parseInt(remainingArgs.find(a => /^\d+$/.test(a)) || '5')
            : 1;
        const count = Math.min(Math.max(countRaw || 5, 1), 20);

        const displayNum = targetJid.split('@')[0];
        const modeLabel  = isMass ? `🔁 *Massive* (${count}×)` : `1️⃣ *Single*`;

        // ── WhatsApp check ────────────────────────────────────────────────────
        await sock.sendMessage(chatId, {
            text: `⏳ Checking if *+${displayNum}* is on WhatsApp…`
        }, { quoted: message });

        let isOnWA = false;
        try {
            const result = await sock.onWhatsApp(targetJid);
            isOnWA = result?.[0]?.exists === true;
        } catch (e) {
            console.error('[reportnum] onWhatsApp check failed:', e.message);
            // Proceed anyway — check may fail for some JID types (LIDs, mentions)
            isOnWA = true;
        }

        if (!isOnWA) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━━━「 🚨 *REPORT NUMBER* 」━━━\n` +
                    `┃\n` +
                    `┃ 📱 Number : *+${displayNum}*\n` +
                    `┃ ❌ This number is *NOT on WhatsApp*.\n` +
                    `┃    Cannot report.\n` +
                    `┃\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        // Send progress message
        await sock.sendMessage(chatId, {
            text:
                `╭━━━「 🚨 *REPORTING* 」━━━\n` +
                `┃\n` +
                `┃ 📱 Number : *+${displayNum}*\n` +
                `┃ ✅ On WhatsApp: Yes\n` +
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
            // Delay between reports to avoid rate-limit
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
