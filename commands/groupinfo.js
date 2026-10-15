const { resolveRealJid } = require('../lib/participantDisplay');

async function groupInfoCommand(sock, chatId, msg) {
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participants = groupMetadata.participants || [];
        const groupAdmins = participants.filter(p => p.admin);

        const adminResolved = await Promise.all(
            groupAdmins.map(p => resolveRealJid(sock, chatId, p, groupMetadata))
        );
        const listAdmin = adminResolved
            .filter(r => r.resolved)
            .map((r, i) => `${i + 1}. @${r.phone}`)
            .join('\n');

        const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === 'superadmin') ||
            chatId.split('-')[0] + '@s.whatsapp.net';
        const ownerResolved = await resolveRealJid(sock, chatId, owner, groupMetadata);

        const text = `
┌──「 *INFO GROUP* 」
▢ *♻️ID:*
   • ${groupMetadata.id}
▢ *🔖NAME* : 
• ${groupMetadata.subject}
▢ *👥Members* :
• ${participants.length}
▢ *🤿Group Owner:*
• ${ownerResolved.resolved ? `@${ownerResolved.phone}` : 'Unavailable'}
▢ *🕵🏻‍♂️Admins:*
${listAdmin || '• Unavailable'}

▢ *📌Description* :
   • ${groupMetadata.desc?.toString() || 'No description'}
`.trim();

        const mentions = [...adminResolved, ownerResolved]
            .filter(r => r.resolved)
            .map(r => r.jid)
            .filter((jid, i, list) => list.indexOf(jid) === i);

        let pp;
        try { pp = await sock.profilePictureUrl(chatId, 'image'); }
        catch { pp = 'https://i.imgur.com/2wzGhpF.jpeg'; }

        await sock.sendMessage(chatId, {
            image: { url: pp },
            caption: text,
            mentions
        });
    } catch (error) {
        console.error('Error in groupinfo command:', error);
        await sock.sendMessage(chatId, { text: 'Failed to get group info!' });
    }
}

module.exports = groupInfoCommand;
