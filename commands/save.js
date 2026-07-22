'use strict';

/**
 * $save <name>
 * Reply to any message → sends a vCard of that person's number
 * so the recipient can tap and save it to their phone contacts.
 */
async function saveCommand(sock, chatId, message) {
    // Extract the name from the command text
    const text = (
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation || ''
    ).trim();

    const name = text.replace(/^\$save\s*/i, '').trim();

    if (!name) {
        return sock.sendMessage(chatId, {
            text: '❌ Please provide a name.\nUsage: *$save John* (while replying to their message)'
        }, { quoted: message });
    }

    // Get the quoted message context
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    const quotedParticipant = ctx?.participant;     // group reply
    const quotedRemote      = ctx?.remoteJid;       // DM reply fallback

    const targetJid = quotedParticipant || quotedRemote;

    if (!targetJid) {
        return sock.sendMessage(chatId, {
            text: '❌ Reply to someone\'s message while using *$save <name>*'
        }, { quoted: message });
    }

    // Extract clean phone number (strip :device and @domain)
    const phone = targetJid.split(':')[0].split('@')[0];

    if (!phone || isNaN(phone)) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not extract a valid phone number from that message.'
        }, { quoted: message });
    }

    const vcard =
        `BEGIN:VCARD\n` +
        `VERSION:3.0\n` +
        `FN:${name}\n` +
        `TEL;waid=${phone}:+${phone}\n` +
        `END:VCARD`;

    await sock.sendMessage(chatId, {
        contacts: {
            displayName: name,
            contacts: [{ vcard }]
        }
    }, { quoted: message });
}

module.exports = saveCommand;
