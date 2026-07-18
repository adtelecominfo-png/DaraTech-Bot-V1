'use strict';
const { get } = require('../lib/gifted');

// In-memory storage for temp email sessions per user
const emailStore = new Map();

async function tempmailCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const args = text.split(' ').slice(1);
        const sub  = args[0]?.toLowerCase();

        // .tempmail inbox [email] — check inbox
        if (sub === 'inbox') {
            const email = args[1] || emailStore.get(message.key.participant || message.key.remoteJid);
            if (!email) {
                return sock.sendMessage(chatId, { text: '❌ No email found. Generate one first with *.tempmail*' }, { quoted: message });
            }
            await sock.sendMessage(chatId, { text: `📬 Checking inbox for: *${email}*...` }, { quoted: message });
            const data = await get('/tools/tempmailinbox', { email });
            const msgs = data?.result || [];
            if (!msgs.length) {
                return sock.sendMessage(chatId, { text: `📭 No messages in inbox for *${email}* yet.` }, { quoted: message });
            }
            let text2 = `📬 *INBOX — ${email}*\n\n`;
            msgs.slice(0, 5).forEach((m, i) => {
                text2 += `*${i + 1}. From:* ${m.from || 'Unknown'}\n`;
                text2 += `   *Subject:* ${m.subject || '(no subject)'}\n`;
                text2 += `   *Body:* ${(m.body || m.text || '').slice(0, 200)}\n\n`;
            });
            return sock.sendMessage(chatId, { text: text2.trim() }, { quoted: message });
        }

        // .tempmail — generate new address
        await sock.sendMessage(chatId, { text: '⏳ Generating temp email...' }, { quoted: message });
        const data = await get('/tools/tempmailgen');
        const email = data?.result?.email || data?.result;
        if (!email) throw new Error('No email generated');
        const senderId = message.key.participant || message.key.remoteJid;
        emailStore.set(senderId, email);
        await sock.sendMessage(chatId, {
            text: `📧 *TEMP EMAIL*\n\n` +
                  `▸ 📩 *Address:*\n${email}\n\n` +
                  `📥 Check inbox: *.tempmail inbox*\n` +
                  `⏰ Temporary — use it fast!\n\n` +
                  `_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error('[tempmail]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Temp mail service failed. Try again.' }, { quoted: message });
    }
}

module.exports = tempmailCommand;
