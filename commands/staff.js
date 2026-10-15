const { resolveRealJid } = require('../lib/participantDisplay');

async function staffCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(p => p.admin);
        const resolvedAdmins = await Promise.all(
            groupAdmins.map(p => resolveRealJid(sock, chatId, p, groupMetadata))
        );
        const listAdmin = resolvedAdmins
            .filter(r => r.resolved)
            .map((r, i) => `${i + 1}. @${r.phone}`)
            .join('\n▢ ');

        let pp;
        try { pp = await sock.profilePictureUrl(chatId, 'image'); }
        catch { pp = 'https://i.imgur.com/2wzGhpF.jpeg'; }

        const text = `
≡ *GROUP ADMINS* _${groupMetadata.subject}_

┌─⊷ *ADMINS*
▢ ${listAdmin || 'Unavailable'}
└───────────
`.trim();

        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: text,
            mentions: resolvedAdmins.filter(r => r.resolved).map(r => r.jid)
        });
    } catch (error) {
        console.error('Error in staff command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to get admin list!' });
    }
}

module.exports = staffCommand;
