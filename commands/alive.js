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
            `🎬 Movie search  →  *.movie*`,
            `🤖 AI assistant  →  *.gpt*`,
            `📋 All commands  →  *.menu*`,
            `📖 Descriptions  →  *.help*\n`,
            `_Daratech_ ⚡`,
        ].join('\n');

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '✅ Daratech is alive and running!' }, { quoted: message });
    }
}

module.exports = aliveCommand;
