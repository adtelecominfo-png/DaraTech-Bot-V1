'use strict';
const { isSudo } = require('./index');

/**
 * Resolve the PAIRER's phone number for a given sock instance.
 * This is the number of whoever paired/owns this bot instance.
 *
 * Priority (highest → lowest):
 *   1. sock._pairingNumber — set per-session from PAIRING_NUMBER env
 *   2. PAIRING_NUMBER env  — explicit pairer number
 *   3. sock.user.id        — the connected bot's own number (fallback)
 *
 * NOTE: This is NOT the developer's number. For dev-only checks use isDevOwner().
 * Returns digits-only string (no @, no :, no +).
 */
function resolveOwnerNumber(sock) {
    if (sock?._pairingNumber) {
        const n = sock._pairingNumber.toString().replace(/\D/g, '');
        if (n) return n;
    }
    const pairingEnv = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '');
    if (pairingEnv) return pairingEnv;
    // Backward compat: if PAIRING_NUMBER not set, OWNER_NUMBER acts as pairer
    const ownerEnv = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    if (ownerEnv) return ownerEnv;
    if (sock?.user?.id) {
        return sock.user.id.split(':')[0].split('@')[0];
    }
    return '';
}

/**
 * Check if a sender is the bot DEVELOPER (Daratech).
 * Checks OWNER_NUMBER env first; if unset, falls back to the two hardcoded
 * developer numbers. Cannot be overridden per-session.
 * Used to gate $docsave, $savedoc, and $bots.
 */
const DEV_NUMBERS = ['2348100785677', '2349165201353'];

function isDevOwner(senderId) {
    const envNum = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    const devNums = envNum ? [envNum] : DEV_NUMBERS;
    const clean = (senderId || '').split(':')[0].split('@')[0];
    return devNums.some(n => clean === n || senderId.includes(n));
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerNumberClean = resolveOwnerNumber(sock);
    const ownerJid = ownerNumberClean ? `${ownerNumberClean}@s.whatsapp.net` : null;

    // Direct JID match
    if (ownerJid && senderId === ownerJid) return true;

    // Extract sender's numeric parts
    const senderIdClean    = senderId.split(':')[0].split('@')[0];
    const senderLidNumeric = senderId.includes('@lid')
        ? senderId.split('@')[0].split(':')[0]
        : '';

    // Phone number match
    if (ownerNumberClean && senderIdClean === ownerNumberClean) return true;

    // In groups: LID-based match (owner's linked device)
    if (sock && chatId && chatId.endsWith('@g.us') && senderId.includes('@lid')) {
        try {
            const botLid        = sock.user?.lid || '';
            const botLidNumeric = botLid.includes(':')
                ? botLid.split(':')[0]
                : (botLid.includes('@') ? botLid.split('@')[0] : botLid);

            if (senderLidNumeric && botLidNumeric && senderLidNumeric === botLidNumeric) {
                return true;
            }

            const metadata     = await sock.groupMetadata(chatId);
            const participants = metadata.participants || [];

            const participant = participants.find(p => {
                const pLid        = p.lid || '';
                const pLidNumeric = pLid.includes(':')
                    ? pLid.split(':')[0]
                    : (pLid.includes('@') ? pLid.split('@')[0] : pLid);
                const pIdClean = (p.id || '').split(':')[0].split('@')[0];

                return (
                    p.lid === senderId ||
                    p.id  === senderId ||
                    pLidNumeric === senderLidNumeric ||
                    pIdClean    === senderIdClean    ||
                    (ownerNumberClean && pIdClean === ownerNumberClean)
                );
            });

            if (participant) {
                const pIdClean  = (participant.id  || '').split(':')[0].split('@')[0];
                const pLid      = participant.lid || '';
                const pLidNum   = pLid.includes(':')
                    ? pLid.split(':')[0]
                    : (pLid.includes('@') ? pLid.split('@')[0] : pLid);

                if ((ownerJid && participant.id === ownerJid) ||
                    (ownerNumberClean && pIdClean === ownerNumberClean) ||
                    (botLidNumeric && pLidNum === botLidNumeric)) {
                    return true;
                }
            }
        } catch (e) {
            console.error('❌ [isOwner] LID check error:', e.message);
        }
    }

    // Contains-fallback (handles LID / edge formats)
    if (ownerNumberClean && senderId.includes(ownerNumberClean)) return true;

    // Sudo check
    try {
        return await isSudo(senderId);
    } catch (e) {
        console.error('❌ [isOwner] sudo check error:', e.message);
        return false;
    }
}

module.exports = isOwnerOrSudo;
module.exports.resolveOwnerNumber = resolveOwnerNumber;
module.exports.isDevOwner = isDevOwner;
