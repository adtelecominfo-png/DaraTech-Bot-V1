// commands/group.js — Comprehensive group management commands
'use strict';

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const isAdmin = require('../lib/isAdmin');
const isOwnerOrSudo = require('../lib/isOwner');

/* ── helpers ──────────────────────────────────────────────────────────── */

function groupOnly(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' }, { quoted: message });
        return false;
    }
    return true;
}

function getBotJid(sock) {
    const id = sock.user?.id || '';
    const phone = id.includes(':') ? id.split(':')[0] : id.split('@')[0];
    return phone + '@s.whatsapp.net';
}

function getMentioned(message) {
    return message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function getQuotedParticipant(message) {
    return message.message?.extendedTextMessage?.contextInfo?.participant || null;
}

async function adminCheck(sock, chatId, senderId, message) {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);
    if (!isBotAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Please make the bot an admin first.' }, { quoted: message });
        return null;
    }
    if (!isSenderAdmin) {
        await sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.' }, { quoted: message });
        return null;
    }
    return { isSenderAdmin, isBotAdmin };
}

/* ── EVERYONE ─────────────────────────────────────────────────────────── */
async function everyoneCommand(sock, chatId, senderId, userMessage, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants || [];
        const caption = userMessage.slice(9).trim() || '📢 *Attention Everyone!*';
        let msg = `${caption}\n\n`;
        participants.forEach(p => { msg += `@${p.id.split('@')[0]}\n`; });

        await sock.sendMessage(chatId, {
            text: msg.trim(),
            mentions: participants.map(p => p.id)
        });
    } catch (e) {
        console.error('[everyone]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to tag everyone.' }, { quoted: message });
    }
}

/* ── LEAVEGC ──────────────────────────────────────────────────────────── */
async function leavegcCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const senderId = message.key.participant || message.key.remoteJid;
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner can use this command.' }, { quoted: message });
        }
        await sock.sendMessage(chatId, { text: '👋 *Goodbye!*\n\nBot is leaving the group as requested.' });
        setTimeout(() => sock.groupLeave(chatId), 2000);
    } catch (e) {
        console.error('[leavegc]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to leave group.' }, { quoted: message });
    }
}

/* ── JOIN ─────────────────────────────────────────────────────────────── */
async function joinCommand(sock, chatId, senderId, userMessage, message) {
    try {
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner can use $join.' }, { quoted: message });
        }
        const link = userMessage.slice(5).trim();
        if (!link) {
            return sock.sendMessage(chatId, { text: '❌ Usage: $join https://chat.whatsapp.com/xxxxxx' }, { quoted: message });
        }
        const match = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
        if (!match) {
            return sock.sendMessage(chatId, { text: '❌ Invalid invite link format.' }, { quoted: message });
        }
        await sock.groupAcceptInvite(match[1]);
        await sock.sendMessage(chatId, { text: '✅ Successfully joined the group!' }, { quoted: message });
    } catch (e) {
        console.error('[join]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to join. Link may be invalid or expired.' }, { quoted: message });
    }
}

/* ── INVITE ───────────────────────────────────────────────────────────── */
async function inviteCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const meta = await sock.groupMetadata(chatId);
        const code = await sock.groupInviteCode(chatId);
        const link = `https://chat.whatsapp.com/${code}`;

        const targets = getMentioned(message);
        const qp = getQuotedParticipant(message);
        if (qp && !targets.includes(qp)) targets.push(qp);

        if (targets.length === 0) {
            return sock.sendMessage(chatId, {
                text: `🔗 *Group Invite Link*\n\n📌 *${meta.subject}*\n\n${link}\n\n_Tip: Tag someone with $invite @user to DM them the link._`
            }, { quoted: message });
        }

        for (const jid of targets) {
            await sock.sendMessage(jid, {
                text: `👋 You've been invited to join *${meta.subject}*!\n\n🔗 ${link}`
            });
        }
        await sock.sendMessage(chatId, {
            text: `✅ Invite sent to ${targets.map(j => '@' + j.split('@')[0]).join(', ')}`,
            mentions: targets
        }, { quoted: message });
    } catch (e) {
        console.error('[invite]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to send invite.' }, { quoted: message });
    }
}

