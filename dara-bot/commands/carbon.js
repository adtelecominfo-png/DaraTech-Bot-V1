'use strict';
const { get } = require('../lib/gifted');

async function carbonCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const code = text.split(' ').slice(1).join(' ').trim();
        if (!code) {
            return sock.sendMessage(chatId, {
                text: '💻 Usage: $carbon <code snippet>\nExample: $carbon console.log("Hello World")',
            }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: '⏳ Generating code screenshot...' }, { quoted: message });
        const data = await get('/tools/carbon', { code });
        if (!data?.success || !data?.result?.image) throw new Error('No image returned');
        const r = data.result;
        await sock.sendMessage(chatId, {
            image: { url: r.image },
            caption: `💻 *CODE SCREENSHOT*\n\n▸ 🖋️ *Font:* ${r.font || 'default'}\n▸ 🎨 *Theme:* ${r.theme || 'default'}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[carbon]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Carbon screenshot failed. Try again.' }, { quoted: message });
    }
}

module.exports = carbonCommand;
