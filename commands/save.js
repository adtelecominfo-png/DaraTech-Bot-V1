'use strict';

/**
 * $save [name]
 * Reply to any message → sends that person's number as a vCard contact card.
 * Name defaults to their WhatsApp display name if you don't type one.
 * Works in groups (resolves LID → real phone via group metadata) and DMs.
 */
async function saveCommand(sock, chatId, message) {
    const text = (
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation || ''
    ).trim();

    const nameInput = text.replace(/^\$save\s*/i, '').trim();

    // Must be a reply
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.participant && !ctx?.remoteJid) {
        return sock.sendMessage(chatId, {
            text: '❌ Reply to someone\'s message with *$save* (or *$save <name>*)'
        }, { quoted: message });
    }

    const targetJid = ctx.participant || ctx.remoteJid;
    const isLid     = targetJid.endsWith('@lid');
    const isGroup   = chatId.endsWith('@g.us');

    // WhatsApp push name of the quoted sender (may be present in contextInfo)
    let autoName = ctx.pushName || '';
    let phone    = '';

    if (isLid && isGroup) {
        // LID format — must resolve to real phone via group metadata
        try {
            const metadata   = await sock.groupMetadata(chatId);
            const lidNumeric = targetJid.split(':')[0].split('@')[0];

            const participant = metadata.participants.find(p => {
                // p.id can be LID or regular JID; p.lid is the LID when id is regular
                const byId  = (p.id  || '').split(':')[0].split('@')[0];
                const byLid = (p.lid || '').split(':')[0].split('@')[0];
                return byId === lidNumeric || byLid === lidNumeric;
            });

            if (participant) {
                // phoneNumber field: "2347055442073@s.whatsapp.net"
                const phoneJid = participant.phoneNumber || participant.id || '';
                phone = phoneJid.split(':')[0].split('@')[0];
            }
        } catch (e) {
            console.error('[save] groupMetadata error:', e.message);
        }
    } else {
        // Regular @s.whatsapp.net JID — phone number is right in the JID
        phone = targetJid.split(':')[0].split('@')[0];
    }

    // Validate we got a real phone number (all digits)
    if (!phone || !/^\d+$/.test(phone)) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not resolve a valid phone number from that message.\nThis can happen in groups where WhatsApp uses LID identifiers — try again or contact the person in DM first.'
        }, { quoted: message });
    }

    // Name priority: what user typed → WhatsApp push name → phone number fallback
    const name = nameInput || autoName || `+${phone}`;

    const vcard =
        `BEGIN:VCARD\n` +
        `VERSION:3.0\n` +
        `FN:${name}\n` +
        `TEL;TYPE=CELL;waid=${phone}:+${phone}\n` +
        `END:VCARD`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: name, contacts: [{ vcard }] }
    }, { quoted: message });
}

module.exports = saveCommand;
