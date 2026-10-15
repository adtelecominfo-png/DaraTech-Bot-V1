const isAdmin = require('../lib/isAdmin');
const { resolveRealJid } = require('../lib/participantDisplay');

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) return sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
        if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'Only group admins can use the $tagall command.' }, { quoted: message });

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        if (!participants.length) return sock.sendMessage(chatId, { text: 'No participants found in the group.' });

        const resolved = await Promise.all(
            participants.map(p => resolveRealJid(sock, chatId, p, groupMetadata))
        );
        const valid = resolved.filter(r => r.resolved);
        const messageText = `🔊 *Hello Everyone:*\n\n${valid.map(r => `@${r.phone}`).join('\n')}`;

        await sock.sendMessage(chatId, {
            text: messageText,
            mentions: valid.map(r => r.jid)
        });
    } catch (error) {
        console.error('Error in tagall command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to tag all members.' });
    }
}

module.exports = tagAllCommand;
