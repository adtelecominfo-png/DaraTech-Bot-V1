const fs = require('fs');
const path = require('path');

const WARN_FILE = path.join(__dirname, '../data/warnings.json');

function loadWarnings() {
    try { return JSON.parse(fs.readFileSync(WARN_FILE, 'utf8')); }
    catch { return {}; }
}

function saveWarnings(data) {
    fs.writeFileSync(WARN_FILE, JSON.stringify(data, null, 2));
}

async function clearwarnCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner  = message.key.fromMe;
        const isAdmin = require('../lib/isAdmin');
        const adminStatus = await isAdmin(sock, chatId, senderId);

        if (!adminStatus.isSenderAdmin && !isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Only admins can clear warnings.' }, { quoted: message });
        }

        const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quoted    = message.message?.extendedTextMessage?.contextInfo;

        let target = mentioned[0] || (quoted?.participant ? quoted.participant : null);
        if (!target) {
            return sock.sendMessage(chatId, { text: '❌ Mention or reply to a user.\nExample: *$clearwarn @user*' }, { quoted: message });
        }

        const warnings = loadWarnings();
        const key = `${chatId}:${target}`;

        if (!warnings[key] || warnings[key] === 0) {
            return sock.sendMessage(chatId, {
                text: `⚠️ @${target.split('@')[0]} has no warnings to clear.`,
                mentions: [target]
            }, { quoted: message });
        }

        const prev = warnings[key];
        delete warnings[key];
        saveWarnings(warnings);

        await sock.sendMessage(chatId, {
            text: `✅ Cleared *${prev}* warning(s) for @${target.split('@')[0]}.`,
            mentions: [target]
        }, { quoted: message });

    } catch (err) {
        console.error('[clearwarn]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to clear warnings.' }, { quoted: message });
    }
}

module.exports = clearwarnCommand;
