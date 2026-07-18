const { isJidGroup } = require('@whiskeysockets/baileys');
const { getAntilink, incrementWarningCount, resetWarningCount, isSudo } = require('./index');
const isAdmin = require('./isAdmin');
const config = require('../config');

const WARN_COUNT = config.WARN_COUNT || 3;

/**
 * Checks if a string contains a URL.
 * This detects ALL types of links: websites, WhatsApp groups/channels, Telegram, etc.
 *
 * @param {string} str - The string to check.
 * @returns {boolean} - True if the string contains a URL, otherwise false.
 */
function containsURL(str) {
    if (!str || typeof str !== 'string') return false;
    
    const urlPatterns = [
        // HTTP/HTTPS URLs
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i,
        // WWW URLs without protocol
        /www\.[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/i,
        // Domain names (like example.com, sub.example.com)
        /([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?/i,
        // WhatsApp group links
        /chat\.whatsapp\.com\/[A-Za-z0-9]{20,}/i,
        // WhatsApp channel links
        /wa\.me\/channel\/[A-Za-z0-9]{20,}/i,
        // Telegram links
        /t\.me\/[A-Za-z0-9_]+/i,
        // Discord links
        /discord\.gg\/[A-Za-z0-9]+/i,
        /discord\.com\/invite\/[A-Za-z0-9]+/i
    ];
    
    return urlPatterns.some(pattern => pattern.test(str));
}

/**
 * Handles the Antilink functionality for group chats.
 *
 * @param {object} msg - The message object to process.
 * @param {object} sock - The socket object to use for sending messages.
 */
async function Antilink(msg, sock) {
    try {
        const jid = msg.key.remoteJid;
        if (!isJidGroup(jid)) return;

        // Extract message text from various message types
        const SenderMessage = msg.message?.conversation || 
                            msg.message?.extendedTextMessage?.text ||
                            msg.message?.imageMessage?.caption ||
                            msg.message?.videoMessage?.caption ||
                            msg.message?.documentMessage?.caption ||
                            '';
        
        if (!SenderMessage || typeof SenderMessage !== 'string') return;

        const sender = msg.key.participant;
        if (!sender) return;
        
        // Skip if sender is group admin
        try {
            const { isSenderAdmin } = await isAdmin(sock, jid, sender);
            if (isSenderAdmin) return;
        } catch (error) {
            console.error('Error checking admin status:', error);
        }
        
        // Skip if sender is sudo (bot owner)
        const senderIsSudo = await isSudo(sender);
        if (senderIsSudo) return;

        // Check if message contains any URL
        if (!containsURL(SenderMessage.trim())) return;
        
        // Get antilink configuration
        const antilinkConfig = await getAntilink(jid, 'on');
        if (!antilinkConfig || !antilinkConfig.enabled) return;

        const action = antilinkConfig.action || 'delete';
        
        // Delete the message first
        await sock.sendMessage(jid, { delete: msg.key });

        // Apply the configured action
        switch (action) {
            case 'delete':
                // Silent delete - no message sent
                console.log(`[ANTILINK] Deleted link from ${sender.split('@')[0]} in ${jid}`);
                break;

            case 'kick':
                try {
                    await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                    // Silent kick - no message sent
                    console.log(`[ANTILINK] Kicked ${sender.split('@')[0]} from ${jid} for sending link`);
                } catch (kickError) {
                    console.error('[ANTILINK] Failed to kick user:', kickError);
                }
                break;

            case 'warn':
                try {
                    const warningCount = await incrementWarningCount(jid, sender);
                    if (warningCount >= WARN_COUNT) {
                        await sock.groupParticipantsUpdate(jid, [sender], 'remove');
                        await resetWarningCount(jid, sender);
                        await sock.sendMessage(jid, {
                            text: `\`\`\`@${sender.split('@')[0]} has been kicked after ${WARN_COUNT} warnings for sending links\`\`\``,
                            mentions: [sender]
                        });
                        console.log(`[ANTILINK] Kicked ${sender.split('@')[0]} after ${WARN_COUNT} warnings`);
                    } else {
                        await sock.sendMessage(jid, {
                            text: `\`\`\`@${sender.split('@')[0]} warning ${warningCount}/${WARN_COUNT} for sending links\`\`\``,
                            mentions: [sender]
                        });
                        console.log(`[ANTILINK] Warned ${sender.split('@')[0]} (${warningCount}/${WARN_COUNT})`);
                    }
                } catch (warnError) {
                    console.error('[ANTILINK] Failed to warn user:', warnError);
                }
                break;
        }
    } catch (error) {
        console.error('[ANTILINK] Error in Antilink function:', error);
    }
}

module.exports = { Antilink, containsURL };