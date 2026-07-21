'use strict';
/**
 * antimedia.js — Group content-blocking automation + admin protection
 *
 * Per-group toggles (all admin-only):
 *   $antiimage on/off    — delete images posted by non-admins
 *   $antivideo on/off    — delete videos posted by non-admins
 *   $antisticker on/off  — delete stickers posted by non-admins
 *   $antiaudio on/off    — delete audio messages posted by non-admins
 *   $antidemote on/off   — prevent non-owners from demoting admins (re-promotes)
 *   $antipromote on/off  — prevent non-owners from promoting members (re-demotes)
 *   $antimention on/off  — delete mass-mention (5+ tags) messages by non-admins
 *   $banlist             — show the group ban list
 *   $gctime              — show group creation date & age
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antimedia.json');

// ── Config helpers ─────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch { return {}; }
}
function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2)); } catch {}
}
function groupCfg(groupId) {
    const c = loadConfig();
    return c[groupId] || {};
}
function setGroupFlag(groupId, key, val) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    c[groupId][key] = val;
    saveConfig(c);
}
function isOn(groupId, key) { return !!groupCfg(groupId)[key]; }

// ── Auth helper ────────────────────────────────────────────────────────────────
async function checkAuth(sock, chatId, senderId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });
        return false;
    }
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (isOwner) return true;
    try {
        const meta = await sock.groupMetadata(chatId);
        const isAdmin = meta.participants.some(p => p.id === senderId && p.admin);
        if (isAdmin) return true;
    } catch {}
    await sock.sendMessage(chatId, { text: '❌ Only admins can use this command.' }, { quoted: message });
    return false;
}

// ── Generic toggle command factory ─────────────────────────────────────────────
function makeToggleCommand(key, label, emoji, description) {
    return async function(sock, chatId, senderId, message) {
        if (!await checkAuth(sock, chatId, senderId, message)) return;

        const text  = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const match = text.trim().split(/\s+/).slice(1).join(' ').trim().toLowerCase();
        const on    = isOn(chatId, key);

        if (!match || match === 'status') {
            return sock.sendMessage(chatId, {
                text: `╭━━━「 ${emoji} *${label.toUpperCase()}* 」━━━\n` +
                      `┃\n` +
                      `┃ Status: ${on ? '✅ Enabled' : '❌ Disabled'}\n` +
                      `┃\n` +
                      `┃ ▸ *$${key} on*  — Enable\n` +
                      `┃ ▸ *$${key} off* — Disable\n` +
                      `┃\n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                      `_${description}_\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        if (match === 'on') {
            if (on) return sock.sendMessage(chatId, { text: `⚠️ ${label} is already *enabled*.` }, { quoted: message });
            setGroupFlag(chatId, key, true);
            return sock.sendMessage(chatId, { text: `✅ *${label} enabled!*\n\n_${description}_\n\n_Daratech_ ⚡` }, { quoted: message });
        }
        if (match === 'off') {
            if (!on) return sock.sendMessage(chatId, { text: `⚠️ ${label} is already *disabled*.` }, { quoted: message });
            setGroupFlag(chatId, key, false);
            return sock.sendMessage(chatId, { text: `❌ *${label} disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
        }

        return sock.sendMessage(chatId,
            { text: `❌ Use *$${key} on* or *$${key} off*.` },
            { quoted: message });
    };
}

// ── Toggle commands ────────────────────────────────────────────────────────────
const antiimageCommand    = makeToggleCommand('antiimage',   'Anti-Image',   '🖼️', 'Auto-deletes images posted by non-admins');
const antivideoCommand    = makeToggleCommand('antivideo',   'Anti-Video',   '🎬', 'Auto-deletes videos posted by non-admins');
const antistickerCommand  = makeToggleCommand('antisticker', 'Anti-Sticker', '🎭', 'Auto-deletes stickers posted by non-admins');
const antiaudioCommand    = makeToggleCommand('antiaudio',   'Anti-Audio',   '🔊', 'Auto-deletes audio messages posted by non-admins');
const antidemoteCommand   = makeToggleCommand('antidemote',  'Anti-Demote',  '👑', 'Re-promotes admins if someone demotes them');
const antipromoteCommand  = makeToggleCommand('antipromote', 'Anti-Promote', '🛡️', 'Re-demotes members if promoted by non-owners');
const antimentionCommand  = makeToggleCommand('antimention', 'Anti-Mention', '📢', 'Auto-deletes mass @mention (5+) by non-admins');

// ── Message handler — called for every group message ──────────────────────────
async function handleAntiMediaMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const senderId = (message.key.participant || '').replace(/:\d+@/, '@');
        const cfg      = groupCfg(chatId);

        // Check if anything is enabled
        const anyEnabled = cfg.antiimage || cfg.antivideo || cfg.antisticker || cfg.antiaudio || cfg.antimention;
        if (!anyEnabled) return;

        // Determine if sender is admin
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(chatId);
            isAdmin = meta.participants.some(p => p.id === senderId && p.admin);
        } catch {}
        if (isAdmin) return; // admins are exempt

        const msg = message.message || {};
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (isOwner) return;

        let shouldDelete = false;
        let reason = '';

        if (cfg.antiimage && (msg.imageMessage || msg.viewOnceMessage?.message?.imageMessage)) {
            shouldDelete = true; reason = '🖼️ Anti-Image';
        } else if (cfg.antivideo && (msg.videoMessage || msg.viewOnceMessage?.message?.videoMessage)) {
            shouldDelete = true; reason = '🎬 Anti-Video';
        } else if (cfg.antisticker && msg.stickerMessage) {
            shouldDelete = true; reason = '🎭 Anti-Sticker';
        } else if (cfg.antiaudio && msg.audioMessage) {
            shouldDelete = true; reason = '🔊 Anti-Audio';
        } else if (cfg.antimention) {
            const mentions = msg.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length >= 5) { shouldDelete = true; reason = '📢 Anti-Mention'; }
        }

        if (!shouldDelete) return;

        // Per-type unique warning messages
        const warningMessages = {
            '🖼️ Anti-Image':   `🖼️ *Anti-Image Active*\n\n@${senderId.split('@')[0]} — images are restricted to admins only in this group. Keep the chat clean! 🚫📸`,
            '🎬 Anti-Video':   `🎬 *Anti-Video Active*\n\n@${senderId.split('@')[0]} — video posts are for admins only here. Don't flood the group! 🚫🎥`,
            '🎭 Anti-Sticker': `🎭 *Anti-Sticker Active*\n\n@${senderId.split('@')[0]} — sticker spam is disabled in this group. Text only please! 🚫🎭`,
            '🔊 Anti-Audio':   `🔊 *Anti-Audio Active*\n\n@${senderId.split('@')[0]} — voice notes and audio files are restricted to admins only. 🚫🎙️`,
            '📢 Anti-Mention': `📢 *Anti-Mention Active*\n\n@${senderId.split('@')[0]} — mass-mentioning members is not allowed here. Avoid spamming the group! 🚫📣`,
        };

        await sock.sendMessage(chatId, { delete: message.key });
        await sock.sendMessage(chatId, {
            text: warningMessages[reason] || `❌ *${reason}*\n\n@${senderId.split('@')[0]} — only admins can send this type of content here.`,
            mentions: [senderId]
        });

    } catch (err) {
        console.error('[antimedia]', err.message);
    }
}

// ── Participant update handler — antidemote / antipromote ─────────────────────
async function handleAntiPromoteDemote(sock, update) {
    try {
        const { id, participants, action, author } = update;
        if (!id?.endsWith('@g.us')) return;

        const cfg = groupCfg(id);
        const authorClean = (author || '').replace(/:\d+@/, '@');

        // Is the author an owner/sudo?
        const authorIsOwner = await isOwnerOrSudo(authorClean, sock, id);

        if (action === 'demote' && cfg.antidemote && !authorIsOwner) {
            // Re-promote the demoted participants
            await sock.groupParticipantsUpdate(id, participants, 'promote');
            await sock.sendMessage(id, {
                text: `👑 *Anti-Demote*\n\n@${authorClean.split('@')[0]} tried to demote an admin — action reversed.`,
                mentions: [authorClean]
            });
        }

        if (action === 'promote' && cfg.antipromote && !authorIsOwner) {
            // Re-demote the promoted participants
            await sock.groupParticipantsUpdate(id, participants, 'demote');
            await sock.sendMessage(id, {
                text: `🛡️ *Anti-Promote*\n\n@${authorClean.split('@')[0]} tried to promote a member — action reversed.`,
                mentions: [authorClean]
            });
        }
    } catch (err) {
        console.error('[antidemote/promote]', err.message);
    }
}

// ── $banlist ───────────────────────────────────────────────────────────────────
async function banlistCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });
    }

    try {
        // dara-bot stores bans in data/ban.json
        const banPath = path.join(__dirname, '../data/ban.json');
        if (!fs.existsSync(banPath)) {
            return sock.sendMessage(chatId, {
                text: '📋 *BAN LIST*\n\nNo banned members in this group.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        const allBans = JSON.parse(fs.readFileSync(banPath, 'utf8'));
        const bans    = (allBans[chatId] || []);

        if (!bans.length) {
            return sock.sendMessage(chatId, {
                text: '📋 *BAN LIST*\n\nNo banned members in this group.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        const list = bans.map((jid, i) => `${i + 1}. @${jid.split('@')[0]}`).join('\n');
        await sock.sendMessage(chatId, {
            text: `╭━━━「 🚫 *BAN LIST* 」━━━\n┃\n┃ ${bans.length} banned member(s):\n┃\n${list}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`,
            mentions: bans
        }, { quoted: message });

    } catch (err) {
        console.error('[banlist]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to load ban list.\n\n_Daratech_ ⚡' }, { quoted: message });
    }
}

// ── $gctime ────────────────────────────────────────────────────────────────────
async function gctimeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, { text: '❌ Group only command.' }, { quoted: message });
    }

    try {
        const meta      = await sock.groupMetadata(chatId);
        const createdAt = meta.creation ? new Date(meta.creation * 1000) : null;

        if (!createdAt) {
            return sock.sendMessage(chatId, {
                text: '❌ Could not retrieve group creation date.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        const now     = new Date();
        const diffMs  = now - createdAt;
        const days    = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const years   = Math.floor(days / 365);
        const months  = Math.floor((days % 365) / 30);
        const remDays = days % 30;

        const ageParts = [];
        if (years)    ageParts.push(`${years} year${years > 1 ? 's' : ''}`);
        if (months)   ageParts.push(`${months} month${months > 1 ? 's' : ''}`);
        if (remDays)  ageParts.push(`${remDays} day${remDays > 1 ? 's' : ''}`);
        const age = ageParts.join(', ') || 'Today';

        const dateStr = createdAt.toLocaleDateString('en-GB', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const timeStr = createdAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        await sock.sendMessage(chatId, {
            text: `╭━━━「 🕐 *GROUP AGE* 」━━━\n` +
                  `┃\n` +
                  `┃ 👥 *${meta.subject}*\n` +
                  `┃\n` +
                  `┃ 📅 Created: ${dateStr}\n` +
                  `┃ 🕐 Time:    ${timeStr} UTC\n` +
                  `┃ 🗓️ Age:     ${age}\n` +
                  `┃ 📊 Members: ${meta.participants.length}\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[gctime]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Could not fetch group info.\n\n_Daratech_ ⚡' }, { quoted: message });
    }
}

module.exports = {
    antiimageCommand, antivideoCommand, antistickerCommand, antiaudioCommand,
    antidemoteCommand, antipromoteCommand, antimentionCommand,
    banlistCommand, gctimeCommand,
    handleAntiMediaMessage, handleAntiPromoteDemote,
};
