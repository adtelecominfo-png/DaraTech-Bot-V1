'use strict';
/**
 * antigcstatus.js — Block non-admins from posting Group Channel Status updates
 *
 * In newer WhatsApp, group members can post to the group's own status/updates
 * channel. This command detects those posts from non-admins and takes action.
 *
 * $antigcstatus on                — enable (default action: delete)
 * $antigcstatus off               — disable
 * $antigcstatus action delete     — delete the status post
 * $antigcstatus action warn       — warn the member
 * $antigcstatus action kick       — kick the member
 * $antigcstatus autodelete on|off — toggle auto-delete alongside warn/kick
 * $antigcstatus get               — show current config
 * Aliases: $agcs
 *
 * Admin-only, group-only.
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');

const CONFIG_PATH = path.join(__dirname, '../data/antigcstatus.json');

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
    } catch (e) { console.error('[antigcstatus/save]', e.message); }
}
function getGroupCfg(groupId) {
    return loadConfig()[groupId] || {};
}
function setGroupFlags(groupId, updates) {
    const c = loadConfig();
    if (!c[groupId]) c[groupId] = {};
    Object.assign(c[groupId], updates);
    saveConfig(c);
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

async function antigcstatusCommand(sock, chatId, senderId, message) {
    if (!await checkAuth(sock, chatId, senderId, message)) return;

    const raw    = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const args   = raw.split(/\s+/).slice(1).map(a => a.toLowerCase());
    const sub    = args[0];
    const cfg    = getGroupCfg(chatId);
    const isOn   = !!cfg.antigcstatus;
    const action = cfg.antigcstatusAction || 'delete';
    const autoDel = cfg.antigcstatusAutoDelete !== false; // default true

    if (!sub || sub === 'get' || sub === 'status') {
        return sock.sendMessage(chatId, {
            text: `╭━━━「 🚫 *ANTI GC STATUS* 」━━━\n` +
                  `┃\n` +
                  `┃ Status:      ${isOn ? '✅ Enabled' : '❌ Disabled'}\n` +
                  `┃ Action:      *${action}*\n` +
                  `┃ Auto-Delete: *${autoDel ? 'yes' : 'no'}*\n` +
                  `┃\n` +
                  `┃ ▸ *$antigcstatus on*\n` +
                  `┃ ▸ *$antigcstatus off*\n` +
                  `┃ ▸ *$antigcstatus action delete|warn|kick*\n` +
                  `┃ ▸ *$antigcstatus autodelete on|off*\n` +
                  `┃ ▸ *$antigcstatus get*\n` +
                  `┃\n` +
                  `┃ Blocks non-admins from posting\n` +
                  `┃ to this group's status channel.\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'on') {
        if (isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti GC Status is already *enabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigcstatus: true, antigcstatusAction: action, antigcstatusAutoDelete: autoDel });
        return sock.sendMessage(chatId, {
            text: `✅ *Anti GC Status enabled!*\n\nNon-admin group status posts will be *${action}d*.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'off') {
        if (!isOn) return sock.sendMessage(chatId, { text: '⚠️ Anti GC Status is already *disabled*.' }, { quoted: message });
        setGroupFlags(chatId, { antigcstatus: false });
        return sock.sendMessage(chatId, { text: `✅ *Anti GC Status disabled.*\n\n_Daratech_ ⚡` }, { quoted: message });
    }

    if (sub === 'action') {
        const newAction = args[1];
        if (!newAction || !['delete', 'warn', 'kick'].includes(newAction)) {
            return sock.sendMessage(chatId, {
                text: `❌ Invalid action.\n\nUse:\n▸ *$antigcstatus action delete*\n▸ *$antigcstatus action warn*\n▸ *$antigcstatus action kick*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }
        setGroupFlags(chatId, { antigcstatusAction: newAction, antigcstatus: true });
        return sock.sendMessage(chatId, {
            text: `✅ *Anti GC Status action set to ${newAction} and enabled!*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    if (sub === 'autodelete') {
        const val = args[1];
        if (!val || !['on', 'off'].includes(val)) {
            return sock.sendMessage(chatId, { text: '❌ Use *$antigcstatus autodelete on* or *off*.' }, { quoted: message });
        }
        setGroupFlags(chatId, { antigcstatusAutoDelete: val === 'on' });
        return sock.sendMessage(chatId, {
            text: `✅ Auto-delete *${val === 'on' ? 'enabled' : 'disabled'}*.\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    return sock.sendMessage(chatId, { text: '❓ Unknown option. Use *$antigcstatus* to see usage.\n\n_Daratech_ ⚡' }, { quoted: message });
}

// ── Detection hook ─────────────────────────────────────────────────────────────
async function handleAntigcstatusMessage(sock, message) {
    try {
        const chatId = message.key.remoteJid;
        if (!chatId?.endsWith('@g.us')) return;
        if (message.key.fromMe) return;

        const cfg = getGroupCfg(chatId);
        if (!cfg.antigcstatus) return;

        const msg = message.message;
        if (!msg) return;

        // Detect group status post: groupStatusMessageV2 or groupStatusMessage
        const isGroupStatusPost = !!(
            msg.groupStatusMessageV2 ||
            msg.groupStatusMessage   ||
            // Also catch it wrapped in ephemeral
            msg.ephemeralMessage?.message?.groupStatusMessageV2 ||
            msg.ephemeralMessage?.message?.groupStatusMessage
        );

        if (!isGroupStatusPost) return;

        const senderId = message.key.participant || chatId;

        // Skip admins and owner
        try {
            const meta = await sock.groupMetadata(chatId);
            const sender = meta.participants.find(p => p.id === senderId);
            if (sender?.admin) return;
            if (await isOwnerOrSudo(senderId, sock, chatId)) return;
        } catch { return; }

        const action  = cfg.antigcstatusAction || 'delete';
        const autoDel = cfg.antigcstatusAutoDelete !== false;

        // Auto-delete the status post
        if (autoDel || action === 'delete') {
            try {
                await sock.sendMessage(chatId, {
                    delete: { remoteJid: chatId, fromMe: false, id: message.key.id, participant: senderId }
                });
            } catch {}
        }

        const tag = `@${senderId.split('@')[0]}`;

        if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Anti GC Status*\n\n${tag} was kicked for posting a group status.\n\n_Daratech_ ⚡`,
                    mentions: [senderId],
                });
            } catch {}
        } else if (action === 'warn') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Anti GC Status*\n\n${tag}, only admins are allowed to post group status updates here.\n\n_Daratech_ ⚡`,
                mentions: [senderId],
            });
        }
        // action === 'delete' already handled above (no extra message)
    } catch (err) {
        console.error('[antigcstatus/detect]', err.message);
    }
}

module.exports = { antigcstatusCommand, handleAntigcstatusMessage };
