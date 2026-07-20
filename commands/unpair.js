'use strict';
/**
 * $unpair — Instructions to disconnect the bot from your WhatsApp.
 */

const SESSION_SITE = 'https://darabot-session.onrender.com';

async function unpairCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            text:
                `🔌 *HOW TO UNPAIR / DISCONNECT THE BOT*\n\n` +
                `╭── *Step-by-step*\n` +
                `│ 1️⃣  Open *WhatsApp* on your phone\n` +
                `│ 2️⃣  Go to *Settings → Linked Devices*\n` +
                `│ 3️⃣  Find the bot's device in the list\n` +
                `│ 4️⃣  Tap on it → *Log Out*\n` +
                `╰─────────────────────\n\n` +
                `╭── *After logging out*\n` +
                `│ • The bot will disconnect immediately\n` +
                `│ • To reconnect, generate a new SESSION_ID:\n` +
                `│   🌐 ${SESSION_SITE}\n` +
                `│   or send *$pair <your number>*\n` +
                `╰─────────────────────\n\n` +
                `_Note: You can only log out from your phone.\n` +
                `Remote unpairing is not possible on WhatsApp._`,
        }, { quoted: message });

    } catch (error) {
        console.error('[unpair]', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ Something went wrong. Please try again.`,
        }, { quoted: message });
    }
}

module.exports = unpairCommand;
