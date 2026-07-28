const settings = require('../settings');

async function aliveCommand(sock, chatId, message) {
    try {
        const t = process.uptime();
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const s = Math.floor(t % 60);
        const ver = settings.version || '1.0.0';
        const mode = settings.commandMode || 'public';

        const msg = [
            `⚡ *DARATECH BOT* ⚡`,
            `🤖 Alive & Running!\n`,
            `▸ ✅ *Status:*  Online`,
            `▸ ⏱️ *Uptime:*  ${h}h ${m}m ${s}s`,
            `▸ 🔧 *Version:* v${ver}`,
            `▸ ⚙️ *Mode:*    ${mode}\n`,
            `🎬 Movie search  →  *$movie*`,
            `🤖 AI assistant  →  *$gpt*`,
            `📋 All commands  →  *$menu*`,
            `📖 Descriptions  →  *$help*\n`,
            `👥 *Join our Community:*`,
            `https://chat.whatsapp.com/D1OaGKmTvrOGfb5E7w8nZJ\n`,
            `_Daratech_ ⚡`,
        ].join('\n');

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '✅ Daratech is alive and running!' }, { quoted: message });
    }
}

async function communityCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text:
            `👥 *DARATECH COMMUNITY*\n\n` +
            `Join our WhatsApp community to get updates, tips, and connect with other users!\n\n` +
            `🔗 *Link:*\nhttps://chat.whatsapp.com/D1OaGKmTvrOGfb5E7w8nZJ\n\n` +
            `_Daratech_ ⚡`,
    }, { quoted: message });
}

module.exports = { aliveCommand, communityCommand };
