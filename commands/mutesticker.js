'use strict';
/**
 * mutesticker.js — Block/unblock a specific user's stickers
 *
 * When a user is sticker-muted, any sticker they send is silently deleted.
 * Their text messages are unaffected.
 *
 * $mutesticker @user       — mute stickers from a user (reply or tag)
 * $unmutesticker @user     — restore sticker access for a user
 * $stickerlist             — list all sticker-muted users in this group
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/mutesticker.json');

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8').trim();
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}
function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch (e) { console.error('[mutesticker/save]', e.message); }
}
function getMuted(groupId) { return loadConfig()[groupId] || []; }
function setMuted(groupId, list) {
    const c = loadConfig();
    c[groupId] = list;
    saveConfig(c);
}

// Resolve target JID from reply or mention
function resolveTarget(message) {
    // From reply
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return ctx.participant.replace(/:\d+@/, '@');
    if (ctx?.remoteJid && ctx.remoteJid !== message.key.remoteJid) return ctx.remoteJid;
    // From mentions
    const mentions = ctx?.mentionedJid;
    if (mentions?.length) return mentions[0];
    return null;
}

async function checkAuth(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Group-only command.' }, { quoted: message });
        return false;
    }
    if (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId)) return true;
    try {
        const meta = await sock.groupMetadata(chatId);
        if (meta.participants.some(p => p.id === senderId && p.admin)) return true;
    } catch {}
    await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
    return false;
}

async function mutestickerCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const target = resolveTarget(message);
    if (!target) {
        return sock.sendMessage(chatId, {
            text: `❌ *Usage:* Reply to a message or tag a user.\n▸ *$mutesticker @user*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    const muted = getMuted(chatId);
    if (muted.includes(target)) {
        return sock.sendMessage(chatId, {
            text: `⚠️ @${target.split('@')[0]} is already sticker-muted.`,
            mentions: [target],
        }, { quoted: message });
    }

    muted.push(target);
    setMuted(chatId, muted);
    return sock.sendMessage(chatId, {
        text: `🚫 *Sticker Muted*\n\n@${target.split('@')[0]}'s stickers will now be deleted automatically.\n\n_Daratech_ ⚡`,
        mentions: [target],
    }, { quoted: message });
}

async function unmutestickerCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const target = resolveTarget(message);
    if (!target) {
        return sock.sendMessage(chatId, {
            text: `❌ *Usage:* Reply to a message or tag a user.\n▸ *$unmutesticker @user*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    const muted = getMuted(chatId);
    if (!muted.includes(target)) {
        return sock.sendMessage(chatId, {
            text: `⚠️ @${target.split('@')[0]} is not sticker-muted.`,
            mentions: [target],
        }, { quoted: message });
    }

    setMuted(chatId, muted.filter(j => j !== target));
    return sock.sendMessage(chatId, {
        text: `✅ *Sticker Unmuted*\n\n@${target.split('@')[0]} can now send stickers again.\n\n_Daratech_ ⚡`,
        mentions: [target],
    }, { quoted: message });
}

async function stickerlistCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const muted = getMuted(chatId);
    if (!muted.length) {
        return sock.sendMessage(chatId, { text: '✅ No sticker-muted users in this group.' }, { quoted: message });
    }
    return sock.sendMessage(chatId, {
        text: `🚫 *Sticker-Muted Members (${muted.length}):*\n\n${muted.map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n')}\n\n_Daratech_ ⚡`,
        mentions: muted,
    }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
function isStickerMessage(msg) {
    if (!msg) return false;
    if (msg.stickerMessage) return true;
    if (msg.ephemeralMessage?.message?.stickerMessage) return true;
    return false;
}

async function handleMuteSticker(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        if (!isStickerMessage(message.message)) return;

        const senderId = message.key.participant || chatId;
        const muted    = getMuted(chatId);
        if (!muted.includes(senderId)) return;

        // Delete the sticker silently
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId }
            });
        } catch {}
    } catch (err) {
        console.error('[mutesticker/detect]', err.message);
    }
}

module.exports = { mutestickerCommand, unmutestickerCommand, stickerlistCommand, handleMuteSticker };
