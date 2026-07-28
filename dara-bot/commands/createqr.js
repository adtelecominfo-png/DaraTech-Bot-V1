'use strict';
const { buildUrl } = require('../lib/gifted');

async function createqrCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const data = text.split(' ').slice(1).join(' ').trim();
        if (!data) {
            return sock.sendMessage(chatId, {
                text: '📱 Usage: $createqr <text or URL>\nExample: $createqr https://example.com',
            }, { quoted: message });
        }
        const imgUrl = buildUrl('/tools/createqr', { query: data });
        await sock.sendMessage(chatId, {
            image: { url: imgUrl },
            caption: `📱 *QR CODE*\n\n▸ 🔤 *Data:* ${data.slice(0, 60)}${data.length > 60 ? '...' : ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[createqr]', err.message);
        await sock.sendMessage(chatId, { text: '❌ QR code generation failed. Try again.' }, { quoted: message });
    }
}

module.exports = createqrCommand;
