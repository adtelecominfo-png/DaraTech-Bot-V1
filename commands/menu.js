'use strict';
const settings   = require('../settings');
const { CATEGORIES, findCategory } = require('../lib/categories');
const { davidGet } = require('../lib/gifted');
const { isOwner }  = require('./economy');

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

// ─── Category → wallpaper search keyword ─────────────────────────────────────

const CAT_WALLPAPER = {
    start:      'technology bot digital',
    ai:         'artificial intelligence robot future',
    movies:     'cinema movie night popcorn',
    download:   'music headphones beats',
    fun:        'party games fun colorful',
    gaming:     'gaming controller esports neon',
    stickers:   'art colorful abstract creative',
    tools:      'tools gadgets workshop',
    search:     'search explore discover',
    sports:     'sports stadium crowd energy',
    anime:      'anime girl wallpaper',
    manga:      'manga comic book panel art',
    stalk:      'social media network connect',
    crypto:     'bitcoin cryptocurrency digital gold',
    groups:     'team people community',
    owner:      'settings control dashboard',
    tempgen:    'email inbox message',
    language:   'books library reading knowledge',
    country:    'world map globe travel',
    animals:    'cute animals wildlife nature',
    food:       'food delicious restaurant cooking',
    space:      'galaxy stars universe nebula cosmos',
    texttools:  'code programming terminal hacker',
    fonts:      'typography font design letters art',
    generators: 'dice random generator creative fun',
    bible:      'church cross spiritual sunset sky holy book',
    quran:      'mosque islamic architecture crescent moon',
    converters: 'calculator math measurement science',
    economy:    'gold coins treasure wealth fantasy rpg',
};

// ─── Fetch a random image for overview ───────────────────────────────────────

const OVERVIEW_KEYWORDS = [
    'anime girl wallpaper',
    'digital art futuristic neon',
    'beautiful scenery nature landscape',
    'cyberpunk city night lights',
    'anime aesthetic wallpaper',
];

async function fetchOverviewImage() {
    // Use the same wallpaper endpoint that works for categories
    const query = OVERVIEW_KEYWORDS[Math.floor(Math.random() * OVERVIEW_KEYWORDS.length)];
    try {
        const data = await davidGet(`/search/wallpaper?text=${encodeURIComponent(query)}`);
        const list = data?.result || data?.results || data?.data || [];
        if (Array.isArray(list) && list.length) {
            const pick = list[Math.floor(Math.random() * Math.min(list.length, 5))];
            const url  = pick?.url || pick?.image || pick?.src || pick;
            if (typeof url === 'string' && url.startsWith('http')) return url;
        }
        const direct = data?.result?.url || data?.url;
        if (typeof direct === 'string' && direct.startsWith('http')) return direct;
    } catch { /* ignore */ }
    return null;
}

// ─── Fetch a thematic wallpaper for a category ───────────────────────────────

async function fetchCategoryImage(slug) {
    const query = CAT_WALLPAPER[slug] || 'wallpaper';
    try {
        const data = await davidGet(`/search/wallpaper?text=${encodeURIComponent(query)}`);
        // API returns { result: [ { url: '...' }, ... ] } or similar
        const list = data?.result || data?.results || data?.data || [];
        if (Array.isArray(list) && list.length) {
            const pick = list[Math.floor(Math.random() * Math.min(list.length, 5))];
            const url  = pick?.url || pick?.image || pick?.src || pick;
            if (typeof url === 'string' && url.startsWith('http')) return url;
        }
        // Some endpoints return a single result directly
        const direct = data?.result?.url || data?.url;
        if (typeof direct === 'string' && direct.startsWith('http')) return direct;
    } catch { /* ignore */ }
    return null;
}

// ─── Send helper — image if available, text otherwise ────────────────────────

async function sendWithImage(sock, chatId, message, text, imageUrl) {
    try {
        if (imageUrl) {
            await sock.sendMessage(chatId, {
                image: { url: imageUrl },
                caption: text,
                mimetype: 'image/jpeg',
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

    // Fetch random waifu image in parallel with building text
    const imageUrl = await fetchOverviewImage();
    await sendWithImage(sock, chatId, message, text, imageUrl);
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

    // Fetch category-themed image in parallel with building text
    const imageUrl = await fetchCategoryImage(cat.slug);
    await sendWithImage(sock, chatId, message, text, imageUrl);
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
