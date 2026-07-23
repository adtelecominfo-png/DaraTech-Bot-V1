'use strict';
const settings = require('../settings');
const { resolveOwnerNumber } = require('../lib/isOwner');

/**
 * $owner — send a contact card for this bot's owner.
 *
 * The owner number is resolved at call time from (in priority order):
 *   sock._ownerNumber → OWNER_NUMBER env → sock.user.id (the connected account)
 *
 * This means each session shows its own owner correctly — no hardcoded numbers.
 */
async function ownerCommand(sock, chatId) {
    const ownerNum  = resolveOwnerNumber(sock);
    const botOwner  = settings.botOwner || 'Daratech';

    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${botOwner}\nTEL;waid=${ownerNum}:${ownerNum}\nEND:VCARD`;

    await sock.sendMessage(chatId, {
        contacts: { displayName: botOwner, contacts: [{ vcard }] },
    });
}

module.exports = ownerCommand;
