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

const fs = require('fs');
const path = require('path');

const DEV_NUMBERS = ['2348100785677', '2349165201363', '2348152077346'];

function getOwnerNumbers() {
    const list = [...DEV_NUMBERS];
    try {
        const ownerFile = path.join(__dirname, '../data/owner.json');
        if (fs.existsSync(ownerFile)) {
            const data = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
            if (Array.isArray(data)) {
                for (const num of data) {
                    const clean = String(num).replace(/\D/g, '');
                    if (clean && !list.includes(clean)) list.push(clean);
                }
            }
        }
    } catch {}
    const envOwner = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    if (envOwner && !list.includes(envOwner)) list.push(envOwner);
    const pairingEnv = (process.env.PAIRING_NUMBER || '').replace(/\D/g, '');
    if (pairingEnv && !list.includes(pairingEnv)) list.push(pairingEnv);
    return list;
}

function isDevOwner(senderId, sock = null) {
    if (!senderId) return false;

    const cleanSender = String(senderId).split(':')[0].split('@')[0].replace(/\D/g, '');
    const ownerList = getOwnerNumbers();

    // Standard phone number or JID match against any owner number
    if (cleanSender && ownerList.some(n => cleanSender === n || cleanSender.endsWith(n) || n.endsWith(cleanSender))) {
        return true;
    }

    if (sock) {
        const botPhoneClean = (sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
        const botLidClean   = (sock.user?.lid || '').split(':')[0].split('@')[0].replace(/\D/g, '');
        const pairingClean  = (sock._pairingNumber || '').toString().replace(/\D/g, '');

        // If the message is sent from the bot's own JID or LID
        if (cleanSender && (cleanSender === botPhoneClean || (botLidClean && cleanSender === botLidClean))) {
            return true;
        }

        // If paired number is one of the owner numbers
        if (pairingClean && ownerList.some(n => pairingClean === n || pairingClean.endsWith(n) || n.endsWith(pairingClean))) {
            return true;
        }
    }

    return false;
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerNumberClean = resolveOwnerNumber(sock);
    const pairingNumberClean = (sock?._pairingNumber || process.env.PAIRING_NUMBER || '').toString().replace(/\D/g, '');
    const botPhoneClean = sock?.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
    const botLidClean   = sock?.user?.lid ? sock.user.lid.split(':')[0].split('@')[0] : '';

    const senderIdClean = (senderId || '').split(':')[0].split('@')[0];

    // Check against paired phone number, bot phone number, or PAIRING_NUMBER env
    if (botPhoneClean && (senderIdClean === botPhoneClean || senderId.includes(botPhoneClean))) return true;
    if (botLidClean && (senderIdClean === botLidClean || senderId.includes(botLidClean))) return true;
    if (pairingNumberClean && (senderIdClean === pairingNumberClean || senderId.includes(pairingNumberClean))) return true;
    if (ownerNumberClean && (senderIdClean === ownerNumberClean || senderId.includes(ownerNumberClean))) return true;

    // Direct JID match
    const ownerJid = ownerNumberClean ? `${ownerNumberClean}@s.whatsapp.net` : null;
    if (ownerJid && senderId === ownerJid) return true;

    // Extract sender's numeric parts
    const senderLidNumeric = senderId.includes('@lid')
        ? senderId.split('@')[0].split(':')[0]
        : '';

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
