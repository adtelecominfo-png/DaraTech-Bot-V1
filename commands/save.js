'use strict';

/**
 * $save [name]
 * Reply to any message → sends that person's number as a vCard contact card.
 * Name defaults to their WhatsApp display name if not typed.
 * Works in groups (LID → real phone via groupMetadata) and DMs.
 */
async function saveCommand(sock, chatId, message) {
    const text = (
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation || ''
    ).trim();

    const nameInput = text.replace(/^\$save\s*/i, '').trim();

    // ctx must exist (i.e. this must be a reply)
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (!ctx?.stanzaId) {
        return sock.sendMessage(chatId, {
            text: '❌ Reply to someone\'s message with *$save* (or *$save <name>*)'
        }, { quoted: message });
    }

    const isGroup = chatId.endsWith('@g.us');

    // In groups:  ctx.participant = quoted sender JID (may be @lid)
    // In DMs:     ctx.participant is empty — the other person IS chatId
    const targetJid = ctx.participant || (!isGroup ? chatId : null);

    if (!targetJid) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not identify the message sender.'
        }, { quoted: message });
    }

    const isLid  = targetJid.endsWith('@lid');
    // WhatsApp push name embedded in contextInfo (groups usually have this)
    let autoName = ctx.pushName || '';
    let phone    = '';

    if (isLid) {
        // LID → resolve to real phone via group metadata (groups) or store (DMs)
        const lidNumeric = targetJid.split(':')[0].split('@')[0];

        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(chatId);
                const p = metadata.participants.find(p => {
                    const byId  = (p.id  || '').split(':')[0].split('@')[0];
                    const byLid = (p.lid || '').split(':')[0].split('@')[0];
                    return byId === lidNumeric || byLid === lidNumeric;
                });
                if (p) {
                    const phoneJid = p.phoneNumber || (!p.id.endsWith('@lid') ? p.id : '');
                    phone = phoneJid.split(':')[0].split('@')[0];
                    if (!autoName) autoName = p.notify || p.name || '';
                }
            } catch (e) {
                console.error('[save] groupMetadata error:', e.message);
            }
        }
        // DM with LID chatId — nothing more we can do without a phone lookup
    } else {
        // Regular @s.whatsapp.net — phone is in the JID directly
        phone = targetJid.split(':')[0].split('@')[0];
    }

    if (!phone || !/^\d+$/.test(phone)) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not resolve a real phone number for that contact.\n_WhatsApp may be using an internal identifier for this person._'
        }, { quoted: message });
    }

    // Name: user typed → WhatsApp push name → number fallback
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
