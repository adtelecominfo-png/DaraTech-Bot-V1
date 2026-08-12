'use strict';
const settings = require('../settings');
const { getOwnerNumbers } = require('../lib/isOwner');

/**
 * $owner — send contact cards for the bot owners.
 *
 * The numbers are loaded at call time from data/owner.json so this command
 * always reflects the configured owner list and never a deployment's pairing
 * number or a hardcoded contact.
 */
async function ownerCommand(sock, chatId) {
    const botOwner = settings.botOwner || 'Daratech';
    const ownerNumbers = getOwnerNumbers();
    const contacts = ownerNumbers.map((ownerNumber, index) => {
        const contactName = ownerNumbers.length === 1
            ? botOwner
            : `${botOwner} ${index + 1}`;
        const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${contactName}`,
            `TEL;waid=${ownerNumber}:${ownerNumber}`,
            'END:VCARD',
        ].join('\n');

        return { vcard };
    });

    await sock.sendMessage(chatId, {
        contacts: { displayName: botOwner, contacts },
    });
}

module.exports = ownerCommand;
