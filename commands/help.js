'use strict';
// help command
const settings   = require('../settings');
const fs         = require('fs');
const path       = require('path');
const { CATEGORIES, findCategory } = require('../lib/categories');

// ─── Overview (no args) ───────────────────────────────────────────────────────

async function sendOverview(sock, chatId, message) {
    const userName = message.pushName || 'User';
    const ver      = settings.version || '1.0.0';
    const t        = process.uptime();
    const h        = Math.floor(t / 3600);
    const m        = Math.floor((t % 3600) / 60);

    const lines = [
        `📖 *COMMAND GUIDE* · Daratech\n`,
        `👤 Hey *${userName}* 👋  ·  v${ver}  ·  ⏱ ${h}h ${m}m\n`,
        `*📂 CATEGORIES — type $help <name> for details:*\n`,
    ];

    for (const cat of CATEGORIES) {
        const count = cat.help.filter(l => l.startsWith('$')).length;
        if (count === 0 && cat.cmds.length === 0) continue;
        const desc = CAT_DESCRIPTIONS[cat.slug] || '';
        lines.push(`${cat.emoji} *$help ${cat.slug.padEnd(10)}* — ${desc}`);
    }

    lines.push(`\n📋 *$menu movies*  — quick command list`);
    lines.push(`📖 *$help movies*  — full descriptions`);
    lines.push(`\n_Daratech_ ⚡`);

    return sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

// Short one-line descriptions for the overview list
const CAT_DESCRIPTIONS = {
    start:     'bot basics, settings, updates',
    movies:    'search, download, trailer, live TV, anime',
    ai:        'GPT, Gemini, image & video generation',
    crypto:    'live prices, convert, trending coins',
    download:  'TikTok, YouTube, Instagram, Spotify …',
    fun:       'games, jokes, reactions, quotes',
    gaming:    'Free Fire, PUBG, CODM, Blood Strike sensitivity',
    stickers:  'stickers, filters, image effects',
    tools:     'weather, translate, QR, screenshot …',
    search:    'Google, YouTube, Bible, apps …',
    sports:    'live scores, fixtures, standings',
    anime:     'anime images, quotes, character search',
    tempgen:   'temp email & SMS numbers',
    stalk:     'GitHub, Instagram, TikTok profile lookup',
    templates: 'text art (111) + photo effects (624)',
    groups:    'kick, mute, warn, antilink, welcome …',
    owner:     'bot mode, autoread, autoreact, AFK …',
};

// ─── Category detail (args = slug) ────────────────────────────────────────────

async function sendCategoryHelp(sock, chatId, message, input) {
    const cat = findCategory(input);
    if (!cat) {
        const slugList = CATEGORIES.map(c => `*$help ${c.slug}*`).join('  ');
        return sock.sendMessage(chatId, {
            text: `❌ Category "*${input}*" not found.\n\nAvailable:\n${slugList}`
        }, { quoted: message });
    }

    const rows = cat.help.map(l => l ? `▸ ${l}` : '').join('\n');

    const text = [
        `${cat.emoji} *${cat.title}*\n`,
        rows,
        `\n📋 *$menu ${cat.slug}* — quick command list`,
        `🏠 *$help* — back to categories`,
        `\n_Daratech_ ⚡`,
    ].join('\n');

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function helpCommand(sock, chatId, message, catArg) {
    if (catArg && catArg.trim()) {
        return sendCategoryHelp(sock, chatId, message, catArg.trim());
    }
    return sendOverview(sock, chatId, message);
}

module.exports = helpCommand;
