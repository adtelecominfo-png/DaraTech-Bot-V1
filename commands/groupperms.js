'use strict';
/**
 * groupperms.js — Group permission toggles
 *
 * $gperm                  — show all current group permission settings
 * $editinfo on|off        — members can/cannot edit group info (name, icon, desc)
 * $memberadd on|off       — members can/cannot add other members directly
 * $invitelink on|off      — toggle invite link (off = revoke link, on = fresh link sent)
 * $approval on|off        — admins must/not approve new members before they join
 *
 * All commands: group-only, caller must be admin, bot must be admin.
 * Every command reads current state from metadata before acting.
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

function parseOnOff(arg) {
    const v = (arg || '').toLowerCase().trim();
    if (v !== 'on' && v !== 'off') return null;
    return v;
}

// ── $gperm — show current permissions ────────────────────────────────────────
async function gpermCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);

        // Resolve each permission from metadata
        const editInfo  = meta.restrict      ? '🔒 OFF — admins only'   : '✅ ON  — all members';
        const sendMsgs  = meta.announce      ? '🔒 OFF — admins only'   : '✅ ON  — all members';
        const memberAdd = meta.memberAddMode ? '✅ ON  — all members'   : '🔒 OFF — admins only';

        // Invite link: try to fetch current invite code — if it exists link is active
        let invLink = '✅ ON  — active';
        try {
            const code = await sock.groupInviteCode(chatId);
            invLink = code ? '✅ ON  — active' : '🔒 OFF — revoked';
        } catch { invLink = '❓ unknown'; }

        const approval   = meta.joinApprovalMode
                        ? '✅ ON  — approval required'
                        : '🔓 OFF — anyone can join';

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
                '│  $msghistory on/off',
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
        // Read current state first
        const meta       = await sock.groupMetadata(chatId);
        const currentlyOn = !meta.restrict; // restrict:true → locked → members CANNOT edit
        const currentStr  = currentlyOn ? '✅ ON' : '🔒 OFF';

        if ((state === 'on') === currentlyOn) {
            return sock.sendMessage(chatId, {
                text: `ℹ️ *Edit group settings* is already *${currentStr}*. No change made.`,
            }, { quoted: message });
        }

        // 'unlocked' → members can edit | 'locked' → admins only
        await sock.groupSettingUpdate(chatId, state === 'on' ? 'unlocked' : 'locked');

        return sock.sendMessage(chatId, {
            text: [
                `⚙️ *Edit group settings updated*`,
                `│`,
                `│  Was  : ${currentStr}`,
                `│  Now  : ${state === 'on' ? '✅ ON' : '🔒 OFF'}`,
                `│`,
                state === 'on'
                    ? '│  All members can now edit the group name, icon & description.'
                    : '│  Only admins can now change group settings.',
            ].join('\n'),
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
                '• *on*  — all members can add others directly to the group',
                '• *off* — only admins can add members',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        // Read current state first
        const meta        = await sock.groupMetadata(chatId);
        const currentlyOn = !!meta.memberAddMode;
        const currentStr  = currentlyOn ? '✅ ON' : '🔒 OFF';

        if ((state === 'on') === currentlyOn) {
            return sock.sendMessage(chatId, {
                text: `ℹ️ *Add members* is already *${currentStr}*. No change made.`,
            }, { quoted: message });
        }

        const mode = state === 'on' ? 'all_member_add' : 'admin_add';
        if (typeof sock.groupMemberAddMode === 'function') {
            await sock.groupMemberAddMode(chatId, mode);
        } else {
            await sock.groupSettingUpdate(chatId, mode);
        }

        return sock.sendMessage(chatId, {
            text: [
                `⚙️ *Add members updated*`,
                `│`,
                `│  Was  : ${currentStr}`,
                `│  Now  : ${state === 'on' ? '✅ ON' : '🔒 OFF'}`,
                `│`,
                state === 'on'
                    ? '│  All members can now add others to the group.'
                    : '│  Only admins can now add new members.',
            ].join('\n'),
        }, { quoted: message });
    } catch (e) {
        console.error('[memberadd]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

// ── $invitelink on|off ────────────────────────────────────────────────────────
// OFF → revoke the invite link (old link is invalidated, a fresh one is generated
//       but not shared — so effectively only admins with bot access can get it)
// ON  → fetch & send the current invite link (confirms it is active)
async function invitelinkCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $invitelink on | off',
                '',
                '• *on*  — fetch & confirm the active invite link',
                '• *off* — revoke the current invite link (old link stops working)',
                '',
                '_Note: $resetlink also revokes the link and returns the new one._',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        if (state === 'off') {
            // Revoke the current invite link
            const newCode = await sock.groupRevokeInvite(chatId);
            return sock.sendMessage(chatId, {
                text: [
                    '🔒 *Invite link — OFF (revoked)*',
                    '│',
                    '│  The old invite link has been revoked.',
                    '│  Nobody can join via the previous link anymore.',
                    '│',
                    newCode
                        ? `│  A new code has been generated (not shared).\n│  Use *$invitelink on* to view & share it.`
                        : '│  Use *$invitelink on* when you want to re-enable link sharing.',
                ].join('\n'),
            }, { quoted: message });
        }

        // state === 'on' — fetch current invite link and share it
        const code = await sock.groupInviteCode(chatId);
        const link = `https://chat.whatsapp.com/${code}`;
        return sock.sendMessage(chatId, {
            text: [
                '✅ *Invite link — ON (active)*',
                '│',
                `│  🔗 ${link}`,
                '│',
                '│  Members can now use this link to join.',
                '│  Use *$invitelink off* to revoke it.',
            ].join('\n'),
        }, { quoted: message });
    } catch (e) {
        console.error('[invitelink]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update invite link.\n${e.message}` }, { quoted: message });
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
        // Read current state first
        const meta        = await sock.groupMetadata(chatId);
        const currentlyOn = !!meta.joinApprovalMode;
        const currentStr  = currentlyOn ? '✅ ON' : '🔓 OFF';

        if ((state === 'on') === currentlyOn) {
            return sock.sendMessage(chatId, {
                text: `ℹ️ *Admin approval* is already *${currentStr}*. No change made.`,
            }, { quoted: message });
        }

        if (typeof sock.groupJoinApprovalMode === 'function') {
            await sock.groupJoinApprovalMode(chatId, state === 'on');
        } else {
            await sock.groupSettingUpdate(
                chatId,
                state === 'on' ? 'membership_approval_mode' : 'not_membership_approval_mode'
            );
        }

        return sock.sendMessage(chatId, {
            text: [
                `⚙️ *Admin approval updated*`,
                `│`,
                `│  Was  : ${currentStr}`,
                `│  Now  : ${state === 'on' ? '✅ ON' : '🔓 OFF'}`,
                `│`,
                state === 'on'
                    ? '│  Admins must now approve every join request.\n│  Use *$pending* / *$accept* / *$reject* to manage.'
                    : '│  Anyone with the invite link can now join without approval.',
            ].join('\n'),
        }, { quoted: message });
    } catch (e) {
        console.error('[approval]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

// ── $msghistory on|off ────────────────────────────────────────────────────────
// Controls whether members can send past message history to newly joined members.
async function msghistoryCommand(sock, chatId, senderId, message, arg) {
    if (!groupOnly(sock, chatId, message)) return;
    if (!await adminGuard(sock, chatId, senderId, message)) return;

    const state = parseOnOff(arg);
    if (!state) {
        return sock.sendMessage(chatId, {
            text: [
                '❌ *Usage:* $msghistory on | off',
                '',
                '• *on*  — members can send past messages to newly joined members',
                '• *off* — new members start fresh with no past message history',
            ].join('\n'),
        }, { quoted: message });
    }

    try {
        const setting = state === 'on' ? 'member_history_full_access' : 'not_member_history_full_access';
        try {
            await sock.groupSettingUpdate(chatId, setting);
        } catch {
            await sock.groupSettingUpdate(chatId, state === 'on' ? 'history_full_access' : 'not_history_full_access');
        }

        return sock.sendMessage(chatId, {
            text: [
                `⚙️ *Send message history updated*`,
                `│`,
                `│  Now  : ${state === 'on' ? '✅ ON' : '🔒 OFF'}`,
                `│`,
                state === 'on'
                    ? '│  Members can now send past messages to newly joined members.'
                    : '│  New members will no longer receive past message history.',
            ].join('\n'),
        }, { quoted: message });
    } catch (e) {
        console.error('[msghistory]', e.message);
        return sock.sendMessage(chatId, { text: `❌ Failed to update setting.\n${e.message}` }, { quoted: message });
    }
}

module.exports = {
    gpermCommand,
    editinfoCommand,
    memberaddCommand,
    invitelinkCommand,
    approvalCommand,
    msghistoryCommand,
};

