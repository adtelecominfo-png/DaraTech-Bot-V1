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

        // ── Helper: human-readable reason from error ──────────────────────────
        function failReason(err) {
            const msg = (err?.message || err?.toString() || '').toLowerCase();
            if (msg.includes('not-authorized') || msg.includes('403'))
                return 'not authorized — they may have restricted who can add them';
            if (msg.includes('409') || msg.includes('already'))
                return 'already in the group';
            if (msg.includes('408') || msg.includes('gone'))
                return 'number not on WhatsApp';
            if (msg.includes('rate') || msg.includes('429'))
                return 'rate limited — try again later';
            return err?.message || 'failed';
        }

        // ── Mentioned users ───────────────────────────────────────────────────
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentioned.length > 0) {
            const results = [];
            for (const jid of mentioned) {
                const num = jid.split('@')[0];
                try {
                    await sock.groupParticipantsUpdate(chatId, [jid], 'add');
                    results.push(`✅ +${num}`);
                } catch (err) {
                    results.push(`❌ +${num} — ${failReason(err)}`);
                }
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
            const jid = number + '@s.whatsapp.net';
            try {
                await sock.groupParticipantsUpdate(chatId, [jid], 'add');
                results.push(`✅ +${number}`);
            } catch (err) {
                results.push(`❌ +${number} — ${failReason(err)}`);
            }
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
