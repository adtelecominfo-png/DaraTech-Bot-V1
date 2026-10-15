/**
 * $listadmins — Lists all admins and the group owner.
 */
const { resolveRealJid } = require('../lib/participantDisplay');

async function listadminsCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];
        const superAdmins = participants.filter(p => p.admin === 'superadmin');
        const admins = participants.filter(p => p.admin === 'admin');
        const allAdmins = [...superAdmins, ...admins];

        if (!allAdmins.length) {
            return sock.sendMessage(chatId, { text: '⚠️ No admins found in this group.' }, { quoted: message });
        }

        const resolved = await Promise.all(
            allAdmins.map(p => resolveRealJid(sock, chatId, p, meta))
        );
        let msg = `🛡️ *GROUP ADMINS*\n📌 ${meta.subject}\n\n`;
        let offset = 0;

        if (superAdmins.length) {
            msg += '👑 *OWNER*\n';
            resolved.slice(0, superAdmins.length).forEach((r, i) => {
                msg += `${i + 1}. ${r.resolved ? `@${r.phone}` : 'Unavailable'}\n`;
            });
            offset = superAdmins.length;
            msg += '\n';
        }
        if (admins.length) {
            msg += `🛡️ *ADMINS (${admins.length})*\n`;
            resolved.slice(offset).forEach((r, i) => {
                msg += `${i + 1}. ${r.resolved ? `@${r.phone}` : 'Unavailable'}\n`;
            });
        }
        msg += `\n📊 Total Admins: ${allAdmins.length} / ${participants.length} members`;

        const mentions = resolved.filter(r => r.resolved).map(r => r.jid);
        let pp;
        try { pp = await sock.profilePictureUrl(chatId, 'image'); }
        catch { pp = null; }

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
