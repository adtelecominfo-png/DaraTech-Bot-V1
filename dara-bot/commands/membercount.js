/**
 * $membercount — Shows the number of members in the group broken down by role.
 */
async function membercountCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const meta         = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];

        const superAdmins = participants.filter(p => p.admin === 'superadmin').length;
        const admins      = participants.filter(p => p.admin === 'admin').length;
        const members     = participants.filter(p => !p.admin).length;

        const createdAt = meta.creation
            ? new Date(meta.creation * 1000).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
            : '—';

        const msg =
            `📊 *GROUP STATS*\n` +
            `📌 *${meta.subject}*\n\n` +
            `▸ 👥 *Total Members:* ${participants.length}\n` +
            `▸ 👑 *Owner:*         ${superAdmins}\n` +
            `▸ 🛡️ *Admins:*        ${admins}\n` +
            `▸ 👤 *Members:*       ${members}\n` +
            `▸ 📅 *Created:*       ${createdAt}\n` +
            (meta.desc ? `\n📝 *Description:*\n${meta.desc.slice(0, 200)}\n` : '') +
            `\n_Daratech_ ⚡`;

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });

    } catch (err) {
        console.error('[membercount]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group info.' }, { quoted: message });
    }
}

module.exports = membercountCommand;
