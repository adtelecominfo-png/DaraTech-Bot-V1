'use strict';

/**
 * lib/participantDisplay.js
 *
 * Utilities for resolving WhatsApp participant JIDs to real phone numbers
 * so that @mention pills render correctly (blue tappable name) instead of
 * showing raw @lid or @number strings.
 *
 * KEY RULE for proper WhatsApp mention rendering:
 *   1. The text must contain   @<phone>   (digits only, no +)
 *   2. The mentions array must contain    <phone>@s.whatsapp.net
 *   3. Both MUST reference the same number.
 *   4. If we only have an @lid and cannot resolve it, we OMIT the @text token
 *      (do NOT show @lid or a random number — that breaks the pill entirely).
 */

function asJid(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.id || value.jid || value.phoneNumber || value.lid || String(value);
}

function jidBase(value) {
    return asJid(value).replace(/:[^@]*/, '').split('@')[0];
}

function isPhoneJid(value) {
    return /@s\.whatsapp\.net$/i.test(asJid(value));
}

function isLidJid(value) {
    return /@lid$/i.test(asJid(value));
}

function participantDisplayNumber(participant) {
    const value = typeof participant === 'string'
        ? participant
        : participant?.phoneNumber || (isPhoneJid(participant?.id) ? participant.id : '') ||
          participant?.jid || participant?.id || participant?.lid;
    return jidBase(value);
}

function participantMatches(participant, raw) {
    const rawJid = asJid(raw);
    const rawBase = jidBase(rawJid);
    return [participant?.id, participant?.lid, participant?.phoneNumber, participant?.jid]
        .filter(Boolean)
        .some(candidate => asJid(candidate) === rawJid || jidBase(candidate) === rawBase);
}

/**
 * Resolve a participant to { jid, phone } for tagging.
 *
 * - `jid`   → put in the `mentions` array  (e.g. "2348100785677@s.whatsapp.net")
 * - `phone` → show in text as @${phone}    (e.g. "2348100785677")
 *
 * If we cannot resolve an @lid to a real phone number, `resolved` is false
 * and callers should skip showing the @text token entirely (still add jid to
 * mentions so WA at least knows who was tagged, but don't show broken text).
 *
 * @param {object} sock
 * @param {string} chatId
 * @param {string|object} raw  — participant jid string OR {id,lid,...} object
 * @param {object} [metadata]  — already-fetched groupMetadata (to skip refetch)
 * @returns {Promise<{ jid: string, phone: string, resolved: boolean }>}
 */
async function resolveRealJid(sock, chatId, raw, metadata) {
    if (!metadata && sock && chatId?.endsWith('@g.us')) {
        try { metadata = await sock.groupMetadata(chatId); }
        catch { metadata = { participants: [] }; }
    }

    let jid = asJid(raw);
    let resolved = false;

    // ── Step 1: try to pull a phone-based JID from the participant object itself
    if (raw && typeof raw === 'object') {
        if (raw.id && isPhoneJid(raw.id)) {
            jid = raw.id.replace(/:[^@]*@/, '@');  // strip :device suffix
            resolved = true;
        } else if (raw.phoneNumber) {
            const clean = String(raw.phoneNumber).replace(/\D/g, '');
            if (clean.length >= 7) { jid = `${clean}@s.whatsapp.net`; resolved = true; }
        }
    }

    // ── Step 2: if still unresolved (@lid or unknown), cross-reference metadata
    if (!resolved) {
        const rawBase = jidBase(jid);
        const match = metadata?.participants?.find(p => {
            const pId  = asJid(p?.id);
            const pLid = asJid(p?.lid);
            const pPh  = asJid(p?.phoneNumber);
            return (
                pId === jid  || pLid === jid  ||
                jidBase(pId) === rawBase ||
                jidBase(pLid) === rawBase ||
                jidBase(pPh)  === rawBase
            );
        });

        if (match) {
            if (match.id && isPhoneJid(match.id)) {
                jid = match.id.replace(/:[^@]*@/, '@');
                resolved = true;
            } else if (match.phoneNumber) {
                const clean = String(match.phoneNumber).replace(/\D/g, '');
                if (clean.length >= 7) { jid = `${clean}@s.whatsapp.net`; resolved = true; }
            } else if (match.jid && isPhoneJid(match.jid)) {
                jid = match.jid.replace(/:[^@]*@/, '@');
                resolved = true;
            }
        }
    }

    // ── Step 3: strip any remaining :device suffix
    jid = jid.replace(/:[^@]*@/, '@');

    const rawLocal = jid.split('@')[0];
    const phone    = rawLocal.replace(/\D/g, '') || rawLocal;

    return { jid, phone, resolved: resolved && phone.length >= 7 };
}

/**
 * Resolve participant display number (non-async, best-effort).
 * Only for backwards-compat — prefer resolveRealJid for any tagging.
 */
async function resolveParticipantDisplayNumber(sock, chatId, raw, metadata) {
    const r = await resolveRealJid(sock, chatId, raw, metadata);
    return r.phone;
}

module.exports = {
    asJid,
    jidBase,
    isPhoneJid,
    isLidJid,
    participantDisplayNumber,
    resolveParticipantDisplayNumber,
    resolveRealJid,
};