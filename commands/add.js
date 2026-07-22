// commands/add.js
const isAdmin = require('../lib/isAdmin');

async function addCommand(sock, chatId, message, userMessage) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const adminStatus = await isAdmin(sock, chatId, senderId);

        if (!adminStatus.isSenderAdmin && !message.key.fromMe) {
            return await sock.sendMessage(chatId, {
                text: '❌ Only group admins can use this command.'
            }, { quoted: message });
        }

        if (!adminStatus.isBotAdmin) {
            return await sock.sendMessage(chatId, {
                text: '❌ Please make the bot an admin first.'
            }, { quoted: message });
        }

        // ── Helper: human-readable reason from Baileys result or thrown error ──
        // groupParticipantsUpdate returns [{ status, jid, error? }] — it does NOT
        // throw for individual participant failures (403, 408, 409, etc.).
        // We check the returned status first, then fall back to caught exceptions.
        function failReason(statusOrErr) {
            // Called with a numeric status from the result array
            if (typeof statusOrErr === 'number') {
                switch (statusOrErr) {
                    case 200: return null;                           // success
                    case 403: return 'not authorized — they may have restricted who can add them';
                    case 408: return 'number not on WhatsApp';
                    case 409: return 'already in the group';
                    case 429: return 'rate limited — try again later';
                    default:  return `failed (status ${statusOrErr})`;
                }
            }

            // Called with a string error code from result[i].error
            if (typeof statusOrErr === 'string') {
                const s = statusOrErr.toLowerCase();
                if (s.includes('account_reachout_restricted') || s.includes('reachout'))
                    return 'they\'ve turned off "Add me to groups" in their privacy settings';
                if (s.includes('not-authorized') || s.includes('403'))
                    return 'not authorized — they may have restricted who can add them';
                if (s.includes('409') || s.includes('already'))
                    return 'already in the group';
                if (s.includes('408') || s.includes('gone'))
                    return 'number not on WhatsApp';
                if (s.includes('rate') || s.includes('429'))
                    return 'rate limited — try again later';
                return statusOrErr;
            }

            // Called with a thrown Error object
            const msg = (statusOrErr?.message || statusOrErr?.toString() || '').toLowerCase();
            if (msg.includes('account_reachout_restricted') || msg.includes('reachout'))
                return 'they\'ve turned off "Add me to groups" in their privacy settings';
            if (msg.includes('not-authorized') || msg.includes('403'))
                return 'not authorized — they may have restricted who can add them';
            if (msg.includes('409') || msg.includes('already'))
                return 'already in the group';
            if (msg.includes('408') || msg.includes('gone'))
                return 'number not on WhatsApp';
            if (msg.includes('rate') || msg.includes('429'))
                return 'rate limited — try again later';
            return statusOrErr?.message || 'failed';
        }

        // ── Try to add a single JID; returns "✅ +num" or "❌ +num — reason" ──
        async function tryAdd(jid) {
            const num = jid.split('@')[0];
            try {
                const res = await sock.groupParticipantsUpdate(chatId, [jid], 'add');
                console.log(`[add] groupParticipantsUpdate result for ${jid}:`, JSON.stringify(res));

                // res is an array; check the first (and only) entry
                const entry = Array.isArray(res) ? res[0] : null;
                if (entry) {
                    // Normalise status — Baileys may return it as string or number
                    const status = entry.status != null ? Number(entry.status) : null;

                    // Some builds surface error as entry.error (string code)
                    if (entry.error) {
                        const reason = failReason(entry.error);
                        return `❌ +${num} — ${reason}`;
                    }
                    // Check numeric status (200 = success)
                    if (status !== null && status !== 200) {
                        const reason = failReason(status);
                        return `❌ +${num} — ${reason}`;
                    }
                }
                return `✅ +${num}`;
            } catch (err) {
                console.log(`[add] caught error for ${jid}:`, err?.message || err);
                return `❌ +${num} — ${failReason(err)}`;
            }
        }

        // ── Mentioned users ───────────────────────────────────────────────────
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentioned.length > 0) {
            const results = [];
            for (const jid of mentioned) {
                results.push(await tryAdd(jid));
                await new Promise(r => setTimeout(r, 500));
            }
            return await sock.sendMessage(chatId, {
                text: `✪ \`\`\`Add Results\`\`\`\n\n${results.join('\n')}`,
            }, { quoted: message });
        }

        // ── Phone number(s), comma-separated ─────────────────────────────────
        const raw = userMessage.slice(4).trim();
        if (!raw) {
            return await sock.sendMessage(chatId, {
                text: '❌ Usage:\n• $add @mention\n• $add 2347030626048\n• $add 234xxx,91xxx'
            }, { quoted: message });
        }

        const numbers = raw.split(',').map(n => n.replace(/[^0-9]/g, '').trim()).filter(Boolean);
        if (numbers.length === 0) {
            return await sock.sendMessage(chatId, { text: '❌ No valid number provided.' }, { quoted: message });
        }

        const results = [];
        for (const number of numbers) {
            results.push(await tryAdd(number + '@s.whatsapp.net'));
            await new Promise(r => setTimeout(r, 500));
        }

        await sock.sendMessage(chatId, {
            text: `✪ \`\`\`Add Results\`\`\`\n\n${results.join('\n')}`,
        }, { quoted: message });

    } catch (error) {
        console.error('Error in add command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to add user(s). Make sure the number is valid and the bot has permission.'
        }, { quoted: message });
    }
}

module.exports = addCommand;