/* ── GETNAME ──────────────────────────────────────────────────────────── */
async function getnameCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            text: `📌 *Group Name*\n\n${meta.subject}`
        }, { quoted: message });
    } catch (e) {
        console.error('[getname]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get group name.' }, { quoted: message });
    }
}

/* ── GETDESKGC ────────────────────────────────────────────────────────── */
async function getdeskgcCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        const desc = meta.desc?.toString()?.trim() || '_No description set._';
        await sock.sendMessage(chatId, {
            text: `📝 *Group Description*\n\n${desc}`
        }, { quoted: message });
    } catch (e) {
        console.error('[getdeskgc]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to get group description.' }, { quoted: message });
    }
}

/* ── GETPPGC ──────────────────────────────────────────────────────────── */
async function getppgcCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        let ppUrl;
        try { ppUrl = await sock.profilePictureUrl(chatId, 'image'); } catch { ppUrl = null; }
        if (!ppUrl) {
            return sock.sendMessage(chatId, { text: '❌ This group has no profile picture.' }, { quoted: message });
        }
        const res = await axios.get(ppUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(res.data, 'binary');
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            image: buffer,
            caption: `🖼️ *Group Profile Picture*\n📌 ${meta.subject}`
        }, { quoted: message });
    } catch (e) {
        console.error('[getppgc]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch group profile picture.' }, { quoted: message });
    }
}

/* ── SETPPGC ──────────────────────────────────────────────────────────── */
async function setppgcCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const imageMessage = quoted?.imageMessage || quoted?.stickerMessage;
        if (!imageMessage) {
            return sock.sendMessage(chatId, { text: '↩️ Reply to an image or sticker with $setppgc' }, { quoted: message });
        }

        const tmpDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        const stream = await downloadContentFromMessage(imageMessage, 'image');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);

        const imgPath = path.join(tmpDir, `setppgc_${Date.now()}.jpg`);
        fs.writeFileSync(imgPath, buffer);

        await sock.updateProfilePicture(chatId, { url: imgPath });
        try { fs.unlinkSync(imgPath); } catch (_) {}

        await sock.sendMessage(chatId, { text: '✅ Group profile picture updated!' }, { quoted: message });
    } catch (e) {
        console.error('[setppgc]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to update group profile picture.' }, { quoted: message });
    }
}

/* ── SVCONTACT ────────────────────────────────────────────────────────── */
async function svcontactCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        const participants = meta.participants;
        let vcfData = '';

        for (const p of participants) {
            const number = p.id.split('@')[0];
            let name = p.notify || p.pushName || `Daratech-${number}`;
            name = name.replace(/[;,]/g, '').trim();
            vcfData += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL:+${number}\nEND:VCARD\n`;
        }

        if (!vcfData) return sock.sendMessage(chatId, { text: '❌ No contacts to export.' }, { quoted: message });

        const safeName = meta.subject.replace(/[^a-zA-Z0-9_-]/g, '_');
        await sock.sendMessage(chatId, {
            document: Buffer.from(vcfData, 'utf-8'),
            mimetype: 'text/x-vcard',
            fileName: `${safeName}_contacts.vcf`,
            caption: `📇 Exported *${participants.length}* contacts from *${meta.subject}*`
        }, { quoted: message });
    } catch (e) {
        console.error('[svcontact]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to export contacts.' }, { quoted: message });
    }
}

/* ── OPENGROUP ────────────────────────────────────────────────────────── */
async function opengroupCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        await sock.sendMessage(chatId, {
            text: '🔓 *Group Opened!*\n\nAll members can now send messages.'
        }, { quoted: message });
    } catch (e) {
        console.error('[opengroup]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to open group.' }, { quoted: message });
    }
}

/* ── CLOSEGROUP ───────────────────────────────────────────────────────── */
async function closegroupCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;
        await sock.groupSettingUpdate(chatId, 'announcement');
        await sock.sendMessage(chatId, {
            text: '🔒 *Group Closed!*\n\nOnly admins can send messages now.'
        }, { quoted: message });
    } catch (e) {
        console.error('[closegroup]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to close group.' }, { quoted: message });
    }
}

/* ── LINKGC ───────────────────────────────────────────────────────────── */
async function linkgcCommand(sock, chatId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        const meta = await sock.groupMetadata(chatId);
        const code = await sock.groupInviteCode(chatId);
        const link = `https://chat.whatsapp.com/${code}`;
        await sock.sendMessage(chatId, {
            text: `🔗 *Group Link*\n\n📌 *${meta.subject}*\n\n${link}\n\n⚠️ _Use $resetlink to revoke this link._`
        }, { quoted: message });
    } catch (e) {
        console.error('[linkgc]', e.message);
        const hint = e.message?.includes('not-admin') || e.message?.includes('admin')
            ? '❌ Bot must be an admin to fetch the group link.'
            : '❌ Failed to get group link.';
        await sock.sendMessage(chatId, { text: hint }, { quoted: message });
    }
}

