'use strict';

/**
 * $save [name]
 * Reply to any message → sends that person's number as a vCard.
 * Name defaults to their WhatsApp display name when not provided.
 */
async function saveCommand(sock, chatId, message) {
    const text = (
        message.message?.extendedTextMessage?.text ||
        message.message?.conversation || ''
    ).trim();

    const nameInput = text.replace(/^\$save\s*/i, '').trim();

    // Must be a reply (has a stanzaId)
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

    const isLid    = targetJid.endsWith('@lid');
    let autoName   = ctx.pushName || '';   // WhatsApp push name from contextInfo
    let phone      = '';

    if (isGroup) {
        // Always look up group metadata — gets real phone AND WhatsApp notify name
        try {
            const metadata   = await sock.groupMetadata(chatId);
            const lidNumeric = targetJid.split(':')[0].split('@')[0];

            const p = metadata.participants.find(p => {
                const byId  = (p.id  || '').split(':')[0].split('@')[0];
                const byLid = (p.lid || '').split(':')[0].split('@')[0];
                return byId === lidNumeric || byLid === lidNumeric;
            });

            if (p) {
                // Name: notify = WhatsApp display name shown in group
                if (!autoName) autoName = (p.notify || p.name || '').trim();

                if (isLid) {
                    // LID → get real phone from phoneNumber field
                    const phoneJid = p.phoneNumber || (!p.id.endsWith('@lid') ? p.id : '');
                    phone = phoneJid.split(':')[0].split('@')[0];
                } else {
                    phone = (p.phoneNumber || p.id || '').split(':')[0].split('@')[0];
                }
            } else if (!isLid) {
                // Participant not found in metadata but JID is readable
                phone = targetJid.split(':')[0].split('@')[0];
            }
        } catch (e) {
            console.error('[save] groupMetadata error:', e.message);
            if (!isLid) phone = targetJid.split(':')[0].split('@')[0];
        }
    } else {
        // DM — targetJid is the other person's JID
        phone = targetJid.split(':')[0].split('@')[0];
    }

    if (!phone || !/^\d+$/.test(phone)) {
        return sock.sendMessage(chatId, {
            text: '❌ Could not resolve a real phone number for that contact.\n_WhatsApp may be using an internal identifier (LID) for this person._'
        }, { quoted: message });
    }

    // Name priority: typed → WhatsApp display name → phone fallback
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
