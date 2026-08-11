'use strict';
/**
 * dbstats.js — Show bot data statistics (owner-only)
 *
 * $dbstats        — display stats for all bot data stores
 * Aliases: $mongostats
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

const DATA_DIR = path.join(__dirname, '../data');

function readJson(file) {
    try {
        const p = path.join(DATA_DIR, file);
        if (!fs.existsSync(p)) return null;
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch { return null; }
}

function safeCount(obj) {
    if (!obj || typeof obj !== 'object') return 0;
    return Object.keys(obj).length;
}

function fileSizeKB(file) {
    try {
        const p = path.join(DATA_DIR, file);
        if (!fs.existsSync(p)) return 0;
        return (fs.statSync(p).size / 1024).toFixed(1);
    } catch { return 0; }
}

async function dbstatsCommand(sock, chatId, senderId, message) {
    const isOwner = isAuthorizedOwnerSession(sock) &&
        (message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId));
    if (!isOwner) {
        return sock.sendMessage(chatId, { text: '❌ *$dbstats* is owner-only.' }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: '📊 _Gathering data stats…_' }, { quoted: message });

    try {
        // userGroupData.json
        const ugd       = readJson('userGroupData.json') || {};
        const antilinks = safeCount(ugd.antilink);
        const antitags  = safeCount(ugd.antitag);
        const welcomes  = safeCount(ugd.welcome);
        const goodbyes  = safeCount(ugd.goodbye);
        const chatbots  = safeCount(ugd.chatbot);
        const warnGroups = safeCount(ugd.warnings);
        const totalWarns = Object.values(ugd.warnings || {})
            .reduce((acc, g) => acc + Object.values(g).reduce((s, n) => s + n, 0), 0);
        const sudoCount = (ugd.sudo || []).length;

        // antimedia.json
        const am = readJson('antimedia.json') || {};
        let antiMediaGroups = 0, autostickerGroups = 0, agmGroups = 0;
        for (const [, g] of Object.entries(am)) {
            if (g.antiimage || g.antivideo || g.antisticker || g.antiaudio) antiMediaGroups++;
            if (g.autosticker) autostickerGroups++;
            if (g.antigroupmention) agmGroups++;
        }

        // banned.json
        const banned    = readJson('banned.json');
        const bannedCnt = Array.isArray(banned) ? banned.length : safeCount(banned);

        // premium.json
        const premium    = readJson('premium.json');
        const premiumCnt = Array.isArray(premium) ? premium.length : safeCount(premium);

        // gcstatus.json
        const gcColors = readJson('gcstatus.json') || {};

        // economy.json / economy data
        const economy = readJson('economy.json') || {};
        const economyUsers = safeCount(economy);

        // warnings.json
        const warnFile    = readJson('warnings.json') || {};
        const warnFileCnt = safeCount(warnFile);

        // File sizes
        const ugdSize  = fileSizeKB('userGroupData.json');
        const amSize   = fileSizeKB('antimedia.json');
        const ecoSize  = fileSizeKB('economy.json');

        // Data dir file list
        let dataFiles = [];
        try { dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')); } catch {}

        const now = new Date().toLocaleString('en-GB', { timeZone: 'UTC' });

        const text =
            `╭━━━「 📊 *BOT DATA STATS* 」━━━\n` +
            `┃\n` +
            `┃ 🕐 *${now} UTC*\n` +
            `┃\n` +
            `┃ ─── 🛡️ GROUP PROTECTION ───\n` +
            `┃ Anti-link groups    : *${antilinks}*\n` +
            `┃ Anti-tag groups     : *${antitags}*\n` +
            `┃ Anti-media groups   : *${antiMediaGroups}*\n` +
            `┃ Anti-grp-mention    : *${agmGroups}*\n` +
            `┃ Auto-sticker groups : *${autostickerGroups}*\n` +
            `┃\n` +
            `┃ ─── 👋 GREET SYSTEM ───\n` +
            `┃ Welcome enabled     : *${welcomes}* groups\n` +
            `┃ Goodbye enabled     : *${goodbyes}* groups\n` +
            `┃ Chatbot enabled     : *${chatbots}* groups\n` +
            `┃\n` +
            `┃ ─── ⚠️ MODERATION ───\n` +
            `┃ Warning groups      : *${warnGroups}*\n` +
            `┃ Total warnings      : *${totalWarns}*\n` +
            `┃ Banned users        : *${bannedCnt}*\n` +
            `┃\n` +
            `┃ ─── 👑 USERS ───\n` +
            `┃ Premium users       : *${premiumCnt}*\n` +
            `┃ Sudo users          : *${sudoCount}*\n` +
            `┃ Economy users       : *${economyUsers}*\n` +
            `┃ GC custom colors    : *${safeCount(gcColors)}* groups\n` +
            `┃\n` +
            `┃ ─── 💾 FILE SIZES ───\n` +
            `┃ userGroupData.json  : *${ugdSize} KB*\n` +
            `┃ antimedia.json      : *${amSize} KB*\n` +
            `┃ economy.json        : *${ecoSize} KB*\n` +
            `┃ JSON files total    : *${dataFiles.length}*\n` +
            `┃\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`;

        return sock.sendMessage(chatId, { text }, { quoted: message });

    } catch (err) {
        console.error('[dbstats]', err.message);
        return sock.sendMessage(chatId, {
            text: `❌ Error reading data stats.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = { dbstatsCommand };
