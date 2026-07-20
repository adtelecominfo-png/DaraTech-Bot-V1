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

        // Support tagged/mentioned users
        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        if (mentioned.length > 0) {
            const results = [];
            for (const jid of mentioned) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [jid], 'add');
                    results.push(`✅ @${jid.split('@')[0]}`);
                } catch {
                    results.push(`❌ @${jid.split('@')[0]} (failed)`);
                }
                await new Promise(r => setTimeout(r, 500));
            }
            return await sock.sendMessage(chatId, {
                text: `✪ \`\`\`Add Results\`\`\`\n\n${results.join('\n')}`,
                mentions: mentioned
            }, { quoted: message });
        }

        // Fallback: phone number(s), comma-separated e.g. $add 234xxx,91xxx
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
                results.push(`✅ @${number}`);
            } catch {
                results.push(`❌ @${number} (failed)`);
            }
            await new Promise(r => setTimeout(r, 500));
        }

        const jids = numbers.map(n => n + '@s.whatsapp.net');
        await sock.sendMessage(chatId, {
            text: `✪ \`\`\`Add Results\`\`\`\n\n${results.join('\n')}`,
            mentions: jids
        }, { quoted: message });

    } catch (error) {
        console.error('Error in add command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to add user(s). Make sure the number is valid and the bot has permission.'
        }, { quoted: message });
    }
}

module.exports = addCommand;
