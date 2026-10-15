'use strict';

const { asJid, resolveParticipantDisplayNumber } = require('../lib/participantDisplay');

// Function to handle manual promotions via command
async function promoteCommand(sock, chatId, mentionedJids, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, {
            text: 'This command can only be used in groups!'
        }, { quoted: message });
        return;
    }

    let userToPromote = [];
    if (mentionedJids && mentionedJids.length > 0) {
        userToPromote = mentionedJids;
    } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToPromote = [message.message.extendedTextMessage.contextInfo.participant];
    }

    if (userToPromote.length === 0) {
        await sock.sendMessage(chatId, {
            text: 'Please mention the user or reply to their message to promote!'
        }, { quoted: message });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToPromote, 'promote');

        const promotedNumbers = await Promise.all(
            userToPromote.map(jid => resolveParticipantDisplayNumber(sock, chatId, jid))
        );
        const mentionList = userToPromote.map(asJid);
        const lines = promotedNumbers.map(number => `👥 @${number} is now an *Admin*.`);

        await sock.sendMessage(chatId, {
            text: [
                '👥 *GROUP PROMOTION*',
                '━━━━━━━━━━━━━━━━━━━━',
                ...lines,
                '━━━━━━━━━━━━━━━━━━━━',
                '',
                '_Daratech V2_ ⚡'
            ].join('\n'),
            mentions: mentionList
        }, { quoted: message });
    } catch (error) {
        console.error('Error in promote command:', error);
        await sock.sendMessage(chatId, {
            text: 'Failed to promote user(s)! Make sure the bot is admin and has sufficient permissions.'
        }, { quoted: message });
    }
}

// Participant updates are handled here only to keep the existing V1 interface.
// Do not announce unsolicited promotions; promoteCommand sends the command reply.
async function handlePromotionEvent(sock, groupId, participants, author) {}

module.exports = { promoteCommand, handlePromotionEvent };
