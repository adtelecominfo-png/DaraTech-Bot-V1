async function resetlinkCommand(sock, chatId, senderId, message) {
    try {
        // Check if sender is admin
        const groupMetadata = await sock.groupMetadata(chatId);
        const isAdmin = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
            .includes(senderId);

        // Check if bot is admin
        const rawId = sock.user?.id || '';
        const botId = rawId.includes(':') ? rawId.split(':')[0] + '@s.whatsapp.net' : rawId;
        const isBotAdmin = groupMetadata.participants
            .filter(p => p.admin)
            .map(p => p.id)
            .includes(botId);

        if (!isAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Only admins can use this command!' }, { quoted: message });
            return;
        }

        if (!isBotAdmin) {
            await sock.sendMessage(chatId, { text: '❌ Bot must be admin to reset group link!' }, { quoted: message });
            return;
        }

        // Reset the group link
        const newCode = await sock.groupRevokeInvite(chatId);

        // Send the new link
        await sock.sendMessage(chatId, {
            text: `✅ *Group link reset successfully!*\n\n📌 New link:\nhttps://chat.whatsapp.com/${newCode}`
        }, { quoted: message });

    } catch (error) {
        console.error('Error in resetlink command:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to reset group link!' }, { quoted: message });
    }
}

module.exports = resetlinkCommand;
