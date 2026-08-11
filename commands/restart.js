const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

async function restartCommand(sock, chatId, message, senderId) {
    const isOwner = isAuthorizedOwnerSession(sock) &&
        (message.key?.fromMe || await isOwnerOrSudo(senderId, sock, chatId));
    if (!isOwner) {
        return sock.sendMessage(chatId, { text: '❌ This command is restricted to the paired bot Owner.' }, { quoted: message });
    }

    // Save restart state so index.js sends a "Restart Complete" message upon connection
    try {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'restartState.json'), JSON.stringify({ chatId, timestamp: Date.now() }));
    } catch { /* ignore */ }

    try {
        await sock.sendMessage(chatId, { react: { text: '🔄', key: message.key } });
    } catch { /* ignore */ }

    await sock.sendMessage(chatId, {
        text: `╭─〔 🔄 *RESTARTING* 〕─╮\n│\n│  ⚡ *DaraTech Bot is rebooting…*\n│  ⏳ _Please wait a few seconds._\n│\n╰─────────────────────────╯\n\n_Daratech_ ⚡`
    }, { quoted: message });

    setTimeout(() => {
        process.exit(0);
    }, 1200);
}

module.exports = restartCommand;
