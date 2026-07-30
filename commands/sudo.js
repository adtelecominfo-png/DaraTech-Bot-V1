const { addSudo, removeSudo, getSudoList } = require('../lib/index');
const isOwnerOrSudo = require('../lib/isOwner');
const { resolveOwnerNumber } = require('../lib/isOwner');

/**
 * Normalise a raw number string to a full WhatsApp JID.
 * Derives the country code from the live sock owner number so it works
 * even when OWNER_NUMBER env var is not set.
 *
 * e.g. owner = "2348100785677", input = "08100785677"
 *   → country code = "234", local = "8100785677" → "2348100785677@s.whatsapp.net"
 */
function normalizeToJid(rawNumber, sock) {
    const digits = rawNumber.replace(/\D/g, '');
    if (!digits) return null;

    if (!digits.startsWith('0')) {
        // Already international format
        return digits + '@s.whatsapp.net';
    }

    // Local format (leading 0) — derive country code from owner's live number
    const ownerDigits = resolveOwnerNumber(sock).replace(/\D/g, '');
    if (ownerDigits.length > 10) {
        // Country code = everything before the last 10 local digits
        const countryCode = ownerDigits.slice(0, ownerDigits.length - 10);
        const localWithoutZero = digits.slice(1); // strip leading 0
        return countryCode + localWithoutZero + '@s.whatsapp.net';
    }

    // Last resort: cannot determine country code — return null so caller can warn
    return null;
}

function extractMentionedJid(message, sock) {
    // Check for mentioned JID in quoted message first (when replying)
    const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    // Check quoted message for mentions
    if (quotedMsg?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
        return quotedMsg.extendedTextMessage.contextInfo.mentionedJid[0];
    }

    // Check for mentions in the current message
    const currentMentions = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (currentMentions.length > 0) {
        return currentMentions[0];
    }

    // Check if the quoted message has a participant (sender JID)
    const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
    if (quotedParticipant) {
        return quotedParticipant;
    }

    // Fallback to text extraction — normalize to international format using live sock
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const match = text.match(/\b(0?\d{7,14})\b/);
    if (match) return normalizeToJid(match[1], sock);

    return null;
}

async function sudoCommand(sock, chatId, message) {
    const senderJid = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderJid, sock, chatId);

    const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const args = rawText.trim().split(' ').slice(1);
    const sub = (args[0] || '').toLowerCase();

    if (!sub || !['add', 'del', 'remove', 'list'].includes(sub)) {
        await sock.sendMessage(chatId, { text: 'Usage:\n$sudo add <@user|number>\n$sudo del <@user|number>\n$sudo list' }, {quoted: message});
        return;
    }

    if (sub === 'list') {
        const list = await getSudoList();
        if (list.length === 0) {
            await sock.sendMessage(chatId, { text: 'No sudo users set.' }, {quoted: message});
            return;
        }
        const text = list.map((j, i) => `${i + 1}. ${j}`).join('\n');
        await sock.sendMessage(chatId, { text: `Sudo users:\n${text}` }, {quoted: message});
        return;
    }

    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Only owner can add/remove sudo users. Use $sudo list to view.' }, {quoted: message});
        return;
    }

    if (sub === 'add' || sub === 'del' || sub === 'remove') {
        const targetJid = extractMentionedJid(message, sock);
        if (!targetJid) {
            await sock.sendMessage(chatId, { text: '❌ Could not resolve number — use international format (e.g. 2348100785677) or @mention the user.' }, {quoted: message});
            return;
        }

        if (sub === 'add') {
            const ok = await addSudo(targetJid);
            await sock.sendMessage(chatId, { text: ok ? `✅ Added sudo: ${targetJid}` : '❌ Failed to add sudo' }, {quoted: message});
            return;
        }

        if (sub === 'del' || sub === 'remove') {
            const ownerNum = resolveOwnerNumber(sock);
            const ownerJid = ownerNum ? `${ownerNum}@s.whatsapp.net` : null;
            if (ownerJid && targetJid === ownerJid) {
                await sock.sendMessage(chatId, { text: 'Owner cannot be removed.' }, {quoted: message});
                return;
            }
            const ok = await removeSudo(targetJid);
            await sock.sendMessage(chatId, { text: ok ? `✅ Removed sudo: ${targetJid}` : '❌ Failed to remove sudo' }, {quoted: message});
            return;
        }
    }
}

module.exports = sudoCommand;