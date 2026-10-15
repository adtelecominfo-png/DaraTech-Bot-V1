'use strict';

const isAdmin = require('../lib/isAdmin');
const { invalidateGroupCache } = require('../lib/isAdmin');
const { asJid, resolveParticipantDisplayNumber } = require('../lib/participantDisplay');

async function demoteCommand(sock, chatId, mentionedJids, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: 'This command can only be used in groups!'
            }, { quoted: message });
            return;
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe;
        const adminStatus = await isAdmin(sock, chatId, senderId);

        if (!adminStatus.isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Error: Please make the bot an admin first to use this command.'
            }, { quoted: message });
            return;
        }

        if (!adminStatus.isSenderAdmin && !isOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Error: Only group admins can use the demote command.'
            }, { quoted: message });
            return;
        }

        let userToDemote = [];
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }

        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, {
                text: '❌ Error: Please mention the user or reply to their message to demote!'
            }, { quoted: message });
            return;
        }

        await sock.groupParticipantsUpdate(chatId, userToDemote, 'demote');
        invalidateGroupCache(chatId);

        const resolved = await Promise.all(
            userToDemote.map(jid => resolveParticipantDisplayNumber(sock, chatId, jid))
        );
        const mentionList = userToDemote.map(asJid);
        const lines = resolved.map(number => `👤 @${number} is no longer an *Admin*.`);

        await sock.sendMessage(chatId, {
            text: [
                '👤 *GROUP DEMOTION*',
                '━━━━━━━━━━━━━━━━━━━━',
                ...lines,
                '━━━━━━━━━━━━━━━━━━━━',
                '',
                '_Daratech V2_ ⚡'
            ].join('\n'),
            mentions: mentionList
        }, { quoted: message });
    } catch (error) {
        console.error('Error in demote command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to demote user(s). Make sure the bot is admin and has sufficient permissions.'
        }, { quoted: message });
    }
}

// Participant updates are handled here only to keep the existing V1 interface.
// Do not announce unsolicited demotions; demoteCommand sends the command reply.
async function handleDemotionEvent(sock, groupId, participants, author) {}

module.exports = { demoteCommand, handleDemotionEvent };
