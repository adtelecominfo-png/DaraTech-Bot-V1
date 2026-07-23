'use strict';
const { isSudo } = require('./index');

/**
 * Resolve the owner phone number for a given sock instance.
 *
 * Priority (highest → lowest):
 *   1. sock._ownerNumber  — set per-session in index.js from config.ownerNumber / BOT_N_NUMBER
 *   2. OWNER_NUMBER env   — global env var (single-bot setups)
 *   3. sock.user.id       — the connected bot's own number (bot IS the owner's account)
 *
 * Returns digits-only string (no @, no :, no +).
 */
function resolveOwnerNumber(sock) {
    if (sock?._ownerNumber) {
        const n = sock._ownerNumber.toString().replace(/\D/g, '');
        if (n) return n;
    }
    const envNum = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    if (envNum) return envNum;
    if (sock?.user?.id) {
        return sock.user.id.split(':')[0].split('@')[0];
    }
    return '';
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