/* ── CREATEGC ─────────────────────────────────────────────────────────── */
async function creategcCommand(sock, chatId, senderId, userMessage, message) {
    try {
        const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            return sock.sendMessage(chatId, { text: '❌ Only the owner can create groups.' }, { quoted: message });
        }

        const groupName = userMessage.slice(9).trim();
        if (!groupName) {
            return sock.sendMessage(chatId, {
                text: `🏗️ *CREATE GROUP*\n\n▸ Usage: *$creategc <group name>*\n▸ Example: *$creategc Daratech Squad*\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '⚙️', key: message.key } });

        // WhatsApp auto-adds the creator — no need to pre-fill members
        const group = await sock.groupCreate(groupName, []);

        let invite = 'Unavailable';
        try {
            const code = await sock.groupInviteCode(group.id);
            if (code) invite = `https://chat.whatsapp.com/${code}`;
        } catch { /* unavailable */ }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `╭━━━「 🏗️ *GROUP SPAWNED* 」━━━\n` +
                  `┃\n` +
                  `┃ 📛 *Name:* ${group.subject}\n` +
                  `┃ 👥 *Members:* 1\n` +
                  `┃ 🔗 *Link:* ${invite}\n` +
                  `┃\n` +
                  `╰━━━━━━━━━━━━━━━━━━━━━\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[creategc]', err);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        await sock.sendMessage(chatId, {
            text: `❌ *Failed to create group*\n\n▸ ${err.message}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

/* ── PROMOTEALL ───────────────────────────────────────────────────────── */
async function promoteallCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const meta = await sock.groupMetadata(chatId);
        const toPromote = meta.participants.filter(p => !p.admin).map(p => p.id);

        if (toPromote.length === 0) {
            return sock.sendMessage(chatId, { text: '⚠️ All members are already admins.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Promoting *${toPromote.length}* member(s) to admin...`
        }, { quoted: message });

        for (let i = 0; i < toPromote.length; i += 5) {
            await sock.groupParticipantsUpdate(chatId, toPromote.slice(i, i + 5), 'promote');
            if (i + 5 < toPromote.length) await new Promise(r => setTimeout(r, 1500));
        }

        await sock.sendMessage(chatId, {
            text: `✅ *Promote All Done!*\n\n👑 ${toPromote.length} member(s) promoted to admin.`
        });
    } catch (e) {
        console.error('[promoteall]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to promote all members.' }, { quoted: message });
    }
}

/* ── DEMOTEALL ────────────────────────────────────────────────────────── */
async function demoteallCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const meta = await sock.groupMetadata(chatId);
        const botJid = getBotJid(sock);
        // Demote only regular admins — skip superadmin (group owner) and the bot
        const toDemote = meta.participants.filter(p =>
            p.admin === 'admin' && p.id !== botJid
        ).map(p => p.id);

        if (toDemote.length === 0) {
            return sock.sendMessage(chatId, { text: '⚠️ No regular admins to demote.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Demoting *${toDemote.length}* admin(s)...`
        }, { quoted: message });

        for (let i = 0; i < toDemote.length; i += 5) {
            await sock.groupParticipantsUpdate(chatId, toDemote.slice(i, i + 5), 'demote');
            if (i + 5 < toDemote.length) await new Promise(r => setTimeout(r, 1500));
        }

        await sock.sendMessage(chatId, {
            text: `✅ *Demote All Done!*\n\n👤 ${toDemote.length} admin(s) demoted to member.`
        });
    } catch (e) {
        console.error('[demoteall]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to demote all admins.' }, { quoted: message });
    }
}

