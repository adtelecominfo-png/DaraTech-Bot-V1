'use strict';
const { isSudo } = require('./index');

const fs = require('fs');
const path = require('path');

// These are the only numbers that can be treated as owners.  Pairing numbers
// identify a deployed bot instance; they must never silently become owners.
const DEV_NUMBERS = Object.freeze([
    '2348100785677',
    '2349165201363',
    '2348152077346',
]);

function getOwnerNumbers() {
    try {
        const ownerFile = path.join(__dirname, '../data/owner.json');
        if (fs.existsSync(ownerFile)) {
            const data = JSON.parse(fs.readFileSync(ownerFile, 'utf8'));
            if (Array.isArray(data)) {
                const list = [...new Set(data.map(num => String(num).replace(/\D/g, '')).filter(Boolean))];
                if (list.length) return list;
            }
        }
    } catch {}
    return [...DEV_NUMBERS];
}

function cleanJid(value) {
    return String(value || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}

function isStaticOwnerNumber(value) {
    const clean = cleanJid(value);
    return !!clean && getOwnerNumbers().includes(clean);
}

/**
 * Return the primary contact from the static owner list.
 * This intentionally does not inspect PAIRING_NUMBER, OWNER_NUMBER, or the
 * connected account JID.
 */
function resolveOwnerNumber() {
    return getOwnerNumbers()[0] || '';
}

/**
 * A fromMe message is only an owner message when this deployed session was
 * paired with one of the static owners. Ordinary pairers must not receive the
 * fromMe owner bypass.
 */
function isAuthorizedOwnerSession(sock) {
    return isStaticOwnerNumber(sock?._pairingNumber);
}

function isDevOwner(senderId, sock = null) {
    if (!senderId) return false;

    const cleanSender = cleanJid(senderId);
    const ownerList = getOwnerNumbers();

    return isAuthorizedOwnerSession(sock) &&
        cleanSender ? ownerList.includes(cleanSender) : false;
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const ownerList = getOwnerNumbers();
    const senderIdClean = cleanJid(senderId);
    const ownerSession = isAuthorizedOwnerSession(sock);

    // A static owner is an owner only on a deployment paired with an
    // approved static owner number. Ordinary pairers must not inherit owner
    // access merely because they are running one of the bot deployments.
    if (ownerSession && senderIdClean && ownerList.includes(senderIdClean)) return true;

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
                    ownerSession && ownerList.includes(cleanJid(p.id))
                );
            });

            if (participant) {
                const pIdClean  = (participant.id  || '').split(':')[0].split('@')[0];
                const pLid      = participant.lid || '';
                const pLidNum   = pLid.includes(':')
                    ? pLid.split(':')[0]
                    : (pLid.includes('@') ? pLid.split('@')[0] : pLid);

                if ((ownerSession && ownerList.includes(pIdClean)) ||
                    (botLidNumeric && pLidNum === botLidNumeric && ownerSession)) {
                    return true;
                }
            }
        } catch (e) {
            console.error('❌ [isOwner] LID check error:', e.message);
        }
    }

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
module.exports.getOwnerNumbers = getOwnerNumbers;
module.exports.isStaticOwnerNumber = isStaticOwnerNumber;
module.exports.isAuthorizedOwnerSession = isAuthorizedOwnerSession;
