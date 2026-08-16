'use strict';
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { CATEGORIES, findCategory } = require('../lib/categories');
const { isAuthorizedOwnerSession, isPairingOwnerNumber } = require('../lib/isOwner');

// ─── Constants ──────────────────────────────────────────────────────────────────
const BOT_PIC_PATH = path.join(__dirname, '../assets/botpic.png');
let BOT_PIC_BUFFER = null;
try { BOT_PIC_BUFFER = fs.readFileSync(BOT_PIC_PATH); } catch { /* no pic */ }

// ─── Emoji / Icon Helpers ──────────────────────────────────────────────────────
const ICONS = {
    cmd: '◆',
    separator: '━',
    bullet: '▪',
    arrow: '↳',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    star: '⭐',
    fire: '🔥',
    sparkle: '✨',
    rocket: '🚀',
    crown: '👑',
    back: '◀',
    home: '⌂',
    search: '🔍',
    details: '📋',
    help: '📖',
    time: '⏱',
    user: '👤',
    cmdCount: '⚡',
};

function isOwner(jid, sock) {
    return isPairingOwnerNumber(jid, sock);
}

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

function getRealCmds(cmds) {
    return cmds.filter(c => c.startsWith('$'));
}

function getTotalCommands() {
    let total = 0;
    for (const cat of CATEGORIES) {
        total += getRealCmds(cat.cmds).length;
    }
    return total;
}

// ─── Send Helper ──────────────────────────────────────────────────────────────

