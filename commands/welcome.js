'use strict';
const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const fetch = require('node-fetch');

async function welcomeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'This command can only be used in groups.' });
        return;
    }
    const text = message.message?.conversation ||
                 message.message?.extendedTextMessage?.text || '';
    const matchText = text.split(' ').slice(1).join(' ');
    await handleWelcome(sock, chatId, message, matchText);
}

async function handleJoinEvent(sock, id, participants) {
    if (!await isWelcomeOn(id)) return;

    const customMessage = await getWelcome(id);
    let groupMetadata;
    try {
        groupMetadata = await sock.groupMetadata(id);
    } catch {
        return;
    }
    const groupName  = groupMetadata.subject;
    const groupDesc  = groupMetadata.desc?.trim() || '';
    const memberCount = groupMetadata.participants.length;

    for (const participant of participants) {
        try {
            // ── 1. Resolve real JID (LID → s.whatsapp.net) ──────────────────
            let jid = typeof participant === 'string'
                ? participant
                : (participant.id || String(participant));

            if (jid.endsWith('@lid')) {
                const match = groupMetadata.participants.find(
                    p => p.lid === jid || p.id === jid
                );
                if (match?.id?.endsWith('@s.whatsapp.net')) jid = match.id;
            }

            // ── 2. Clean phone number (strip :device suffix if any) ──────────
            const rawLocal = jid.split('@')[0];
            const phone    = rawLocal.includes(':') ? rawLocal.split(':')[0] : rawLocal;

            // ── 3. Build caption ─────────────────────────────────────────────
            let caption;
            if (customMessage) {
                caption = customMessage
                    .replace(/{user}/g,        `@${phone}`)
                    .replace(/{group}/g,        groupName)
                    .replace(/{description}/g,  groupDesc);
            } else {
                caption =
                    `✦ *WELCOME TO ${groupName.toUpperCase()}* ✦\n\n` +
                    `👤 *Member:* @${phone}\n` +
                    `👥 *Count:*  #${memberCount}\n` +
                    (groupDesc ? `\n📋 ${groupDesc}\n` : '') +
                    `\n_Daratech_ ⚡`;
            }

            // ── 4. Fetch profile picture directly (fast, no 3rd-party API) ──
            let ppBuf = null;
            try {
                const ppUrl = await sock.profilePictureUrl(jid, 'image');
                if (ppUrl) {
                    const res = await fetch(ppUrl);
                    if (res.ok) ppBuf = await res.buffer();
                }
            } catch { /* no PP — send text fallback */ }

            // ── 5. Send — no contextInfo/forwarded metadata ──────────────────
            if (ppBuf) {
                await sock.sendMessage(id, {
                    image:    ppBuf,
                    caption,
                    mentions: [jid],
                });
            } else {
                await sock.sendMessage(id, {
                    text:     caption,
                    mentions: [jid],
                });
            }

        } catch (err) {
            console.error('[welcome]', err.message);
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
