/**
 * $react <emoji> — React to a quoted/replied message with an emoji.
 */
async function reactCommand(sock, chatId, message, userMessage) {
    try {
        const emoji = userMessage.split(' ').slice(1).join('').trim();

        if (!emoji) {
            return sock.sendMessage(chatId, {
                text: '❌ Provide an emoji to react with.\nExample: *$react ❤️*'
            }, { quoted: message });
        }

        const ctx = message.message?.extendedTextMessage?.contextInfo;
        if (!ctx?.stanzaId) {
            return sock.sendMessage(chatId, {
                text: '❌ Reply to a message first, then use *$react <emoji>*'
            }, { quoted: message });
        }

        // React to the quoted message
        await sock.sendMessage(chatId, {
            react: {
                text: emoji,
                key: {
                    remoteJid: chatId,
                    fromMe: ctx.participant ? false : true,
                    id: ctx.stanzaId,
                    participant: ctx.participant || undefined
                }
            }
        });

    } catch (err) {
        console.error('[react]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to react to message.' }, { quoted: message });
    }
}

module.exports = reactCommand;