async function sendWithImage(sock, chatId, message, text, imageBuffer = BOT_PIC_BUFFER) {
    try {
        if (imageBuffer) {
            await sock.sendMessage(chatId, {
                image: imageBuffer,
                caption: text,
                mimetype: 'image/png',
            }, { quoted: message });
            return;
        }
    } catch { /* fall through */ }
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Box Helpers (auto-fit so nothing overflows on WhatsApp) ──────────────────

function padCenter(str, width) {
    const pad = Math.max(0, width - str.length);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${' '.repeat(left)}${str}${' '.repeat(right)}`;
}

// Double-lined box (╔═╗ ... ╚═╝) — used for main headers.
// The top/bottom border stays a short, fixed width; the content lines have
// no side pipes and are simply centered against their own (wider) text
// width, so the border stays compact even when the text runs past it.
function createStylishBox(title, subtitle = '', borderWidth = 19) {
    const contentWidth = Math.max(title.length, subtitle.length) + 4;
    const lines = [`╔${'═'.repeat(borderWidth)}╗`];
    if (title) lines.push(padCenter(title, contentWidth));
    if (subtitle) lines.push(padCenter(subtitle, contentWidth));
    lines.push(`╚${'═'.repeat(borderWidth)}╝`);
    return lines.join('\n');
}

// Single-lined box (┏━┓ ... ┗━┛) — used for section labels & footers.
// Same fixed-border, no-side-pipe style as createStylishBox.
// Accepts a single string or an array of lines.
function createSectionBox(content, borderWidth = 16) {
    const lines = Array.isArray(content) ? content : [content];
    const contentWidth = Math.max(...lines.map(l => l.length)) + 4;
    const rows = [`┏${'━'.repeat(borderWidth)}┓`];
    lines.forEach(l => rows.push(padCenter(l, contentWidth)));
    rows.push(`┗${'━'.repeat(borderWidth)}┛`);
    return rows.join('\n');
}

// ─── Overview (Cool & Stylish) ───────────────────────────────────────────────

async function sendOverview(sock, chatId, message) {
    const userName = message.pushName || 'User';
    const ver = settings.version || '1.0.0';
    const total = getTotalCommands();
    const categories = CATEGORIES.filter(c => getRealCmds(c.cmds).length > 0);

    const header = createStylishBox('⚡  D A R A T E C H  B O T  ⚡', `v${ver}`);

    const body = [
        header,
        ``,
        `${ICONS.user} ${userName}`,
        `${ICONS.time} ${uptimeStr()}`,
        `${ICONS.cmdCount} ${total}+ cmds`,
        `📂 ${categories.length} cats`,
        ``,
        createSectionBox('📂  C A T E G O R I E S'),
        ``,
        ...categories.map(c => {
            const count = getRealCmds(c.cmds).length;
            return `${c.emoji}  *$menu ${c.slug}*  ${ICONS.cmd} ${count} cmds`;
        }),
        ``,
        createSectionBox('💡  Q U I C K  A C T I O N S'),
        ``,
        `${ICONS.arrow} *$help <cat>*  •  full descriptions`,
        `${ICONS.arrow} *$menu search <cmd>*  •  find commands`,
        `${ICONS.arrow} *$menu details <cmd>*  •  usage info`,
        ``,
        createSectionBox('🚀  Q U I C K  A C C E S S'),
        ``,
        `  $menu ai  $menu movies  $menu download`,
        `  $menu manga  $menu sports  $menu tools`,
        ``,
        `${ICONS.fire}  Daratech  ⚡`,
    ].join('\n');

    await sendWithImage(sock, chatId, message, body);
}

// ─── Search ────────────────────────────────────────────────────────────────────

async function sendSearchMenu(sock, chatId, message, query) {
    if (!query) {
        return sock.sendMessage(chatId, {
            text: `❌ *Usage:* $menu search <cmd>\n\n💡 *Example:* $menu search battle`
        }, { quoted: message });
    }

    const q = query.toLowerCase().replace(/^\$/, '');
    const results = [];

    for (const cat of CATEGORIES) {
        const matches = cat.cmds.filter(c => 
            c.toLowerCase().replace(/^\$/, '').includes(q)
        );
        if (matches.length) {
            results.push(`\n${cat.emoji}  *${cat.title}*`);
            matches.forEach(m => {
                const clean = m.startsWith('$') ? m : `$${m}`;
                results.push(`  ${ICONS.cmd} ${clean}`);
            });
        }
    }

    const text = results.length
        ? [
            `${ICONS.search}  *Search Results*  •  "${query}"`,
            ``,
            ...results,
            ``,
            `${ICONS.info} Use *$menu details ${query}* for usage`,
            `${ICONS.back} *$menu*  •  back`,
        ].join('\n')
        : [
            `❌  No commands found for *"${query}"*`,
            ``,
            `💡  Try *$menu* to browse categories`,
        ].join('\n');

    await sendWithImage(sock, chatId, message, text);
}

// ─── Command Details ──────────────────────────────────────────────────────────

async function sendDetailsMenu(sock, chatId, message, query) {
    if (!query) {
        return sock.sendMessage(chatId, {
            text: `❌ *Usage:* $menu details <cmd>\n\n💡 *Example:* $menu details $battle`
        }, { quoted: message });
    }

    const q = query.toLowerCase().replace(/^\$/, '');
    const results = [];

    for (const cat of CATEGORIES) {
        const matches = cat.help.filter(line => 
            line.toLowerCase().replace(/^\$/, '').includes(q)
        );
        if (matches.length) {
            results.push(`\n${cat.emoji}  *${cat.title}*`);
            matches.forEach(l => results.push(`  ${l}`));
        }
    }

    const text = results.length
        ? [
            `${ICONS.details}  *Command Details*  •  "${query}"`,
            ``,
            ...results,
            ``,
            `${ICONS.info} *$help <cat>*  •  full category`,
            `${ICONS.search} *$menu search ${query}*  •  find similar`,
        ].join('\n')
        : [
            `❌  No details for *"${query}"*`,
            ``,
            `💡  Try *$menu search ${query}* first`,
        ].join('\n');

    await sendWithImage(sock, chatId, message, text);
}

// ─── Category Menu (Stylish) ──────────────────────────────────────────────────

async function sendCategoryMenu(sock, chatId, message, input) {
    const cat = findCategory(input);
    if (!cat) {
        const categories = CATEGORIES
            .filter(c => getRealCmds(c.cmds).length > 0)
            .map(c => `  ${c.emoji} *$menu ${c.slug}*`)
            .join('\n');

        return sock.sendMessage(chatId, {
            text: [
                `❌  Category "*${input}*" not found.`,
                ``,
                `📂  *Available Categories:*`,
                ``,
                categories,
                ``,
                `💡  Use *$menu* to see all`,
            ].join('\n')
        }, { quoted: message });
    }

    const senderJid = message.key?.participant || message.key?.remoteJid || '';
    const ownerSee = isAuthorizedOwnerSession(sock) &&
        (isOwner(senderJid, sock) || message.key?.fromMe);
    
    const visibleCmds = ownerSee 
        ? cat.cmds 
        : cat.cmds.filter(c => !c.includes('(owner)'));
    
    const realCmds = getRealCmds(visibleCmds);
    const count = realCmds.length;

    const header = createStylishBox(`${cat.emoji}  ${cat.title}`, `⚡ ${count} commands`);

    const cmdLines = [];
    
    for (const cmd of visibleCmds) {
        if (cmd.startsWith('──')) {
            const currentSection = cmd.replace(/──/g, '').trim();
            if (currentSection) {
                cmdLines.push(``);
                cmdLines.push(createSectionBox(currentSection));
            }
        } else if (cmd.startsWith('$')) {
            // Menu view is command-only — no purpose/description text.
            // (Use $help <cat> or $menu details <cmd> for that.)
            cmdLines.push(`${ICONS.cmd} ${cmd}`);
        }
    }

    const allSlugs = [cat.slug, ...(cat.altSlugs || [])];
    const slugHint = allSlugs.length > 1
        ? `\n💡  Aliases: ${cat.altSlugs.map(s => `*$menu ${s}*`).join('  ')}`
        : '';

    const body = [
        header,
        ``,
        cmdLines.join('\n'),
        ``,
        createSectionBox([
            `📖  $help ${cat.slug}  •  full descriptions`,
            `🏠  $menu  •  back`,
        ]),
        slugHint,
        ``,
        `${ICONS.fire}  Daratech  ⚡`,
    ].join('\n');

    await sendWithImage(sock, chatId, message, body);
}

// ─── Category Browser ─────────────────────────────────────────────────────────

async function sendCategoryBrowser(sock, chatId, message) {
    const categories = CATEGORIES.filter(c => getRealCmds(c.cmds).length > 0);
    
    const grouped = {
        '🤖 AI & Tech': ['ai', 'tools', 'search', 'texttools', 'ephoto', 'textpro', 'fonts'],
        '🎬 Media': ['movies', 'download', 'media', 'stickers', 'anime', 'manga'],
        '🎮 Fun': ['fun', 'gaming', 'generators', 'crypto', 'economy'],
        '📊 Social': ['groups', 'stalk', 'owner'],
        '📚 Reference': ['bible', 'language', 'country', 'animals', 'food', 'space'],
        '🔧 Utils': ['sports', 'tempgen', 'converters'],
    };

    const lines = [
        `📂  *C A T E G O R Y  B R O W S E R*`,
        ``,
    ];

    for (const [groupName, slugs] of Object.entries(grouped)) {
        const available = slugs
            .map(s => categories.find(c => c.slug === s))
            .filter(c => c);
        
        if (available.length) {
            lines.push(createSectionBox(groupName));
            available.forEach(c => {
                const count = getRealCmds(c.cmds).length;
                const slugDisplay = c.altSlugs?.length 
                    ? `${c.slug}/${c.altSlugs[0]}`
                    : c.slug;
                lines.push(`  ${c.emoji} *$menu ${slugDisplay}*  ${ICONS.cmd} ${count} cmds`);
            });
            lines.push(``);
        }
    }

    lines.push(
        createSectionBox([
            `📖  $help <cat>  •  descriptions`,
            `🔍  $menu search <cmd>  •  find`,
            `🏠  $menu  •  back`,
        ]),
        ``,
        `${ICONS.fire}  Daratech  ⚡`
    );

    await sendWithImage(sock, chatId, message, lines.join('\n'));
}

// ─── Main Export ──────────────────────────────────────────────────────────────

async function menuCommand(sock, chatId, message, catArg) {
    if (catArg && catArg.trim()) {
        const arg = catArg.trim();
        const parts = arg.split(/\s+/);
        const sub = parts[0].toLowerCase();
        const rest = parts.slice(1).join(' ').trim();

        if (sub === 'search' && rest) {
            return sendSearchMenu(sock, chatId, message, rest);
        }
        if (sub === 'details' && rest) {
            return sendDetailsMenu(sock, chatId, message, rest);
        }
        if (sub === 'browse' || sub === 'list') {
            return sendCategoryBrowser(sock, chatId, message);
        }
        
        return sendCategoryMenu(sock, chatId, message, arg);
    }
    
    return sendOverview(sock, chatId, message);
}

module.exports = menuCommand;
module.exports.menuCommand = menuCommand;
module.exports.menuFullCommand = menuCommand;
