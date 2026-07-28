/**
 * $grouplink — Get the current group invite link.
 * Requires bot to be admin.
 */
async function grouplinkCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const meta = await sock.groupMetadata(chatId);
        const inviteCode = await sock.groupInviteCode(chatId);
        const link = `https://chat.whatsapp.com/${inviteCode}`;

        await sock.sendMessage(chatId, {
            text: `🔗 *Group Invite Link*\n\n📌 *${meta.subject}*\n\n${link}\n\n⚠️ _Anyone with this link can join. Use *$resetlink* to revoke it._`
        }, { quoted: message });

    } catch (err) {
        console.error('[grouplink]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get group link. Make sure the bot is an admin.' }, { quoted: message });
    }
}

module.exports = grouplinkCommand;
