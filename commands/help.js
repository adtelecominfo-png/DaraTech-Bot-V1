'use strict';
const settings = require('../settings');
const fs = require('fs');
const path = require('path');
const { CATEGORIES, findCategory } = require('../lib/categories');

// ─── Constants ──────────────────────────────────────────────────────────────────
const BOT_PIC_PATH = path.join(__dirname, '../assets/botpic.png');
let BOT_PIC_BUFFER = null;
try { BOT_PIC_BUFFER = fs.readFileSync(BOT_PIC_PATH); } catch { /* no pic */ }

const ICONS = {
    cmd: '◆',
    separator: '━',
    bullet: '▪',
    arrow: '↳',
    error: '❌',
    info: 'ℹ️',
    search: '🔍',
    details: '📋',
    help: '📖',
    example: '💡',
    tip: '💡',
    back: '◀',
    fire: '🔥',
    user: '👤',
    time: '⏱',
    cmdCount: '⚡',
};

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

// ─── Helper Functions ──────────────────────────────────────────────────────────

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

// Counts real commands the same way menu.js does (from cat.cmds, not the
// free-text help lines) so the totals shown here are actually accurate.
function getRealCmds(cmds) {
    return cmds.filter(c => c.startsWith('$'));
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

// ─── Overview (Stylish) ───────────────────────────────────────────────────────

async function sendOverview(sock, chatId, message) {
    const userName = message.pushName || 'User';
    const ver = settings.version || '1.0.0';
    const totalCommands = getTotalCommands();
    const categories = CATEGORIES.filter(c => getRealCmds(c.cmds).length > 0);

    const header = createStylishBox('⚡  D A R A T E C H  H E L P  ⚡', `v${ver}`);

    const body = [
        header,
        ``,
        `${ICONS.user} ${userName}`,
        `${ICONS.time} ${uptimeStr()}`,
        `${ICONS.cmdCount} ${totalCommands}+ cmds`,
        `📂 ${categories.length} cats`,
        ``,
        createSectionBox('💡  H O W  T O  U S E'),
        ``,
        `${ICONS.arrow} *$help <cat>*  •  full descriptions`,
        `${ICONS.arrow} *$menu <cat>*  •  quick command list`,
        `${ICONS.arrow} *$menu search <cmd>*  •  find commands`,
        `${ICONS.arrow} *$menu details <cmd>*  •  usage info`,
        ``,
        createSectionBox('📂  C A T E G O R I E S'),
        ``,
        ...categories.map(c => `${c.emoji}  *$help ${c.slug}*`),
        ``,
        createSectionBox('💡  E X A M P L E S'),
        ``,
        `${ICONS.arrow} $help movies  •  full movie guide`,
        `${ICONS.arrow} $help ai  •  complete AI guide`,
        `${ICONS.arrow} $help groups  •  group management`,
        ``,
        `${ICONS.back} *$menu*  •  back to menu`,
        ``,
        `${ICONS.fire}  Daratech  ⚡`,
    ].join('\n');

    await sendWithImage(sock, chatId, message, body);
}

// ─── Category Help (Stylish) ──────────────────────────────────────────────────

async function sendCategoryHelp(sock, chatId, message, input) {
    const cat = findCategory(input);
    if (!cat) {
        const categories = CATEGORIES
            .filter(c => getRealCmds(c.cmds).length > 0)
            .map(c => `  ${c.emoji} *$help ${c.slug}*`)
            .join('\n');

        return sock.sendMessage(chatId, {
            text: [
                `❌  Category "*${input}*" not found.`,
                ``,
                `📂  *Available Categories:*`,
                ``,
                categories,
                ``,
                `💡  Use *$help* to see all`,
            ].join('\n')
        }, { quoted: message });
    }

    const helpLines = cat.help.filter(l => l.trim());

    const header = createStylishBox(`${cat.emoji}  ${cat.title}`, `📋 ${getRealCmds(cat.cmds).length} commands`);

    const cmdLines = [];

    for (const line of helpLines) {
        if (line.startsWith('──')) {
            const currentSection = line.replace(/──/g, '').trim();
            if (currentSection) {
                cmdLines.push(``);
                cmdLines.push(createSectionBox(currentSection));
            }
        } else if (line.startsWith('$')) {
            const parts = line.split('→');
            if (parts.length > 1) {
                const cmd = parts[0].trim();
                const desc = parts[1].trim();
                cmdLines.push(`${ICONS.cmd} ${cmd}`);
                cmdLines.push(`> ${desc}`);
            } else {
                cmdLines.push(`${ICONS.cmd} ${line}`);
            }
        } else if (line.includes('e.g.')) {
            cmdLines.push(`> ${line.trim()}`);
        } else if (line.trim()) {
            cmdLines.push(line.trim());
        }
    }

    const allSlugs = [cat.slug, ...(cat.altSlugs || [])];
    const slugHint = allSlugs.length > 1
        ? `\n💡  Aliases: ${cat.altSlugs.map(s => `*$help ${s}*`).join('  ')}`
        : '';

    const tips = {
        movies: '💡  Use $movie <title> to search, then use the ID',
        ai: '💡  Reply to images for vision commands',
        download: '💡  $play <title> for audio, $ytvideo for video',
        groups: '💡  Admin perms needed. $mute for group mute',
        economy: '💡  Start: $register, then $daily, $work',
        manga: '💡  Search first, use number from results',
        default: '💡  Type $help <category> for more details'
    };

    const tipText = tips[cat.slug] || tips.default;

    const body = [
        header,
        ``,
        cmdLines.join('\n'),
        ``,
        createSectionBox([
            `📋  $menu ${cat.slug}  •  quick list`,
            `🔙  $help  •  back`,
        ]),
        slugHint,
        ``,
        tipText,
        ``,
        `${ICONS.fire}  Daratech  ⚡`,
    ].join('\n');

    await sendWithImage(sock, chatId, message, body);
}

// ─── Get Total Commands ──────────────────────────────────────────────────────

function getTotalCommands() {
    let total = 0;
    for (const cat of CATEGORIES) {
        total += getRealCmds(cat.cmds).length;
    }
    return total;
}

// ─── Main Export ──────────────────────────────────────────────────────────────

async function helpCommand(sock, chatId, message, catArg) {
    if (catArg && catArg.trim()) {
        return sendCategoryHelp(sock, chatId, message, catArg.trim());
    }
    return sendOverview(sock, chatId, message);
}

module.exports = helpCommand;
