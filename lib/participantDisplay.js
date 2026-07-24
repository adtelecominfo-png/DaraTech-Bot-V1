'use strict';

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
 * Resolve a participant's real phone number for human-readable text.
 * WhatsApp can provide only an @lid in message keys, while group metadata
 * carries the matching phoneNumber on the participant record.
 */
async function resolveParticipantDisplayNumber(sock, chatId, raw, metadata) {
    const rawJid = asJid(raw);
    let participants = metadata?.participants;

    if (!participants && sock && chatId?.endsWith('@g.us')) {
        try {
            participants = (await sock.groupMetadata(chatId))?.participants;
        } catch {}
    }

    const participant = participants?.find(item => participantMatches(item, rawJid));
    return participant
        ? participantDisplayNumber(participant)
        : participantDisplayNumber(rawJid);
}

module.exports = {
    asJid,
    jidBase,
    participantDisplayNumber,
    resolveParticipantDisplayNumber,
};