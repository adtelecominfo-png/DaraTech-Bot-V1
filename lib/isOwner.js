'use strict';
const { isSudo } = require('./index');

const fs = require('fs');
const path = require('path');

// These numbers identify developers. They are intentionally used only by
// developer commands such as $bots, $dbstats, and $docsave.
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
 * Return the primary developer contact from the static developer list.
 */
function resolveOwnerNumber() {
    return getOwnerNumbers()[0] || '';
}

/**
 * True when this bot has a connected pairing account. This is the owner
 * session for normal bot controls; it is not a developer authorization check.
 */
function isAuthorizedOwnerSession(sock) {
    return !!cleanJid(sock?._pairingNumber);
}

function isPairingOwnerNumber(value, sock = null) {
    const pairingNumber = cleanJid(sock?._pairingNumber);
    return !!pairingNumber && cleanJid(value) === pairingNumber;
}

/**
 * A developer session is a bot paired with one of the static developer
 * numbers. This is separate from the normal owner session.
 */
function isDeveloperSession(sock) {
    return isStaticOwnerNumber(sock?._pairingNumber);
}

function isDevOwner(senderId, sock = null) {
    if (!senderId) return false;

    return isStaticOwnerNumber(senderId) ||
        (isDeveloperSession(sock) && isPairingOwnerNumber(senderId, sock));
}

async function isDeveloperOwner(senderId, sock = null, message = null, chatId = null) {
    if (isStaticOwnerNumber(senderId) ||
        (message?.key?.fromMe && isDeveloperSession(sock))) {
        return true;
    }

    if (!sock || !chatId?.endsWith('@g.us')) return false;

    try {
        const senderLid = cleanJid(senderId);
        const metadata = await sock.groupMetadata(chatId);
        const participant = (metadata.participants || []).find(p => {
            const participantLid = cleanJid(p.lid);
            const participantId = cleanJid(p.id);
            return p.lid === senderId ||
                p.id === senderId ||
                (senderLid && (participantLid === senderLid || participantId === senderLid));
        });

        return !!participant && (
            isStaticOwnerNumber(participant.phoneNumber) ||
            isStaticOwnerNumber(participant.id)
        );
    } catch {
        return false;
    }
}

async function isOwnerOrSudo(senderId, sock = null, chatId = null) {
    const senderIdClean = cleanJid(senderId);

    // The account used to pair this bot is the owner for normal bot controls.
    if (isPairingOwnerNumber(senderId, sock)) return true;

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
                    pIdClean    === senderIdClean
                );
            });

            if (participant) {
                const pIdClean  = (participant.id  || '').split(':')[0].split('@')[0];
                const pLid      = participant.lid || '';
                const pLidNum   = pLid.includes(':')
                    ? pLid.split(':')[0]
                    : (pLid.includes('@') ? pLid.split('@')[0] : pLid);

                if (botLidNumeric && pLidNum === botLidNumeric) {
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
module.exports.isDeveloperOwner = isDeveloperOwner;
module.exports.isDeveloperSession = isDeveloperSession;
module.exports.isPairingOwnerNumber = isPairingOwnerNumber;
module.exports.getOwnerNumbers = getOwnerNumbers;
module.exports.isStaticOwnerNumber = isStaticOwnerNumber;
module.exports.isAuthorizedOwnerSession = isAuthorizedOwnerSession;
