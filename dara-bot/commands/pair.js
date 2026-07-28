'use strict';
/**
 * $pair [number] — Show pairing instructions + website link.
 *
 * NOTE: We intentionally do NOT call the session website API from here.
 * Calling the external session site while the bot is live caused a session
 * conflict that logged the bot out. Instead, users visit the site directly.
 */

const SESSION_SITE = 'https://darabot-session.onrender.com';

async function pairCommand(sock, chatId, message, q) {
    try {
        // Guard: never attempt to pair the bot's own JID
        const botJid = sock.user?.id || '';
        const botNumber = botJid.replace(/[^0-9]/g, '');
        if (q) {
            const targetNumber = q.replace(/\D/g, '');
            if (botNumber && targetNumber && targetNumber === botNumber) {
                return await sock.sendMessage(chatId, {
                    text:
                        `⚠️ *Cannot pair the bot's own number*\n\n` +
                        `Running *$pair* with the bot's own number will disconnect it.\n\n` +
                        `To generate a session for a *different* WhatsApp number, visit:\n` +
                        `🌐 ${SESSION_SITE}`,
                }, { quoted: message });
            }
        }

        // Build the response — website link + step-by-step instructions
        const numberLine = q
            ? `│ 📱 Number: *+${q.replace(/\D/g, '')}*\n`
            : '';

        await sock.sendMessage(chatId, {
            text:
                `🔐 *DARATECH SESSION GENERATOR*\n\n` +
                `Generate your SESSION_ID to run Daratech Bot.\n\n` +
                `╭── *Step 1 — Visit the website*\n` +
                `│ 🌐 ${SESSION_SITE}\n` +
                `╰─────────────────────\n\n` +
                `╭── *Step 2 — Enter your number*\n` +
                `${numberLine}` +
                `│ Type your WhatsApp number with country code\n` +
                `│ _Example: 2348152077346 (no + or spaces)_\n` +
                `╰─────────────────────\n\n` +
                `╭── *Step 3 — Enter the pairing code*\n` +
                `│ 1️⃣  Open WhatsApp on your phone\n` +
                `│ 2️⃣  Go to *Settings → Linked Devices*\n` +
                `│ 3️⃣  Tap *Link a Device*\n` +
                `│ 4️⃣  Choose *"Link with phone number instead"*\n` +
                `│ 5️⃣  Enter the code shown on the website\n` +
                `╰─────────────────────\n\n` +
                `╭── *Step 4 — Save your SESSION_ID*\n` +
                `│ ✅ After linking, your SESSION_ID is sent\n` +
                `│    to your WhatsApp automatically\n` +
                `│ 📋 Copy the SESSION_ID\n` +
                `│ 📝 Open your bot's *$env* file\n` +
                `│ 📌 Set it: SESSION_ID=<paste here>\n` +
                `│ 🔄 Restart the bot — done!\n` +
                `╰─────────────────────\n\n` +
                `⚠️ _Using the website directly keeps your bot online._`,
        }, { quoted: message });

    } catch (error) {
        console.error('[pair]', error.message);
        await sock.sendMessage(chatId, {
            text: `❌ Something went wrong. Visit the website directly:\n🌐 ${SESSION_SITE}`,
        }, { quoted: message });
    }
}

module.exports = pairCommand;
