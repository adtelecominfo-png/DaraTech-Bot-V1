'use strict';
const fs         = require('fs');
const path       = require('path');
const settings   = require('../settings');
const { CATEGORIES, findCategory } = require('../lib/categories');
const settings2   = require('../settings'); // for owner check

// Fixed bot picture — loaded once at startup
const BOT_PIC_PATH = path.join(__dirname, '../assets/botpic.png');
let BOT_PIC_BUFFER = null;
try { BOT_PIC_BUFFER = fs.readFileSync(BOT_PIC_PATH); } catch { /* no pic */ }
function isOwner(jid) {
    const digits = jid.replace(/[^0-9]/g, '');
    return digits.includes((settings2.ownerNumber || '').replace(/[^0-9]/g, ''));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowStr() {
    return new Date().toLocaleString('en-NG', {
        timeZone: 'Africa/Lagos',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}
function uptimeStr() {
    const t = process.uptime();
    return `${Math.floor(t / 3600)}h ${Math.floor((t % 3600) / 60)}m ${Math.floor(t % 60)}s`;
}

// ─── Send helper — fixed bot pic or text fallback ────────────────────────────

async function sendWithImage(sock, chatId, message, text) {
    try {
        if (BOT_PIC_BUFFER) {
            await sock.sendMessage(chatId, {
                image: BOT_PIC_BUFFER,
                caption: text,
                mimetype: 'image/png',
            }, { quoted: message });
            return;
        }
    } catch { /* fall through */ }
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Overview (no args) ───────────────────────────────────────────────────────

async function sendOverview(sock, chatId, message) {
    const userName = message.pushName || 'User';
    const ver      = settings.version || '1.0.0';

    const realCmds = cmds => cmds.filter(c => c.startsWith('$'));
    let total = 0;
    for (const cat of CATEGORIES) total += realCmds(cat.cmds).length;

    const lines = [
        `╔════════════════════════════════════╗`,
        `║  ⚡  *D A R A  S T U D I O  B O T*  ⚡ ║`,
        `╚════════════════════════════════════╝`,
        ``,
        `╭──🌟 *SESSION INFO*`,
        `│ 👤 *${userName}*   •   🕐 ${nowStr()}`,
        `│ ⏱ Uptime: *${uptimeStr()}*   •   v${ver}`,
        `│ 📋 Total: *${total}+ commands*`,
        `╰${'─'.repeat(34)}`,
        ``,
        `*📂 CATEGORIES — tap a name to explore:*`,
        ``,
    ];

    for (const cat of CATEGORIES) {
        const cmdCount = realCmds(cat.cmds).length;
        if (!cmdCount) continue;
        // If a category has alt slugs, show them alongside the primary slug
        const slugLabel = cat.altSlugs?.length
            ? `${cat.slug} / ${cat.altSlugs.join(' / ')}`
            : cat.slug;
        lines.push(`${cat.emoji} *$menu ${slugLabel}* — ${cmdCount} cmds`);
    }

    lines.push(``, `─`.repeat(34));
    lines.push(`💬 *$menu movies*   — movie commands`);
    lines.push(`💬 *$menu manga*    — manga & manhwa`);
    lines.push(`💬 *$menu ai*       — AI commands`);
    lines.push(`💬 *$menu sports*   — sports & scores`);
    lines.push(`📖 *$help <cat>*    — full descriptions`);
    lines.push(`─`.repeat(34));
    lines.push(`🔍 *$menu search <command>*  — find commands`);
    lines.push(`📋 *$menu details <command>* — command usage`);

    const text = lines.join('\n');

    await sendWithImage(sock, chatId, message, text);
}

// ─── Search across all categories ────────────────────────────────────────────

async function sendSearchMenu(sock, chatId, message, query) {
    if (!query) return sock.sendMessage(chatId, {
        text: `❌ Usage: *$menu search <command>*\nExample: *$menu search $battle*`
    }, { quoted: message });

    const q = query.toLowerCase().replace(/^\$/, '');
    const results = [];

    for (const cat of CATEGORIES) {
        const matches = cat.cmds.filter(c => c.toLowerCase().replace(/^\$/, '').includes(q));
        if (matches.length) {
            results.push(`${cat.emoji} *${cat.title}*`);
            matches.forEach(m => results.push(`  │ ${m.startsWith('$') ? m : '$' + m}`));
        }
    }

    const text = results.length
        ? `🔍 *Search results for "${query}":*\n\n${results.join('\n')}\n\n_Use *$menu details ${query}* for usage info_`
        : `❌ No commands found matching *"${query}"*\n\nTry *$menu* to browse categories.`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Details for a specific command ──────────────────────────────────────────

async function sendDetailsMenu(sock, chatId, message, query) {
    if (!query) return sock.sendMessage(chatId, {
        text: `❌ Usage: *$menu details <command>*\nExample: *$menu details $battle*`
    }, { quoted: message });

    const q = query.toLowerCase().replace(/^\$/, '');
    const results = [];

    for (const cat of CATEGORIES) {
        const matches = cat.help.filter(line => line.toLowerCase().replace(/^\$/, '').includes(q));
        if (matches.length) {
            results.push(`${cat.emoji} *${cat.title}*`);
            matches.forEach(l => results.push(`  ${l}`));
            results.push('');
        }
    }

    const text = results.length
        ? `📋 *Details for "${query}":*\n\n${results.join('\n').trimEnd()}`
        : `❌ No details found for *"${query}"*\n\nTry *$menu search ${query}* to locate it first.`;

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Category detail (args = slug) ────────────────────────────────────────────

async function sendCategoryMenu(sock, chatId, message, input) {
    const cat = findCategory(input);
    if (!cat) {
        const slugList = CATEGORIES.map(c => `*$menu ${c.slug}*`).join('  ');
        return sock.sendMessage(chatId, {
            text: `❌ Category "*${input}*" not found.\n\nAvailable:\n${slugList}`
        }, { quoted: message });
    }

    const senderJid = message.key?.participant || message.key?.remoteJid || '';
    const ownerSee  = isOwner(senderJid) || message.key?.fromMe;
    const visibleCmds = ownerSee ? cat.cmds : cat.cmds.filter(c => !c.includes('(owner)'));
    const rows = visibleCmds.map(c => `│ ${c.startsWith('$') ? c : '$' + c}`).join('\n');

    // Build alt-slug hint so users know every valid keyword for this category
    const allSlugs = [cat.slug, ...(cat.altSlugs || [])];
    const slugHint = allSlugs.length > 1
        ? `\n💡 Also: ${cat.altSlugs.map(s => `*$menu ${s}*`).join('  ')} → same category`
        : '';

    const text = [
        `╭──${cat.emoji} *${cat.title}*`,
        rows,
        `╰${'─'.repeat(32)}`,
        ``,
        `📖 *$help ${cat.slug}* — full descriptions`,
        `🏠 *$menu* — back to categories`,
        slugHint,
        `\n_Daratech_ ⚡`,
    ].filter(l => l !== '').join('\n');

    await sendWithImage(sock, chatId, message, text);
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function menuCommand(sock, chatId, message, catArg) {
    if (catArg && catArg.trim()) {
        const arg   = catArg.trim();
        const parts = arg.split(/\s+/);
        const sub   = parts[0].toLowerCase();
        const rest  = parts.slice(1).join(' ').trim();

        // 'search' and 'details' are reserved sub-commands only when a query follows.
        // If no query is given ($menu search  /  $menu details) treat it as a
        // category lookup so the user sees the Search / Details category listing.
        if (sub === 'search'  && rest) return sendSearchMenu(sock, chatId, message, rest);
        if (sub === 'details' && rest) return sendDetailsMenu(sock, chatId, message, rest);
        return sendCategoryMenu(sock, chatId, message, arg);
    }
    return sendOverview(sock, chatId, message);
}

module.exports = menuCommand;
module.exports.menuCommand     = menuCommand;
module.exports.menuFullCommand = menuCommand;
