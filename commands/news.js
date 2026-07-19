'use strict';
const { davidGet } = require('../lib/gifted');

async function newsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '📰 Fetching latest news……' }, { quoted: message });
        const data = await davidGet('/news/trending');
        if (!data?.success) throw new Error('News feed unreachable');

        let txt = `╭━═『 *TRENDING NEWS* 』━╮\n┃ 📡 *Source:* Multi-Channel\n╰━━━━━━━━━━━━━━━━━━╯\n\n`;
        (data.articles || []).slice(0, 10).forEach((art, i) => {
            txt += `*${i + 1}.* ${art.title}\n`;
            txt += `📅 _${art.pubDate || 'Recently'}_\n`;
            txt += `🔗 _${(art.link || '').substring(0, 50)}..._\n\n`;
        });
        txt += `🚀 *Daratech Bot*`;

        const firstImage = (data.articles || []).find(a => a.image)?.image;
        if (firstImage) {
            await sock.sendMessage(chatId, { image: { url: firstImage }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[news]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Could not fetch news right now. Try again later.' }, { quoted: message });
    }
}

module.exports = newsCommand;
