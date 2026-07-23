'use strict';
/**
 * groupperms.js — Group permission toggles
 *
 * $gperm                  — show current group permission settings
 * $editinfo on|off        — members can/cannot edit group info (name, icon, desc)
 * $memberadd on|off       — members can/cannot add other members
 * $invitelink on|off      — members can/cannot invite via link or QR code
 * $approval on|off        — admins must/not approve new members before they join
 *
 * All commands: group-only, caller must be admin, bot must be admin.
 */

const isAdmin = require('../lib/isAdmin');

// ── Guards ────────────────────────────────────────────────────────────────────
function groupOnly(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return false;
    }
    return true;
}

async function adminGuard(sock, chatId, senderId, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
        return false;
    }
    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
        return false;
    }
    return true;
}

function parseOnOff(arg, cmdName, usageHint) {
    const v = (arg || '').toLowerCase().trim();
    if (v !== 'on' && v !== 'off') return null;
    return v;
}

// ── $gperm — show current permissions ────────────────────────────────────────
async function gpermCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);

        // announce: true → only admins send (group "closed")
        // restrict: true → only admins edit group info (locked)
        // memberAddMode: 'admin_add' → only admins can add / invite
        // joinApprovalMode: 'on' → approval required
        const sendMsgs    = meta.announce      ? '🔒 Admins only'  : '✅ All members';
        const editInfo    = meta.restrict      ? '🔒 Admins only'  : '✅ All members';
        const memberAdd   = (meta.memberAddMode   === 'admin_add') ? '🔒 Admins only' : '✅ All members';
        const invLink     = (meta.memberAddMode   === 'admin_add') ? '🔒 Admins only' : '✅ All members';
        const approval    = (meta.joinApprovalMode === 'on')       ? '✅ On (required)' : '🔓 Off';

        return sock.sendMessage(chatId, {
            text: [
                '╭─「 ⚙️ *Group Permissions* 」',
                '│',
                `│  📋 *${meta.subject}*`,
                '│',
                '├─ *Members Can:*',
                `│  ✏️  Edit group settings : ${editInfo}`,
                `│  💬  Send new messages   : ${sendMsgs}`,
                `│  ➕  Add other members   : ${memberAdd}`,
                `│  🔗  Invite via link     : ${invLink}`,
                '│',
                '├─ *Admins Can:*',
                `│  ✔️  Approve new members : ${approval}`,
                '│',
                '├─ *Toggle Commands:*',
                '│  $editinfo on/off',
                '│  $memberadd on/off',
                '│  $invitelink on/off',
                '│  $approval on/off',
                '╰───────────────────────',
            ].join('\n'),
        }, { quoted: message });
    } catch (e) {
        console.error('[gperm]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to fetch group settings.\n${e.message}` }, { quoted: message });
    }
}

// ── $editinfo on|off ──────────────────────────────────────────────────────────
async function editinfoCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $editinfo on | off',
                '',
                '• *on*  — all members can edit the group name, icon & description',
                '• *off* — only admins can edit group settings',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        // 'unlocked' → members can edit | 'locked' → admins only
        await sock.groupSettingUpdate(chatId, state === 'on' ? 'unlocked' : 'locked');
        return sock.sendMessage(chatId, {
            text: state === 'on'
                ? '✅ *Edit group settings — ON*\nAll members can now edit the group name, icon, and description.'
                : '🔒 *Edit group settings — OFF*\nOnly admins can now edit group settings.',
        }, { quoted: message });
    } catch (e) {
        console.error('[editinfo]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

// ── $memberadd on|off ─────────────────────────────────────────────────────────
async function memberaddCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $memberadd on | off',
                '',
                '• *on*  — all members can add others to the group',
                '• *off* — only admins can add members',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        const mode = state === 'on' ? 'all_member_add' : 'admin_add';
        if (typeof sock.groupMemberAddMode === 'function') {
            await sock.groupMemberAddMode(chatId, mode);
        } else {
            // Older Baileys builds expose this via groupSettingUpdate
            await sock.groupSettingUpdate(chatId, mode);
        }
        return sock.sendMessage(chatId, {
            text: state === 'on'
                ? '✅ *Add members — ON*\nAll members can now add others to the group.'
                : '🔒 *Add members — OFF*\nOnly admins can now add members.',
        }, { quoted: message });
    } catch (e) {
        console.error('[memberadd]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

// ── $invitelink on|off ────────────────────────────────────────────────────────
async function invitelinkCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $invitelink on | off',
                '',
                '• *on*  — members can share the invite link / QR code',
                '• *off* — only admins can share the invite link',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        // WhatsApp uses the same member_add_mode to gate link sharing
        const mode = state === 'on' ? 'all_member_add' : 'admin_add';
        if (typeof sock.groupMemberAddMode === 'function') {
            await sock.groupMemberAddMode(chatId, mode);
        } else {
            await sock.groupSettingUpdate(chatId, mode);
        }
        return sock.sendMessage(chatId, {
            text: state === 'on'
                ? '✅ *Invite via link — ON*\nAll members can now share the group invite link or QR code.'
                : '🔒 *Invite via link — OFF*\nOnly admins can share the invite link now.',
        }, { quoted: message });
    } catch (e) {
        console.error('[invitelink]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

// ── $approval on|off ──────────────────────────────────────────────────────────
async function approvalCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $approval on | off',
                '',
                '• *on*  — admins must approve anyone who wants to join',
                '• *off* — anyone can join without admin approval',
                '',
                '_When on, use *$pending*, *$accept*, *$reject* to manage requests._',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        if (typeof sock.groupJoinApprovalMode === 'function') {
            await sock.groupJoinApprovalMode(chatId, state);
        } else {
            // Fallback for Baileys builds without the dedicated helper
            await sock.groupSettingUpdate(
                chatId,
                state === 'on' ? 'membership_approval_mode' : 'not_membership_approval_mode'
            );
        }
        return sock.sendMessage(chatId, {
            text: state === 'on'
                ? '✅ *Admin approval — ON*\nAdmins must now approve every join request.\n\nUse *$pending* to view requests, *$accept* / *$reject* to action them.'
                : '🔓 *Admin approval — OFF*\nAnyone with the invite link can now join without approval.',
        }, { quoted: message });
    } catch (e) {
        console.error('[approval]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

module.exports = {
    gpermCommand,
    editinfoCommand,
    memberaddCommand,
    invitelinkCommand,
    approvalCommand,
};
