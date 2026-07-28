'use strict';
const store = require('../lib/lightweight_store');

// ── Helpers ───────────────────────────────────────────────────────────────────

function normaliseNumber(raw) {
    return raw.replace(/\D/g, '');
}

function numToJid(num) {
    return num + '@s.whatsapp.net';
}

function jidToNum(jid) {
    return jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, '');
}

// Scan contacts + group participants for LID ↔ JID relationships.
// Returns { jid, lid, number } — any field may be undefined if not found.
async function resolve(sock, chatId, { number, jid, lid }) {
    const result = {};

    if (number) {
        result.number = number;
        result.jid    = numToJid(number);
    } else if (jid) {
        result.jid    = jid;
        result.number = jidToNum(jid);
    } else if (lid) {
        result.lid = lid;
    }

    // ── 1. Scan store contacts ──────────────────────────────────────────────
    const contacts = store.contacts || {};
    for (const [id, info] of Object.entries(contacts)) {
        const isLid = id.endsWith('@lid');
        const isJid = id.endsWith('@s.whatsapp.net');

        if (result.jid && isJid && id === result.jid) {
            // found JID in contacts — store may carry lid info
            if (info.lid) result.lid = info.lid;
        }
        if (result.lid && isLid && id === result.lid) {
            if (info.jid) { result.jid = info.jid; result.number = jidToNum(info.jid); }
        }
        if (result.number && isJid && id.startsWith(result.number + '@')) {
            if (info.lid) result.lid = info.lid;
        }
    }

    // ── 2. Scan current group participants (richest realtime source) ──────────
    if (chatId && chatId.endsWith('@g.us')) {
        try {
            const meta = await sock.groupMetadata(chatId);
            for (const p of (meta.participants || [])) {
                const pNum = jidToNum(p.id);
                const pLid = p.lid || '';

                if (result.number && pNum === result.number) {
                    if (pLid) result.lid = pLid;
                    result.jid = p.id;
                }
                if (result.lid && pLid === result.lid) {
                    result.jid    = p.id;
                    result.number = pNum;
                }
                if (result.jid && p.id === result.jid) {
                    if (pLid) result.lid = pLid;
                }
            }
        } catch { /* group meta unavailable — skip */ }
    }

    // ── 3. Still no LID? Scan all known groups until found ───────────────────
    if (!result.lid) {
        try {
            const allGroups = await sock.groupFetchAllParticipating();
            outer: for (const [, meta] of Object.entries(allGroups || {})) {
                for (const p of (meta.participants || [])) {
                    const pNum = jidToNum(p.id);
                    const pLid = p.lid || '';

                    const matchByNum = result.number && pNum === result.number;
                    const matchByJid = result.jid   && p.id  === result.jid;
                    const matchByLid = result.lid   && pLid  === result.lid;

                    if (matchByNum || matchByJid || matchByLid) {
                        if (pLid)         result.lid    = pLid;
                        if (p.id)         result.jid    = p.id;
                        if (pNum)         result.number = pNum;
                        if (result.lid)   break outer;   // found — stop searching
                    }
                }
            }
        } catch { /* no group access — skip */ }
    }

    return result;
}

function box(title, lines) {
    const body = lines.join('\n');
    return [
        `╭${'─'.repeat(38)}╮`,
        `│  🔍 *${title}*`,
        `├${'─'.repeat(38)}┤`,
        body,
        `╰${'─'.repeat(38)}╯`,
        '',
        '_Daratech_ ⚡',
    ].join('\n');
}

// ── $phone <number> ───────────────────────────────────────────────────────────
async function phoneCommand(sock, chatId, message, userMessage) {
    const raw = userMessage.slice(6).trim();   // strip "$phone"
    const number = normaliseNumber(raw);

    if (!number) {
        return sock.sendMessage(chatId, {
            text: '❌ Usage: *$phone <number>*\nExample: `$phone 2348012345678`',
        }, { quoted: message });
    }

    const r = await resolve(sock, chatId, { number });

    const lines = [
        `│  📱 *Number :* +${r.number}`,
        `│  📟 *JID    :* \`${r.jid || numToJid(number)}\``,
        `│  🔑 *LID    :* \`${r.lid || 'not found in this context'}\``,
    ];
    await sock.sendMessage(chatId, { text: box('PHONE LOOKUP', lines) }, { quoted: message });
}

// ── $lid <lid> ────────────────────────────────────────────────────────────────
async function lidCommand(sock, chatId, message, userMessage) {
    let raw = userMessage.slice(4).trim();   // strip "$lid"
    if (!raw) {
        return sock.sendMessage(chatId, {
            text: '❌ Usage: *$lid <lid>*\nExample: `$lid 105253139681502@lid`\nor just the digits: `$lid 105253139681502`',
        }, { quoted: message });
    }

    // Accept bare digits or full lid JID
    if (!raw.includes('@')) raw = raw + '@lid';

    const r = await resolve(sock, chatId, { lid: raw });

    const lines = [
        `│  🔑 *LID    :* \`${raw}\``,
        `│  📱 *Number :* ${r.number ? '+' + r.number : 'not found in this context'}`,
        `│  📟 *JID    :* \`${r.jid || 'not found in this context'}\``,
    ];
    await sock.sendMessage(chatId, { text: box('LID LOOKUP', lines) }, { quoted: message });
}

// ── $jid <jid> ────────────────────────────────────────────────────────────────
async function jidCommand(sock, chatId, message, userMessage) {
    let raw = userMessage.slice(4).trim();   // strip "$jid"
    if (!raw) {
        return sock.sendMessage(chatId, {
            text: '❌ Usage: *$jid <jid>*\nExample: `$jid 2348012345678@s.whatsapp.net`\nor just the number: `$jid 2348012345678`',
        }, { quoted: message });
    }

    // Accept bare number or full JID
    if (!raw.includes('@')) raw = raw + '@s.whatsapp.net';

    const r = await resolve(sock, chatId, { jid: raw });

    const lines = [
        `│  📟 *JID    :* \`${raw}\``,
        `│  📱 *Number :* +${r.number || jidToNum(raw)}`,
        `│  🔑 *LID    :* \`${r.lid || 'not found in this context'}\``,
    ];
    await sock.sendMessage(chatId, { text: box('JID LOOKUP', lines) }, { quoted: message });
}

module.exports = { phoneCommand, lidCommand, jidCommand };
