const isAdmin = require('../lib/isAdmin');
const { resolveRealJid } = require('../lib/participantDisplay');

async function tagNotAdminCommand(sock, chatId, senderId, message) {
    try {
        const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) return sock.sendMessage(chatId, { text: 'Please make the bot an admin first.' }, { quoted: message });
        if (!isSenderAdmin) return sock.sendMessage(chatId, { text: 'Only admins can use the $tagnotadmin command.' }, { quoted: message });

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const nonAdmins = participants.filter(p => !p.admin);
        if (!nonAdmins.length) return sock.sendMessage(chatId, { text: 'No non-admin members to tag.' }, { quoted: message });

        const resolved = await Promise.all(
            nonAdmins.map(p => resolveRealJid(sock, chatId, p, groupMetadata))
        );
        const valid = resolved.filter(r => r.resolved);
        const text = `🔊 *Hello Everyone:*\n\n${valid.map(r => `@${r.phone}`).join('\n')}`;
        await sock.sendMessage(chatId, { text, mentions: valid.map(r => r.jid) }, { quoted: message });
    } catch (error) {
        console.error('Error in tagnotadmin command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to tag non-admin members.' }, { quoted: message });
    }
}

module.exports = tagNotAdminCommand;
