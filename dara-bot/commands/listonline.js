/**
 * $listonline — Lists all members in a group with their status (admin/member).
 * WhatsApp does not expose real-time online presence via the API,
 * so this command shows a full member roster with roles.
 */
async function listonlineCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '👥', key: message.key } });

        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];

        const superAdmins = participants.filter(p => p.admin === 'superadmin');
        const admins      = participants.filter(p => p.admin === 'admin');
        const members     = participants.filter(p => !p.admin);

        const fmt = (p) => `• @${p.id.split('@')[0]}`;

        let msg = `👥 *GROUP MEMBERS*\n📌 ${meta.subject}\n\n`;
        msg += `📊 Total: *${participants.length}*\n`;
        msg += `👑 Super Admins: ${superAdmins.length}  |  🛡️ Admins: ${admins.length}  |  👤 Members: ${members.length}\n\n`;

        if (superAdmins.length) {
            msg += `👑 *OWNER*\n${superAdmins.map(fmt).join('\n')}\n\n`;
        }
        if (admins.length) {
            msg += `🛡️ *ADMINS (${admins.length})*\n${admins.map(fmt).join('\n')}\n\n`;
        }
        if (members.length) {
            // Chunk members into groups of 20 to avoid hitting limits
            const chunks = [];
            for (let i = 0; i < members.length; i += 20) chunks.push(members.slice(i, i + 20));
            msg += `👤 *MEMBERS (${members.length})*\n${chunks[0].map(fmt).join('\n')}`;
            if (chunks.length > 1) msg += `\n_...and ${members.length - 20} more members_`;
        }

        const mentions = participants.map(p => p.id);

        await sock.sendMessage(chatId, { text: msg.trim(), mentions }, { quoted: message });

    } catch (err) {
        console.error('[listonline]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch member list.' }, { quoted: message });
    }
}

module.exports = listonlineCommand;
