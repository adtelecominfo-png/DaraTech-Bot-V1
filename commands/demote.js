'use strict';

/**
 * $demote — Demotes group admin(s) back to normal members.
 */

const isAdmin = require('../lib/isAdmin');
const { invalidateGroupCache } = require('../lib/isAdmin');
const { resolveRealJid } = require('../lib/participantDisplay');

async function demoteCommand(sock, chatId, mentionedJids, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
    }

    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner  = message.key.fromMe;

    try {
        const adminStatus = await isAdmin(sock, chatId, senderId);
        if (!adminStatus.isBotAdmin) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Make me a group *admin* first before using *$demote*.'
            }, { quoted: message });
        }
        if (!adminStatus.isSenderAdmin && !isOwner) {
            return sock.sendMessage(chatId, {
                text: '🚫 Only group *admins* can use *$demote*.'
            }, { quoted: message });
        }
    } catch (adminError) {
        console.error('[demote:isAdmin]', adminError.message);
        return sock.sendMessage(chatId, { text: '❌ Error checking admin status.' }, { quoted: message });
    }

    let userToDemote = [];

    // Check mentioned users
    if (mentionedJids && mentionedJids.length > 0) {
        userToDemote = mentionedJids;
    }
    // Check replied message
    else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
        userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
    }
    // Check raw argument text (e.g. $demote 2348100785677)
    else {
        const body = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
        const arg  = body.replace(/^\$demote\s*/i, '').trim();
        if (/^\+?\d{7,15}$/.test(arg)) {
            userToDemote = [arg.replace(/^\+/, '') + '@s.whatsapp.net'];
        }
    }

    if (userToDemote.length === 0) {
        return sock.sendMessage(chatId, {
            text: '⚠️ *Usage:* Reply to an admin or mention a user to demote.\n\n_Example:_ `$demote @user` or `$demote 2348100785677`'
        }, { quoted: message });
    }

    try {
        await sock.groupParticipantsUpdate(chatId, userToDemote, 'demote');
        invalidateGroupCache(chatId);

        let groupMetadata;
        try { groupMetadata = await sock.groupMetadata(chatId); }
        catch { groupMetadata = { participants: [] }; }

        const resolved = await Promise.all(
            userToDemote.map(p => resolveRealJid(sock, chatId, p, groupMetadata))
        );

        const lines = resolved.map(r => `👤 @${r.phone} is no longer an *Admin*.`);
        const mentionList = resolved.map(r => r.jid);

        const replyMsg =
            `👤 *GROUP DEMOTION*\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            lines.join('\n') +
            `\n━━━━━━━━━━━━━━━━━━━━\n\n` +
            `_Daratech V2_ ⚡`;

        await sock.sendMessage(chatId, {
            text: replyMsg,
            mentions: mentionList
        }, { quoted: message });

    } catch (error) {
        console.error('Error in demote command:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to demote user(s). Make sure bot has sufficient permissions.' }, { quoted: message });
    }
}

// Function to handle automatic demotion detection (no-op to prevent unprompted spam)
async function handleDemotionEvent(sock, groupId, participants, author) {}

module.exports = { demoteCommand, handleDemotionEvent };
