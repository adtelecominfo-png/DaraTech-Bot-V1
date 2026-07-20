/**
 * $listadmins — Lists all admins and the group owner.
 */
async function listadminsCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];

        const superAdmins = participants.filter(p => p.admin === 'superadmin');
        const admins      = participants.filter(p => p.admin === 'admin');
        const allAdmins   = [...superAdmins, ...admins];

        if (!allAdmins.length) {
            return sock.sendMessage(chatId, { text: '⚠️ No admins found in this group.' }, { quoted: message });
        }

        let pp;
        try { pp = await sock.profilePictureUrl(chatId, 'image'); }
        catch { pp = null; }

        let msg = `🛡️ *GROUP ADMINS*\n📌 ${meta.subject}\n\n`;

        if (superAdmins.length) {
            msg += `👑 *OWNER*\n`;
            superAdmins.forEach((p, i) => { msg += `${i + 1}. @${p.id.split('@')[0]}\n`; });
            msg += '\n';
        }

        if (admins.length) {
            msg += `🛡️ *ADMINS (${admins.length})*\n`;
            admins.forEach((p, i) => { msg += `${i + 1}. @${p.id.split('@')[0]}\n`; });
        }

        msg += `\n📊 Total Admins: ${allAdmins.length} / ${participants.length} members`;

        const mentions = allAdmins.map(p => p.id);

        if (pp) {
            await sock.sendMessage(chatId, { image: { url: pp }, caption: msg, mentions }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: msg, mentions }, { quoted: message });
        }

    } catch (err) {
        console.error('[listadmins]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch admin list.' }, { quoted: message });
    }
}

module.exports = listadminsCommand;