/* ── KICKALL ──────────────────────────────────────────────────────────── */
async function kickallCommand(sock, chatId, senderId, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const meta = await sock.groupMetadata(chatId);
        const botJid = getBotJid(sock);
        // Exclude: bot, all admins, sender, and anyone tagged (they are spared)
        const spared = new Set([botJid, senderId, ...getMentioned(message)]);
        const toKick = meta.participants.filter(p => !p.admin && !spared.has(p.id)).map(p => p.id);

        if (toKick.length === 0) {
            return sock.sendMessage(chatId, { text: '⚠️ No members to kick.' }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Kicking *${toKick.length}* member(s)... This may take a moment.`
        }, { quoted: message });

        for (let i = 0; i < toKick.length; i += 5) {
            await sock.groupParticipantsUpdate(chatId, toKick.slice(i, i + 5), 'remove');
            if (i + 5 < toKick.length) await new Promise(r => setTimeout(r, 1500));
        }

        await sock.sendMessage(chatId, {
            text: `✅ *Kick All Done!*\n\n🚫 ${toKick.length} member(s) removed from the group.`
        });
    } catch (e) {
        console.error('[kickall]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to kick all members.' }, { quoted: message });
    }
}

/* ── REMOVE (by country code) ─────────────────────────────────────────── */
async function removeByCountryCommand(sock, chatId, senderId, userMessage, message) {
    if (!groupOnly(sock, chatId, message)) return;
    try {
        if (!await adminCheck(sock, chatId, senderId, message)) return;

        const cc = userMessage.slice(7).trim().replace(/^\+/, '');
        if (!cc || !/^\d+$/.test(cc)) {
            return sock.sendMessage(chatId, {
                text: '❌ Usage: $remove <country code>\nExample: $remove 234  (removes all +234 numbers)'
            }, { quoted: message });
        }

        const meta = await sock.groupMetadata(chatId);
        const botJid = getBotJid(sock);
        const toRemove = meta.participants.filter(p => {
            const num = p.id.split('@')[0];
            return num.startsWith(cc) && !p.admin && p.id !== botJid;
        }).map(p => p.id);

        if (toRemove.length === 0) {
            return sock.sendMessage(chatId, {
                text: `⚠️ No non-admin members found with country code +${cc}.`
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, {
            text: `⏳ Removing *${toRemove.length}* member(s) with country code +${cc}...`
        }, { quoted: message });

        for (let i = 0; i < toRemove.length; i += 5) {
            await sock.groupParticipantsUpdate(chatId, toRemove.slice(i, i + 5), 'remove');
            if (i + 5 < toRemove.length) await new Promise(r => setTimeout(r, 1500));
        }

        await sock.sendMessage(chatId, {
            text: `✅ *Remove by Country Done!*\n\n🌍 Country code: +${cc}\n🚫 Removed: ${toRemove.length} member(s)`
        });
    } catch (e) {
        console.error('[remove]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to remove members by country code.' }, { quoted: message });
    }
}

module.exports = {
    everyoneCommand,
    leavegcCommand,
    joinCommand,
    inviteCommand,
    getnameCommand,
    getdeskgcCommand,
    getppgcCommand,
    setppgcCommand,
    svcontactCommand,
    opengroupCommand,
    closegroupCommand,
    linkgcCommand,
    creategcCommand,
    promoteallCommand,
    demoteallCommand,
    kickallCommand,
    removeByCountryCommand,
};
