'use strict';
/**
 * Economy System — Daratech Bot
 * Commands: register, balance, daily, work, mine, fish, rob, pay, deposit,
 *           withdraw, gamble, slots, coinflip, leaderboard, profile, gift,
 *           store, buy, inventory, equip, sell, upgrade, use, battle, estats,
 *           level, quest, jail, unjail, jailstatus, addcoins, removecoins,
 *           resetuser, boost
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH   = path.join(__dirname, '../data/economy.json');
const OWNER_NUM = '2348152077346';

// Runtime JID of the connected bot session — set by seedEconomyOwner on connect
let connectorJid = null;
let connectorLid = null;

// ─── Store catalogue ──────────────────────────────────────────────────────────
const STORE = {
    // ── Weapons tier 1 (starter) ──────────────────────────────────────────
    dagger:      { name: '🗡️ Iron Dagger',    price:    250, type: 'weapon', atk: 12 },
    sword:       { name: '⚔️ Iron Sword',      price:    500, type: 'weapon', atk: 20 },
    // ── Weapons tier 2 ────────────────────────────────────────────────────
    bow:         { name: '🏹 Longbow',         price:   1200, type: 'weapon', atk: 35 },
    wand:        { name: '🪄 Magic Wand',      price:   1800, type: 'weapon', atk: 45 },
    staff:       { name: '🔮 Magic Staff',     price:   2000, type: 'weapon', atk: 55 },
    axe:         { name: '🪓 Battle Axe',      price:   2500, type: 'weapon', atk: 55 },
    spear:       { name: '🔱 Battle Spear',    price:   2800, type: 'weapon', atk: 58 },
    hammer:      { name: '🔨 War Hammer',      price:   3000, type: 'weapon', atk: 60 },
    katana:      { name: '🔪 Katana',          price:   3500, type: 'weapon', atk: 65 },
    steelsword:  { name: '🗡️ Steel Sword',     price:   1500, type: 'weapon', atk: 40 },
    trident:     { name: '🔱 Trident',         price:   4500, type: 'weapon', atk: 70 },
    scythe:      { name: '💀 Death Scythe',    price:   5000, type: 'weapon', atk: 75 },
    // ── Weapons tier 3 (legendary) ────────────────────────────────────────
    dragonsword: { name: '🐉 Dragon Sword',    price:   8000, type: 'weapon', atk: 85 },
    excalibur:   { name: '⚡ Excalibur',       price:  20000, type: 'weapon', atk: 120 },
    godslayer:   { name: '🌑 Godslayer',       price:  50000, type: 'weapon', atk: 200 },

    // ── Armors tier 1 ─────────────────────────────────────────────────────
    cloth:       { name: '👘 Cloth Robe',      price:    200, type: 'armor',  def: 8 },
    shield:      { name: '🛡️ Wooden Shield',   price:    400, type: 'armor',  def: 15 },
    leather:     { name: '🥋 Leather Armor',   price:    600, type: 'armor',  def: 20 },
    ironshield:  { name: '🛡️ Iron Shield',     price:   1000, type: 'armor',  def: 30 },
    chainmail:   { name: '🥋 Chain Armor',     price:   1800, type: 'armor',  def: 45 },
    // ── Armors tier 2 ─────────────────────────────────────────────────────
    platemail:   { name: '🛡️ Plate Mail',      price:   3500, type: 'armor',  def: 60 },
    mithril:     { name: '💫 Mithril Armor',   price:   6000, type: 'armor',  def: 85 },
    // ── Armors tier 3 (legendary) ─────────────────────────────────────────
    dragonscale: { name: '🐉 Dragon Scale',    price:   7000, type: 'armor',  def: 70 },
    voidarmor:   { name: '🌑 Void Armor',      price:  12000, type: 'armor',  def: 100 },
    angelwings:  { name: '👼 Angel Wings',     price:  25000, type: 'armor',  def: 120 },

    // ── Accessories ───────────────────────────────────────────────────────
    ring:        { name: '💍 Lucky Ring',      price:    800, type: 'accessory', luck: 10 },
    amulet:      { name: '📿 Magic Amulet',    price:   1200, type: 'accessory', luck: 8 },
    bracelet:    { name: '💚 Power Bracelet',  price:   2500, type: 'accessory', atk: 10 },
    anklet:      { name: '💎 Speed Anklet',    price:   3000, type: 'accessory', luck: 20 },
    cape:        { name: '🧣 Hero Cape',       price:   5000, type: 'accessory', atk: 15, def: 15 },
    dragonring:  { name: '🐉 Dragon Ring',     price:  10000, type: 'accessory', atk: 25, def: 10, luck: 12 },
    crown:       { name: '👑 Royal Crown',     price:  15000, type: 'accessory', atk: 20, def: 20, luck: 15 },
    godamulet:   { name: '✨ God Amulet',      price:  30000, type: 'accessory', atk: 40, def: 30, luck: 25 },

    // ── Consumables ───────────────────────────────────────────────────────
    potion:      { name: '🧪 Health Potion',   price:    300, type: 'potion', hp: 50,  consumable: true },
    megapotion:  { name: '💊 Mega Potion',     price:    800, type: 'potion', hp: 120, consumable: true },
    elixir:      { name: '✨ Full Elixir',     price:   1500, type: 'potion', hp: 250, consumable: true },
    xpboost:     { name: '⚡ XP Boost',        price:    500, type: 'boost',  xp: 100, consumable: true },
};

const MAX_UPGRADE = 10;

// ─── DB helpers ───────────────────────────────────────────────────────────────
function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return {}; }
}
function saveDB(db) {
    const dir = path.join(__dirname, '../data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getUser(db, jid) {
    if (!db[jid]) db[jid] = {
        registered: false, name: null,
        wallet: 0, bank: 0, xp: 0, wins: 0, losses: 0,
        totalEarned: 0, totalSpent: 0,
        inventory: [], upgrades: {},
        equipped: { weapon: null, armor: null, accessory: null },
        lastDaily: 0, lastWork: 0, lastMine: 0, lastFish: 0,
        lastRob: 0, lastBattle: 0, lastQuest: 0,
        jail: false, jailUntil: null,
    };
    // backfill missing fields for existing accounts
    if (db[jid].registered === undefined) db[jid].registered = false;
    if (db[jid].jail      === undefined) db[jid].jail      = false;
    if (db[jid].jailUntil === undefined) db[jid].jailUntil = null;
    if (!db[jid].upgrades) db[jid].upgrades = {};
    return db[jid];
}

function isOwner(jid) {
    const digits = jid.replace(/[^0-9]/g, '');
    if (digits.includes(OWNER_NUM)) return true;
    if (connectorJid) {
        const connDigits = connectorJid.replace(/[^0-9]/g, '');
        if (connDigits && digits.includes(connDigits)) return true;
    }
    return false;
}

// ─── Registration & Jail gates ────────────────────────────────────────────────

/**
 * Returns true if the user is registered (or is the owner).
 * Sends an error message and returns false otherwise.
 */
async function requireRegistered(sock, chatId, message, u, jid) {
    if (isOwner(jid) || u.registered) return true;
    await sock.sendMessage(chatId, {
        text:
            `❌ *You need to register first!*\n\n` +
            `Use *$register <your name>* to create your economy account.\n\n` +
            `_Example: $register Dara_`,
    }, { quoted: message });
    return false;
}

/**
 * Returns true if the user is NOT currently jailed (or is the owner).
 * Auto-expires jail if time is up. Sends jail message and returns false if jailed.
 */
async function requireNotJailed(sock, chatId, message, u, jid, db) {
    if (isOwner(jid)) return true;
    if (!u.jail && !u.jailUntil) return true;

    // Auto-expire
    if (u.jailUntil && Date.now() >= u.jailUntil) {
        u.jail     = false;
        u.jailUntil = null;
        saveDB(db);
        return true;
    }

    const remaining = u.jailUntil - Date.now();
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);
    await sock.sendMessage(chatId, {
        text:
            `🔒 *You are in JAIL!*\n\n` +
            `You cannot use economy commands while jailed.\n` +
            `⏳ Release in: *${m}m ${s}s*\n\n` +
            `_Serve your time and stay out of trouble!_`,
    }, { quoted: message });
    return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ownerBoost(db, jid) {
    if (!isOwner(jid)) return;
    const u = getUser(db, jid);
    u.wallet = 1e84;
    u.bank   = 1e84;
    u.xp     = 1e84;
    u.upgrades = u.upgrades || {};
    Object.keys(STORE).filter(k => !STORE[k].consumable).forEach(k => {
        u.upgrades[k] = MAX_UPGRADE;
    });
}

function normalizeJid(jid) {
    if (!jid) return jid;
    if (connectorLid && jid === connectorLid) return connectorJid;
    return jid.replace(/:\d+(?=@)/, '');
}

// Resolve a JID to the key actually stored in DB (handles LID vs s.whatsapp.net mismatch).
// @mention JIDs in Baileys v7 can arrive in LID format; getUser would then create a
// separate DB entry instead of finding the user's real registered account.
function resolveDbJid(db, jid) {
    if (!jid) return jid;
    if (db[jid]?.registered) return jid;          // exact match, already registered
    const num = numFromJid(jid);
    if (!num) return jid;
    const found = Object.keys(db).find(k => numFromJid(k) === num && db[k]?.registered);
    return found || jid;
}

function senderJid(message) {
    if (message.key?.fromMe && connectorJid) return connectorJid;
    return normalizeJid(message.key?.participant || message.key?.remoteJid || '');
}
function numFromJid(jid) { return jid.replace(/:[^@]*/, '').split('@')[0]; }
function mention(jid)    { return `@${numFromJid(jid)}`; }
function fmt(n) {
    if (n >= 1e30) return 'MAX';
    if (n >= 1e27) return (n / 1e27).toFixed(1) + 'Oct';
    if (n >= 1e24) return (n / 1e24).toFixed(1) + 'Sp';
    if (n >= 1e21) return (n / 1e21).toFixed(1) + 'Sx';
    if (n >= 1e18) return (n / 1e18).toFixed(1) + 'Qi';
    if (n >= 1e15) return (n / 1e15).toFixed(1) + 'Qa';
    if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
    if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
    if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
    return Number(n).toLocaleString();
}

function cooldownLeft(last, ms, ownerJid = '') {
    if (isOwner(ownerJid)) return null;
    const left = ms - (Date.now() - last);
    if (left <= 0) return null;
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function levelOf(xp) { return Math.floor(Math.min(xp, 1e15) / 300) + 1; }
function xpForNext(xp) { const l = levelOf(xp); return l * 300 - Math.min(xp, 1e15); }

function getStats(u) {
    let atk = 15, def = 0, luck = 0, maxHp = 100 + levelOf(u.xp || 0) * 8;
    const upgrades = u.upgrades || {};
    const apply = key => {
        const item = u.equipped?.[key];
        if (!item || !STORE[item]) return;
        const s    = STORE[item];
        const upLv = upgrades[item] || 0;
        atk  += Math.floor((s.atk  || 0) * (1 + upLv * 0.1));
        def  += Math.floor((s.def  || 0) * (1 + upLv * 0.1));
        luck += Math.floor((s.luck || 0) * (1 + upLv * 0.1));
    };
    ['weapon', 'armor', 'accessory'].forEach(apply);
    const b = u.statBonus || {};
    if (b.atk  !== undefined) atk  += b.atk;
    if (b.def  !== undefined) def  += b.def;
    if (b.luck !== undefined) luck += b.luck;
    maxHp += def * 2;
    return { atk, def, luck, maxHp };
}

function addXp(u, amount) { u.xp = (u.xp || 0) + amount; }

function badge(jid, u) {
    if (isOwner(jid)) return '👑 *GOD*';
    const lv = levelOf(u.xp || 0);
    if (lv >= 50) return '🌟 *Immortal*';
    if (lv >= 30) return '💎 *Legend*';
    if (lv >= 20) return '🏆 *Elite*';
    if (lv >= 10) return '⭐ *Pro*';
    return '🌱 *Rookie*';
}

function resolveTarget(message) {
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentioned) return normalizeJid(mentioned);
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.participant) return normalizeJid(ctx.participant);
    if (ctx?.remoteJid && !ctx.remoteJid.endsWith('@g.us')) return normalizeJid(ctx.remoteJid);
    return null;
}

// ─── $register ────────────────────────────────────────────────────────────────

async function registerCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    const u   = getUser(db, uid);

    if (u.registered && !isOwner(uid)) {
        return sock.sendMessage(chatId, {
            text:
                `✅ *Already Registered!*\n\n` +
                `👤 Name   : ${u.name || 'User'}\n` +
                `💰 Wallet : 🪙 ${fmt(u.wallet)}\n` +
                `🏦 Bank   : 🪙 ${fmt(u.bank)}\n\n` +
                `_Use $balance to check your funds._`,
        }, { quoted: message });
    }

    const name = (q || '').trim().slice(0, 30) || numFromJid(uid);
    if (!name) {
        return sock.sendMessage(chatId, {
            text: `❌ Please provide your name!\n\n_Usage: $register <your name>_\n_Example: $register Dara_`,
        }, { quoted: message });
    }

    u.registered = true;
    u.name       = name;
    if (!isOwner(uid)) {
        u.wallet = u.wallet || 1000; // starter coins only if brand new
    }
    saveDB(db);

    await sock.sendMessage(chatId, {
        text:
            `🎉 *Welcome to the Daratech Economy!*\n\n` +
            `╭──────────────────\n` +
            `│ 👤 Name   : *${name}*\n` +
            `│ 💰 Wallet : *🪙 1,000* (starter bonus!)\n` +
            `│ 🏦 Bank   : *🪙 0*\n` +
            `│ ⭐ Level  : *1*\n` +
            `╰──────────────────\n\n` +
            `*Available commands:*\n` +
            `• $daily — claim daily reward\n` +
            `• $work — earn coins\n` +
            `• $balance — check wallet\n` +
            `• $store — buy items\n` +
            `• $profile — view your profile\n\n` +
            `_Good luck out there! 💪_`,
    }, { quoted: message });
}

// ─── $jail / $unjail / $jailstatus ───────────────────────────────────────────

async function jailCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });

    const db       = loadDB();
    const target   = resolveTarget(message);
    if (!target) return sock.sendMessage(chatId, {
        text: `❌ Tag or reply to a user to jail them.\n_Usage: $jail @user <minutes>_\n_Example: $jail @user 30_`,
    }, { quoted: message });

    const minutes = parseInt((q || '').replace(/\D/g, '')) || 60;
    const t  = getUser(db, target);
    t.jail      = true;
    t.jailUntil = Date.now() + minutes * 60 * 1000;
    saveDB(db);

    await sock.sendMessage(chatId, {
        text:
            `🔒 *JAILED!*\n\n` +
            `${mention(target)} has been sent to jail for *${minutes} minutes*.\n` +
            `They cannot use economy commands until released.\n\n` +
            `_Use $unjail @user to release early._`,
        mentions: [target],
    }, { quoted: message });
}

async function unjailCommand(sock, chatId, message) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });

    const db     = loadDB();
    const target = resolveTarget(message);
    if (!target) return sock.sendMessage(chatId, {
        text: `❌ Tag or reply to a user to unjail them.\n_Usage: $unjail @user_`,
    }, { quoted: message });

    const t = getUser(db, target);
    t.jail      = false;
    t.jailUntil = null;
    saveDB(db);

    await sock.sendMessage(chatId, {
        text: `🔓 *RELEASED!*\n\n${mention(target)} has been released from jail.`,
        mentions: [target],
    }, { quoted: message });
}

async function jailStatusCommand(sock, chatId, message) {
    const db     = loadDB();
    const uid    = senderJid(message);
    const target = resolveTarget(message) || uid;
    ownerBoost(db, uid);
    const t = getUser(db, target);

    // Auto-expire
    if (t.jailUntil && Date.now() >= t.jailUntil) {
        t.jail     = false;
        t.jailUntil = null;
        saveDB(db);
    }

    if (!t.jail && !t.jailUntil) {
        return sock.sendMessage(chatId, {
            text: `✅ *${target === uid ? 'You are' : mention(target) + ' is'} NOT in jail.*`,
            mentions: target !== uid ? [target] : [],
        }, { quoted: message });
    }

    const remaining = t.jailUntil - Date.now();
    const m = Math.floor(remaining / 60000);
    const s = Math.floor((remaining % 60000) / 1000);

    await sock.sendMessage(chatId, {
        text:
            `🔒 *JAIL STATUS*\n\n` +
            `👤 User    : ${mention(target)}\n` +
            `⏳ Released : in *${m}m ${s}s*`,
        mentions: [target],
    }, { quoted: message });
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function balanceCommand(sock, chatId, message) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    saveDB(db);
    await sock.sendMessage(chatId, {
        text:
            `💰 *WALLET — ${mention(uid)}*\n\n` +
            `╭──────────────────\n` +
            `│ 👤 Name   : *${u.name || numFromJid(uid)}*\n` +
            `│ 👛 Wallet : *🪙 ${fmt(u.wallet)}*\n` +
            `│ 🏦 Bank   : *🪙 ${fmt(u.bank)}*\n` +
            `│ 💎 Total  : *🪙 ${fmt(u.wallet + u.bank)}*\n` +
            `╰──────────────────\n\n` +
            `_Use $daily to earn free coins!_`,
    }, { quoted: message });
}

async function profileCommand(sock, chatId, message) {
    const db      = loadDB();
    const uid     = senderJid(message);
    const target  = resolveTarget(message) || uid;
    ownerBoost(db, uid);
    const u  = getUser(db, target);
    if (!await requireRegistered(sock, chatId, message, u, target)) return;
    const lv = levelOf(u.xp || 0);
    const st = getStats(u);
    const upgrades = u.upgrades || {};

    const fmtEquip = (slot) => {
        const key = u.equipped?.[slot];
        if (!key) return '🚫 None';
        const item = STORE[key];
        const upLv = upgrades[key] || 0;
        return `${item?.name || key}${upLv > 0 ? ` *(+${upLv})*` : ''}`;
    };

    // Jail status line
    let jailLine = '';
    if (u.jail && u.jailUntil && Date.now() < u.jailUntil) {
        const remaining = u.jailUntil - Date.now();
        const m = Math.floor(remaining / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        jailLine = `│ ⛓️ Jailed : *Yes* (${m}m ${s}s left)\n`;
    } else {
        jailLine = `│ ⛓️ Jailed : *No* ✅\n`;
    }

    saveDB(db);
    await sock.sendMessage(chatId, {
        text:
            `🪪 *PROFILE — ${mention(target)}*\n\n` +
            `│ 👤 Name   : *${u.name || numFromJid(target)}*\n` +
            `│ Badge  : ${badge(target, u)}\n` +
            `│ Level  : ⚡ *${lv}*  (${fmt(u.xp || 0)} XP)\n` +
            `│ Next   : ${fmt(xpForNext(u.xp || 0))} XP to level ${lv + 1}\n` +
            `│\n` +
            `│ 👛 Wallet : *🪙 ${fmt(u.wallet)}*\n` +
            `│ 🏦 Bank   : *🪙 ${fmt(u.bank)}*\n` +
            `│ 💰 Earned : *🪙 ${fmt(u.totalEarned || 0)}*\n` +
            `│\n` +
            `│ ⚔️ ATK    : ${st.atk}\n` +
            `│ 🛡️ DEF    : ${st.def}\n` +
            `│ 🍀 Luck   : ${st.luck}\n` +
            `│ ❤️ Max HP : ${st.maxHp}\n` +
            `│\n` +
            `│ Weapon    : ${fmtEquip('weapon')}\n` +
            `│ Armor     : ${fmtEquip('armor')}\n` +
            `│ Accessory : ${fmtEquip('accessory')}\n` +
            `│\n` +
            `│ 🏆 Wins   : ${u.wins || 0}\n` +
            `│ 💀 Losses : ${u.losses || 0}\n` +
            `│ 📦 Items  : ${(u.inventory || []).length}\n` +
            jailLine,
        mentions: [target],
    }, { quoted: message });
}

async function dailyCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 24 * 60 * 60 * 1000;
    const left = cooldownLeft(u.lastDaily, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Daily already claimed!\nCome back in *${left}*.` }, { quoted: message });
    const reward   = isOwner(uid) ? 999999 : Math.floor(Math.random() * 501) + 500;
    u.wallet      += reward;
    u.totalEarned  = (u.totalEarned || 0) + reward;
    u.lastDaily    = Date.now();
    addXp(u, 50);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `🎁 *DAILY REWARD!*\n\n+*🪙 ${fmt(reward)}* coins!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n⚡ +50 XP  |  Level ${levelOf(u.xp)}`,
    }, { quoted: message });
}

async function workCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 60 * 60 * 1000;
    const left = cooldownLeft(u.lastWork, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Still tired from last job!\nRest for *${left}* more.` }, { quoted: message });
    const jobs = [
        ['🧑‍💻 Freelance Dev', 150, 400], ['🚗 Uber Driver', 100, 300],
        ['📦 Delivery Rider', 120, 350], ['🍔 Fast Food Worker', 80, 250],
        ['🏗️ Construction', 130, 380],   ['🎨 Graphic Designer', 160, 420],
        ['📷 Photographer', 140, 390],   ['🧹 Cleaner', 70, 200],
        ['🎤 Street Performer', 100, 450], ['🌾 Farmer', 110, 330],
        ['👨‍🍳 Chef', 170, 440],          ['🔧 Mechanic', 140, 400],
        ['💻 Web Dev', 200, 500],        ['📊 Analyst', 180, 460],
        ['🎮 Game Tester', 120, 380],    ['🚒 Firefighter', 160, 450],
        ['⚕️ Nurse', 190, 480],          ['✈️ Pilot', 250, 600],
    ];
    const [job, min, max] = jobs[Math.floor(Math.random() * jobs.length)];
    const earned  = isOwner(uid) ? 999999 : Math.floor(Math.random() * (max - min + 1)) + min;
    u.wallet     += earned;
    u.totalEarned = (u.totalEarned || 0) + earned;
    u.lastWork    = Date.now();
    addXp(u, 30);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `💼 *WORK DONE!*\n\nJob: ${job}\nEarned: *🪙 ${fmt(earned)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n⚡ +30 XP`,
    }, { quoted: message });
}

async function mineCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 30 * 60 * 1000;
    const left = cooldownLeft(u.lastMine, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Pickaxe needs a break!\nMine again in *${left}*.` }, { quoted: message });
    const finds   = [
        { item: '💎 Diamond', coins: 500 }, { item: '🥇 Gold', coins: 300 },
        { item: '🥈 Silver', coins: 150 },  { item: '🪨 Stone', coins: 50 },
        { item: '⛏️ Nothing', coins: 0 },   { item: '🔮 Magic Crystal', coins: 800 },
        { item: '🌑 Dark Ore', coins: 650 },
    ];
    const weights = [5, 15, 25, 35, 10, 5, 5];
    let roll = Math.random() * 100, acc = 0, found = finds[3];
    for (let i = 0; i < finds.length; i++) { acc += weights[i]; if (roll < acc) { found = finds[i]; break; } }
    const coins  = isOwner(uid) ? 99999 : found.coins;
    u.wallet    += coins;
    u.totalEarned = (u.totalEarned || 0) + coins;
    u.lastMine   = Date.now();
    addXp(u, 20);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `⛏️ *MINING RESULT*\n\nFound: *${found.item}*\nEarned: *🪙 ${fmt(coins)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n⚡ +20 XP`,
    }, { quoted: message });
}

async function fishCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 20 * 60 * 1000;
    const left = cooldownLeft(u.lastFish, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Fish aren't biting yet!\nTry again in *${left}*.` }, { quoted: message });
    const catches = [
        { item: '🐋 Whale', coins: 600 }, { item: '🦈 Shark', coins: 400 },
        { item: '🐟 Fish', coins: 200 },  { item: '🐡 Blowfish', coins: 100 },
        { item: '👟 Old Boot', coins: 0 }, { item: '🦑 Giant Squid', coins: 750 },
        { item: '🐙 Octopus', coins: 350 },
    ];
    const weights = [3, 12, 30, 30, 12, 5, 8];
    let roll = Math.random() * 100, acc = 0, caught = catches[2];
    for (let i = 0; i < catches.length; i++) { acc += weights[i]; if (roll < acc) { caught = catches[i]; break; } }
    const coins  = isOwner(uid) ? 99999 : caught.coins;
    u.wallet    += coins;
    u.totalEarned = (u.totalEarned || 0) + coins;
    u.lastFish   = Date.now();
    addXp(u, 15);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `🎣 *FISHING RESULT*\n\nCaught: *${caught.item}*\nEarned: *🪙 ${fmt(coins)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n⚡ +15 XP`,
    }, { quoted: message });
}

async function robCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 2 * 60 * 60 * 1000;
    const left = cooldownLeft(u.lastRob, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Lay low! Police are watching.\nRob again in *${left}*.` }, { quoted: message });
    const mentioned = resolveTarget(message);
    if (!mentioned) return sock.sendMessage(chatId, { text: `❌ Tag or reply to someone to rob!\n_Example: $rob @user_` }, { quoted: message });
    if (numFromJid(mentioned) === numFromJid(uid)) return sock.sendMessage(chatId, { text: `❌ You can't rob yourself!` }, { quoted: message });
    const target = getUser(db, mentioned);
    if (!target.registered) return sock.sendMessage(chatId, { text: `❌ That user hasn't registered yet!` }, { quoted: message });
    if (target.wallet < 100) return sock.sendMessage(chatId, { text: `😂 ${mention(mentioned)} is broke! Not worth it.`, mentions: [mentioned] }, { quoted: message });
    u.lastRob = Date.now();
    const luckBonus = (getStats(u).luck || 0) / 100;
    const success   = Math.random() < (0.45 + luckBonus);
    if (success) {
        const stolen = isOwner(uid) ? target.wallet : Math.floor(target.wallet * (Math.random() * 0.3 + 0.1));
        target.wallet -= stolen;
        u.wallet      += stolen;
        u.totalEarned  = (u.totalEarned || 0) + stolen;
        addXp(u, 40);
        saveDB(db);
        await sock.sendMessage(chatId, {
            text: `🦹 *SUCCESSFUL ROB!*\n\nStole *🪙 ${fmt(stolen)}* from ${mention(mentioned)}!\n👛 Your wallet: *🪙 ${fmt(u.wallet)}*\n⚡ +40 XP`,
            mentions: [mentioned],
        }, { quoted: message });
    } else {
        const fine = isOwner(uid) ? 0 : Math.floor(u.wallet * 0.15);
        u.wallet   = Math.max(0, u.wallet - fine);
        // Jail for 5 minutes on rob failure
        if (!isOwner(uid)) {
            u.jail     = true;
            u.jailUntil = Date.now() + 5 * 60 * 1000;
        }
        saveDB(db);
        await sock.sendMessage(chatId, {
            text:
                `🚔 *CAUGHT!*\n\nFailed to rob ${mention(mentioned)}!\n` +
                `💸 Fine    : *🪙 ${fmt(fine)}*\n` +
                `🔒 Jailed  : *5 minutes*\n` +
                `👛 Wallet  : *🪙 ${fmt(u.wallet)}*`,
            mentions: [mentioned],
        }, { quoted: message });
    }
}

async function payCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const mentioned = resolveTarget(message);
    const amount    = parseInt((q || '').replace(/[^0-9]/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *$pay @user amount* or reply to a message` }, { quoted: message });
    if (numFromJid(mentioned) === numFromJid(uid)) return sock.sendMessage(chatId, { text: `❌ Can't pay yourself!` }, { quoted: message });
    const tgt = getUser(db, mentioned);
    if (!tgt.registered) return sock.sendMessage(chatId, { text: `❌ That user hasn't registered yet!` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    if (!isOwner(uid)) u.wallet -= amount;
    tgt.wallet += amount;
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `💸 *SENT!*\n\n*🪙 ${fmt(amount)}* → ${mention(mentioned)}\n👛 Your wallet: *🪙 ${fmt(u.wallet)}*`,
        mentions: [mentioned],
    }, { quoted: message });
}

async function giftCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const mentioned = resolveTarget(message);
    const amount    = parseInt((q || '').replace(/[^0-9]/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *$gift @user amount* or reply to a message` }, { quoted: message });
    const tgt = getUser(db, mentioned);
    if (!tgt.registered) return sock.sendMessage(chatId, { text: `❌ That user hasn't registered yet!` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    if (!isOwner(uid)) u.wallet -= amount;
    tgt.wallet += amount;
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `🎁 *GIFT SENT!*\n\n${mention(uid)} gifted *🪙 ${fmt(amount)}* to ${mention(mentioned)}! 🎉\n👛 Your wallet: *🪙 ${fmt(u.wallet)}*`,
        mentions: [mentioned],
    }, { quoted: message });
}

async function depositCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *$deposit <amount/all>*` }, { quoted: message });
    if (u.wallet < amount) return sock.sendMessage(chatId, { text: `❌ Not enough in wallet!` }, { quoted: message });
    u.wallet -= amount; u.bank += amount; saveDB(db);
    await sock.sendMessage(chatId, { text: `🏦 Deposited *🪙 ${fmt(amount)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*  |  🏦 Bank: *🪙 ${fmt(u.bank)}*` }, { quoted: message });
}

async function withdrawCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const amount = q?.toLowerCase() === 'all' ? u.bank : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *$withdraw <amount/all>*` }, { quoted: message });
    if (u.bank < amount) return sock.sendMessage(chatId, { text: `❌ Not enough in bank!` }, { quoted: message });
    u.bank -= amount; u.wallet += amount; saveDB(db);
    await sock.sendMessage(chatId, { text: `🏦 Withdrew *🪙 ${fmt(amount)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*  |  🏦 Bank: *🪙 ${fmt(u.bank)}*` }, { quoted: message });
}

async function gambleCommand(sock, chatId, message, q) {
    const db     = loadDB();
    const uid    = senderJid(message);
    ownerBoost(db, uid);
    const u      = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *$gamble <amount/all>*` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!` }, { quoted: message });
    const luckBonus = (getStats(u).luck || 0) / 100;
    const win = Math.random() < (0.45 + luckBonus) || isOwner(uid);
    if (win) {
        u.wallet += amount; u.totalEarned = (u.totalEarned || 0) + amount; addXp(u, 10);
        saveDB(db);
        await sock.sendMessage(chatId, { text: `🎰 *YOU WON!* +🪙 ${fmt(amount)}\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    } else {
        u.wallet = Math.max(0, u.wallet - amount); saveDB(db);
        await sock.sendMessage(chatId, { text: `🎰 *YOU LOST!* -🪙 ${fmt(amount)}\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    }
}

async function slotsCommand(sock, chatId, message, q) {
    const db     = loadDB();
    const uid    = senderJid(message);
    ownerBoost(db, uid);
    const u      = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *$slots <amount>*` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!` }, { quoted: message });
    const sym = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎'];
    const s   = [sym[Math.floor(Math.random() * sym.length)], sym[Math.floor(Math.random() * sym.length)], sym[Math.floor(Math.random() * sym.length)]];
    if (isOwner(uid)) s[0] = s[1] = s[2] = '💎';
    const display = `[ ${s[0]} | ${s[1]} | ${s[2]} ]`;
    let multiplier = 0;
    if (s[0] === s[1] && s[1] === s[2]) multiplier = s[0] === '💎' ? 10 : s[0] === '⭐' ? 5 : 3;
    if (multiplier > 0) {
        const win = amount * multiplier; u.wallet += win; u.totalEarned = (u.totalEarned || 0) + win; addXp(u, 25); saveDB(db);
        await sock.sendMessage(chatId, { text: `🎰 *SLOTS*\n${display}\n\n🎉 *JACKPOT x${multiplier}!*\nWon: *🪙 ${fmt(win)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    } else {
        u.wallet = Math.max(0, u.wallet - amount); saveDB(db);
        await sock.sendMessage(chatId, { text: `🎰 *SLOTS*\n${display}\n\n😢 No match. Lost *🪙 ${fmt(amount)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    }
}

async function coinflipEcoCommand(sock, chatId, message, q) {
    const db     = loadDB();
    const uid    = senderJid(message);
    ownerBoost(db, uid);
    const u      = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const parts  = (q || '').trim().split(' ');
    const amount = parseInt(parts[0]) || 0;
    const side   = (parts[1] || '').toLowerCase();
    if (!amount || !['heads','tails','h','t'].includes(side)) return sock.sendMessage(chatId, { text: `❌ Usage: *$coinflip <amount> <heads/tails>*` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!` }, { quoted: message });
    const result = isOwner(uid) ? (side.startsWith('h') ? 'heads' : 'tails') : (Math.random() < 0.5 ? 'heads' : 'tails');
    const chosen = side.startsWith('h') ? 'heads' : 'tails';
    if (chosen === result) {
        u.wallet += amount; u.totalEarned = (u.totalEarned || 0) + amount; saveDB(db);
        await sock.sendMessage(chatId, { text: `🪙 *COIN FLIP*\nResult: *${result === 'heads' ? '🟡 Heads' : '⚫ Tails'}*  ✅\n\nWon *🪙 ${fmt(amount)}*!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    } else {
        u.wallet = Math.max(0, u.wallet - amount); saveDB(db);
        await sock.sendMessage(chatId, { text: `🪙 *COIN FLIP*\nResult: *${result === 'heads' ? '🟡 Heads' : '⚫ Tails'}*  ❌\n\nLost *🪙 ${fmt(amount)}*!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    }
}

async function storeCommand(sock, chatId, message) {
    const db  = loadDB();
    const uid = senderJid(message);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    const categories = { weapon: [], armor: [], accessory: [], potion: [], boost: [] };
    for (const [key, item] of Object.entries(STORE)) {
        const cat = categories[item.type] || categories.potion;
        cat.push({ key, ...item });
    }
    const section = (title, items) => {
        if (!items.length) return '';
        return `*${title}*\n` + items.map(i => {
            const stats = [i.atk && `⚔️${i.atk}`, i.def && `🛡️${i.def}`, i.luck && `🍀${i.luck}`, i.hp && `❤️${i.hp}`, i.xp && `⚡${i.xp}XP`].filter(Boolean).join(' ');
            return `│ \`$buy ${i.key}\` — ${i.name}  🪙${fmt(i.price)}  ${stats}`;
        }).join('\n');
    };
    await sock.sendMessage(chatId, {
        text:
            `🏪 *DARATECH STORE*\n\n` +
            section('⚔️ WEAPONS', categories.weapon) + '\n\n' +
            section('🛡️ ARMORS', categories.armor) + '\n\n' +
            section('💍 ACCESSORIES', categories.accessory) + '\n\n' +
            section('🧪 CONSUMABLES', [...categories.potion, ...categories.boost]) + '\n\n' +
            `_Use $buy <item> to purchase | $upgrade <item> to upgrade (max +${MAX_UPGRADE})_`,
    }, { quoted: message });
}

async function buyCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const key  = (q || '').trim().toLowerCase().replace(/\s+/g, '');
    const item = STORE[key];
    if (!item) return sock.sendMessage(chatId, { text: `❌ Item not found! Use *$store* to see available items.` }, { quoted: message });
    if (u.wallet < item.price && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n🪙 Need: ${fmt(item.price)}  |  👛 Have: ${fmt(u.wallet)}` }, { quoted: message });
    if (!isOwner(uid)) { u.wallet -= item.price; u.totalSpent = (u.totalSpent || 0) + item.price; }
    u.inventory = u.inventory || [];
    u.inventory.push(key);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `✅ *PURCHASED!*\n\n${item.name} is now in your inventory!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n\n_${item.consumable ? 'Use $use ' + key + ' to use it' : 'Use $equip ' + key + ' to equip | $upgrade ' + key + ' to upgrade'}_`,
    }, { quoted: message });
}

async function sellCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    const key = (q || '').trim().toLowerCase();
    const inv = u.inventory || [];
    const idx = inv.indexOf(key);
    if (idx === -1) return sock.sendMessage(chatId, { text: `❌ You don't have *${key}* in your inventory!` }, { quoted: message });
    const item      = STORE[key];
    const sellPrice = Math.floor((item?.price || 0) * 0.5);
    inv.splice(idx, 1);
    u.inventory = inv;
    u.wallet   += sellPrice;
    if (u.equipped?.weapon === key)    u.equipped.weapon    = null;
    if (u.equipped?.armor === key)     u.equipped.armor     = null;
    if (u.equipped?.accessory === key) u.equipped.accessory = null;
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `💰 *SOLD!*\n\n${item?.name || key} sold for *🪙 ${fmt(sellPrice)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*`,
    }, { quoted: message });
}

async function inventoryCommand(sock, chatId, message) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    saveDB(db);
    const inv = u.inventory || [];
    const upgrades = u.upgrades || {};
    if (!inv.length) return sock.sendMessage(chatId, { text: `🎒 Your inventory is empty!\nUse *$store* to buy items.` }, { quoted: message });
    const counts = {};
    inv.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    const rows = Object.entries(counts).map(([k, c]) => {
        const item  = STORE[k];
        const eq    = (u.equipped?.weapon === k || u.equipped?.armor === k || u.equipped?.accessory === k) ? ' ✅ *equipped*' : '';
        const upLv  = upgrades[k] || 0;
        const upStr = (!item?.consumable && upLv > 0) ? ` *(+${upLv})*` : '';
        return `│ ${item?.name || k}${upStr}${c > 1 ? ` x${c}` : ''}${eq}`;
    }).join('\n');
    await sock.sendMessage(chatId, {
        text:
            `🎒 *INVENTORY — ${mention(uid)}*\n\n` +
            `╭──────────────────\n${rows}\n╰──────────────────\n\n` +
            `_Use $equip <item> to equip | $sell <item> to sell | $upgrade <item> to upgrade_`,
    }, { quoted: message });
}

async function equipCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    const key = (q || '').trim().toLowerCase();
    const item = STORE[key];
    if (!item) return sock.sendMessage(chatId, { text: `❌ Item not found! Check *$inventory*` }, { quoted: message });
    const inv = u.inventory || [];
    if (!inv.includes(key) && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ You don't own *${item.name}*!\nBuy it with *$buy ${key}*` }, { quoted: message });
    if (item.consumable) return sock.sendMessage(chatId, { text: `❌ Consumables can't be equipped!\nUse *$use ${key}* instead.` }, { quoted: message });
    u.equipped           = u.equipped || {};
    u.equipped[item.type] = key;
    saveDB(db);
    const st = getStats(u);
    const upLv = (u.upgrades || {})[key] || 0;
    await sock.sendMessage(chatId, {
        text: `✅ *EQUIPPED!*\n\n${item.name}${upLv > 0 ? ` *(+${upLv})*` : ''} is now your active ${item.type}!\n⚔️ ATK: ${st.atk}  |  🛡️ DEF: ${st.def}  |  🍀 Luck: ${st.luck}`,
    }, { quoted: message });
}

async function upgradeCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const key = (q || '').trim().toLowerCase().replace(/\s+/g, '');

    if (!key) return sock.sendMessage(chatId, {
        text: `🔧 *UPGRADE SYSTEM*\n\nUpgrade your gear to boost its stats by *+10% per level* (max +${MAX_UPGRADE}).\n\n_Usage: $upgrade <item key>_\n_Example: $upgrade dragonsword_\n\nSee your items: *$inventory*`
    }, { quoted: message });

    const item = STORE[key];
    if (!item) return sock.sendMessage(chatId, { text: `❌ Item not found! Check *$store* or *$inventory*` }, { quoted: message });
    if (item.consumable) return sock.sendMessage(chatId, { text: `❌ Consumables can't be upgraded!` }, { quoted: message });

    const inv = u.inventory || [];
    if (!inv.includes(key) && !isOwner(uid)) return sock.sendMessage(chatId, {
        text: `❌ You don't own *${item.name}*! Buy it first with *$buy ${key}*`
    }, { quoted: message });

    u.upgrades = u.upgrades || {};
    const currentLevel = isOwner(uid) ? MAX_UPGRADE : (u.upgrades[key] || 0);

    if (currentLevel >= MAX_UPGRADE) {
        saveDB(db);
        return sock.sendMessage(chatId, {
            text: `✨ *${item.name}* is already at *MAX upgrade (+${MAX_UPGRADE})*!`
        }, { quoted: message });
    }

    const cost = Math.floor(item.price * 0.3 * (currentLevel + 1));
    if (u.wallet < cost && !isOwner(uid)) return sock.sendMessage(chatId, {
        text: `❌ Not enough coins!\n💰 Upgrade cost: 🪙 ${fmt(cost)}\n👛 Your wallet: 🪙 ${fmt(u.wallet)}`
    }, { quoted: message });

    if (!isOwner(uid)) u.wallet -= cost;
    u.upgrades[key] = currentLevel + 1;
    const newLevel = u.upgrades[key];

    const bonuses = [];
    if (item.atk)  bonuses.push(`⚔️ ATK ${item.atk} → ${Math.floor(item.atk  * (1 + newLevel * 0.1))}`);
    if (item.def)  bonuses.push(`🛡️ DEF ${item.def} → ${Math.floor(item.def  * (1 + newLevel * 0.1))}`);
    if (item.luck) bonuses.push(`🍀 LCK ${item.luck} → ${Math.floor(item.luck * (1 + newLevel * 0.1))}`);

    addXp(u, 25);
    saveDB(db);

    const stars = '⭐'.repeat(newLevel) + '☆'.repeat(MAX_UPGRADE - newLevel);
    const nextCost = newLevel < MAX_UPGRADE ? fmt(Math.floor(item.price * 0.3 * (newLevel + 1))) : 'MAX';

    await sock.sendMessage(chatId, {
        text:
            `🔧 *UPGRADE SUCCESS!*\n\n` +
            `${item.name} → *+${newLevel}*\n` +
            `${stars}\n\n` +
            (bonuses.length ? bonuses.join('\n') + '\n' : '') +
            (cost > 0 ? `\n💸 Cost: 🪙 ${fmt(cost)}\n` : '') +
            `👛 Wallet: 🪙 ${fmt(u.wallet)}\n` +
            (newLevel >= MAX_UPGRADE
                ? `\n✨ *MAX LEVEL REACHED!* This item is now legendary!`
                : `\n_Next upgrade (+${newLevel + 1}): 🪙 ${nextCost}_`)
    }, { quoted: message });
}

async function useCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    const key = (q || '').trim().toLowerCase();

    if (!key) return sock.sendMessage(chatId, {
        text: `❌ Usage: *$use <item>*\n_Example: $use xpboost_\n\nSee consumables in *$inventory*`
    }, { quoted: message });

    const item = STORE[key];
    if (!item || !item.consumable) return sock.sendMessage(chatId, {
        text: `❌ *${key}* is not a usable consumable! Check *$inventory*`
    }, { quoted: message });

    const inv = u.inventory || [];
    const idx = inv.indexOf(key);
    if (idx === -1 && !isOwner(uid)) return sock.sendMessage(chatId, {
        text: `❌ You don't have *${item.name}*! Buy it with *$buy ${key}*`
    }, { quoted: message });

    if (!isOwner(uid)) inv.splice(idx, 1);
    u.inventory = inv;

    let resultText = '';
    if (item.type === 'boost' && item.xp) {
        addXp(u, item.xp);
        resultText = `⚡ Gained *+${item.xp} XP*!\n🔮 Total XP: ${fmt(u.xp)}\n⭐ Level: ${levelOf(u.xp)}`;
    } else if (item.hp) {
        const bonus = Math.floor(item.hp * 10);
        u.wallet += bonus;
        u.totalEarned = (u.totalEarned || 0) + bonus;
        resultText = `❤️ Restored *${item.hp} HP* (converted to 🪙 ${fmt(bonus)} coins)\n👛 Wallet: ${fmt(u.wallet)}`;
    }

    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `✨ *USED ${item.name}!*\n\n${resultText}`
    }, { quoted: message });
}

async function battleCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const CD   = 30 * 60 * 1000;
    const left = cooldownLeft(u.lastBattle, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Still recovering from last battle!\nFight again in *${left}*.` }, { quoted: message });

    // resolveDbJid: if the mentioned JID is in LID format (Baileys v7), map it
    // to the real DB key so stats/wins save to the correct registered account.
    const rawMentioned = resolveTarget(message);
    if (!rawMentioned) return sock.sendMessage(chatId, { text: `❌ Tag or reply to someone to battle!\n_Example: $battle @user 500_` }, { quoted: message });
    const mentioned = resolveDbJid(db, rawMentioned);
    if (numFromJid(mentioned) === numFromJid(uid)) return sock.sendMessage(chatId, { text: `❌ You can't battle yourself!` }, { quoted: message });

    const bet = parseInt((q || '').replace(/\D/g, '')) || 0;
    const t   = getUser(db, mentioned);
    if (!t.registered) return sock.sendMessage(chatId, { text: `❌ That user hasn't registered yet!` }, { quoted: message });
    if (bet > 0) {
        if (u.wallet < bet && !isOwner(uid))       return sock.sendMessage(chatId, { text: `❌ You don't have 🪙 ${fmt(bet)} in your wallet!` }, { quoted: message });
        if (t.wallet < bet && !isOwner(mentioned)) return sock.sendMessage(chatId, { text: `❌ ${mention(mentioned)} doesn't have enough coins for this bet!`, mentions: [mentioned] }, { quoted: message });
    }

    const statsU = getStats(u);
    const statsT = getStats(t);
    let hpU = statsU.maxHp, hpT = statsT.maxHp;
    const log = [];
    let round = 0;

    const hasPotionOf = (inv, keys) => keys.some(k => (inv || []).includes(k));
    const HEAL_ITEMS = ['elixir', 'megapotion', 'potion'];
    let usedPotionU = false, usedPotionT = false;

    while (hpU > 0 && hpT > 0 && round < 12) {
        round++;
        const dmgU = Math.max(1, Math.floor((statsU.atk + Math.random() * 20) * (1 - statsT.def / 200)));
        hpT = Math.max(0, hpT - dmgU);
        log.push(`R${round}: ${mention(uid)} ⚔️ -${fmt(dmgU)} → ${mention(mentioned)} ❤️ ${fmt(hpT)}`);
        if (hpT <= 0) break;

        const dmgT = Math.max(1, Math.floor((statsT.atk + Math.random() * 20) * (1 - statsU.def / 200)));
        hpU = Math.max(0, hpU - dmgT);
        log.push(`R${round}: ${mention(mentioned)} ⚔️ -${fmt(dmgT)} → ${mention(uid)} ❤️ ${fmt(hpU)}`);

        if (!usedPotionU && hasPotionOf(u.inventory, HEAL_ITEMS) && hpU < statsU.maxHp * 0.3) {
            const pKey = HEAL_ITEMS.find(k => (u.inventory || []).includes(k));
            const heal = STORE[pKey].hp;
            hpU = Math.min(statsU.maxHp, hpU + heal);
            const idx = u.inventory.indexOf(pKey); if (idx > -1) u.inventory.splice(idx, 1);
            usedPotionU = true;
            log.push(`🧪 ${mention(uid)} used ${STORE[pKey].name}! ❤️ ${fmt(hpU)}`);
        }
        if (!usedPotionT && hasPotionOf(t.inventory, HEAL_ITEMS) && hpT < statsT.maxHp * 0.3) {
            const pKey = HEAL_ITEMS.find(k => (t.inventory || []).includes(k));
            const heal = STORE[pKey].hp;
            hpT = Math.min(statsT.maxHp, hpT + heal);
            const idx = t.inventory.indexOf(pKey); if (idx > -1) t.inventory.splice(idx, 1);
            usedPotionT = true;
            log.push(`🧪 ${mention(mentioned)} used ${STORE[pKey].name}! ❤️ ${fmt(hpT)}`);
        }
    }

    const winnerJid = hpU > hpT ? uid : mentioned;
    const loserJid  = hpU > hpT ? mentioned : uid;
    const winner    = hpU > hpT ? u : t;
    const loser     = hpU > hpT ? t : u;

    winner.wins   = (winner.wins   || 0) + 1;
    loser.losses  = (loser.losses  || 0) + 1;
    u.lastBattle  = Date.now();
    addXp(winner, 100);
    addXp(loser, 20);

    if (bet > 0) {
        if (!isOwner(loserJid))  loser.wallet  = Math.max(0, loser.wallet - bet);
        if (!isOwner(winnerJid)) winner.wallet += bet;
        winner.totalEarned = (winner.totalEarned || 0) + bet;
    }
    saveDB(db);

    // Show only the last 6 log lines (final ~3 rounds) to keep the output tight
    const shownLog    = log.slice(-6).join('\n');
    const winnerLv    = fmt(levelOf(winner.xp));
    const loserLv     = fmt(levelOf(loser.xp));

    await sock.sendMessage(chatId, {
        text:
            `⚔️ *BATTLE*\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `👤 *${mention(uid)}*\n` +
            `   ❤️ ${fmt(statsU.maxHp)}  ⚔️ ${fmt(statsU.atk)}  🛡️ ${fmt(statsU.def)}  Lv ${fmt(levelOf(u.xp))}\n` +
            `        VS\n` +
            `👤 *${mention(mentioned)}*\n` +
            `   ❤️ ${fmt(statsT.maxHp)}  ⚔️ ${fmt(statsT.atk)}  🛡️ ${fmt(statsT.def)}  Lv ${fmt(levelOf(t.xp))}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `${shownLog}\n` +
            `━━━━━━━━━━━━━━━━\n` +
            `🏆 *WINNER: ${mention(winnerJid)}*  Lv ${winnerLv}\n` +
            `   ⚡ +100 XP  |  🏆 Wins: ${winner.wins}\n` +
            `💀 *Loser: ${mention(loserJid)}*  Lv ${loserLv}\n` +
            `   ⚡ +20 XP  |  💀 Losses: ${loser.losses}\n` +
            (bet > 0 ? `💰 *Pot: 🪙 ${fmt(bet)}* → ${mention(winnerJid)}\n` : '') +
            `━━━━━━━━━━━━━━━━`,
        mentions: [uid, mentioned],
    }, { quoted: message });
}

async function statsCommand(sock, chatId, message) {
    const db     = loadDB();
    const uid    = senderJid(message);
    const target = resolveTarget(message) || uid;
    ownerBoost(db, uid);
    const u  = getUser(db, target);
    if (!await requireRegistered(sock, chatId, message, u, target)) return;
    const st = getStats(u);
    saveDB(db);
    const total  = (u.wins || 0) + (u.losses || 0);
    const ratio  = total ? ((u.wins || 0) / total * 100).toFixed(1) : '0.0';
    await sock.sendMessage(chatId, {
        text:
            `📊 *ECO STATS — ${mention(target)}*\n\n` +
            `╭──────────────────\n` +
            `│ ⚡ Level  : ${levelOf(u.xp || 0)}\n` +
            `│ 🔮 XP     : ${fmt(u.xp || 0)}\n` +
            `│ 🏆 Wins   : ${u.wins || 0}\n` +
            `│ 💀 Losses : ${u.losses || 0}\n` +
            `│ 📈 W/L    : ${ratio}%\n` +
            `│\n` +
            `│ 💰 Earned : 🪙 ${fmt(u.totalEarned || 0)}\n` +
            `│ 🛒 Spent  : 🪙 ${fmt(u.totalSpent  || 0)}\n` +
            `│\n` +
            `│ ⚔️ ATK    : ${st.atk}\n` +
            `│ 🛡️ DEF    : ${st.def}\n` +
            `│ 🍀 Luck   : ${st.luck}\n` +
            `│ ❤️ Max HP : ${st.maxHp}\n` +
            `╰──────────────────`,
        mentions: [target],
    }, { quoted: message });
}

async function levelCommand(sock, chatId, message) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    saveDB(db);
    const lv     = levelOf(u.xp || 0);
    const toNext = xpForNext(u.xp || 0);
    const rawXp  = Math.min(u.xp || 0, 1e15);
    const progress = Math.floor(((rawXp % 300) / 300) * 10);
    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
    await sock.sendMessage(chatId, {
        text:
            `⚡ *LEVEL — ${mention(uid)}*\n\n` +
            `│ Level  : *${lv}*\n` +
            `│ XP     : *${fmt(u.xp || 0)}*\n` +
            `│ To Next: *${fmt(toNext)} XP*\n` +
            `│ [${bar}]\n\n` +
            `_Earn XP from daily, work, mine, fish, battle, gamble_`,
    }, { quoted: message });
}

async function questCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    if (!await requireRegistered(sock, chatId, message, u, uid)) return;
    if (!await requireNotJailed(sock, chatId, message, u, uid, db)) return;
    const now  = Date.now();
    const CD   = 24 * 60 * 60 * 1000;
    if (!isOwner(uid) && u.lastQuest && now - u.lastQuest < CD) {
        const left = cooldownLeft(u.lastQuest, CD);
        return sock.sendMessage(chatId, { text: `⏳ Quest already completed!\nNew quest in *${left}*.` }, { quoted: message });
    }
    const quests = [
        { task: '🎣 Fish 3 times', reward: 800 },
        { task: '⛏️ Mine 2 times', reward: 600 },
        { task: '💼 Work 2 times', reward: 700 },
        { task: '🎰 Gamble and win', reward: 1000 },
        { task: '🏆 Win a battle', reward: 1500 },
        { task: '🛒 Buy an item', reward: 500 },
        { task: '⬆️ Upgrade any item', reward: 900 },
    ];
    const quest   = quests[Math.floor(Math.random() * quests.length)];
    const reward  = isOwner(uid) ? 999999 : quest.reward;
    u.wallet     += reward;
    u.totalEarned = (u.totalEarned || 0) + reward;
    u.lastQuest   = now;
    addXp(u, 80);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text:
            `📋 *DAILY QUEST REWARD*\n\n` +
            `Quest: *${quest.task}*\n` +
            `Reward: *🪙 ${fmt(reward)}* + ⚡80 XP\n\n` +
            `👛 Wallet: *🪙 ${fmt(u.wallet)}*\n` +
            `_New quest available in 24 hours!_`,
    }, { quoted: message });
}

async function leaderboardCommand(sock, chatId, message) {
    const db      = loadDB();
    const entries = Object.entries(db)
        .filter(([, u]) => u && u.registered && typeof u.wallet === 'number')
        .map(([id, u]) => ({ id, total: (u.wallet || 0) + (u.bank || 0), name: u.name || numFromJid(id) }))
        .sort((a, b) => b.total - a.total).slice(0, 10);
    if (!entries.length) return sock.sendMessage(chatId, { text: `📊 No registered users yet!` }, { quoted: message });
    const medals = ['🥇', '🥈', '🥉'];
    const rows   = entries.map((e, i) => `│ ${medals[i] || `${i + 1}.`}  *${e.name}*  🪙 ${fmt(e.total)}`).join('\n');
    await sock.sendMessage(chatId, {
        text: `🏆 *RICHEST USERS*\n\n╭──────────────────\n${rows}\n╰──────────────────`,
    }, { quoted: message });
}

// ─── Owner-only commands ──────────────────────────────────────────────────────
async function addCoinsCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db        = loadDB();
    const mentioned = resolveTarget(message);
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *$addcoins @user amount* or reply to a message` }, { quoted: message });
    const target = getUser(db, mentioned);
    target.wallet += amount;
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Added *🪙 ${fmt(amount)}* to ${mention(mentioned)}\n👛 Their wallet: *🪙 ${fmt(target.wallet)}*`, mentions: [mentioned] }, { quoted: message });
}

async function removeCoinsCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db        = loadDB();
    const mentioned = resolveTarget(message);
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *$removecoins @user amount* or reply to a message` }, { quoted: message });
    const target  = getUser(db, mentioned);
    target.wallet = Math.max(0, target.wallet - amount);
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Removed *🪙 ${fmt(amount)}* from ${mention(mentioned)}\n👛 Their wallet: *🪙 ${fmt(target.wallet)}*`, mentions: [mentioned] }, { quoted: message });
}

async function resetUserCommand(sock, chatId, message) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db        = loadDB();
    const mentioned = resolveTarget(message);
    if (!mentioned) return sock.sendMessage(chatId, { text: `❌ Usage: *$resetuser @user* or reply to a message` }, { quoted: message });
    delete db[mentioned];
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Economy data reset for ${mention(mentioned)}`, mentions: [mentioned] }, { quoted: message });
}

async function boostUserCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db        = loadDB();
    const mentioned = resolveTarget(message);
    if (!mentioned) return sock.sendMessage(chatId, {
        text: `❌ Usage:\n*$boost @user* — full boost\n*$boost @user atk 500* — boost ATK only\n*$boost @user atk 300 def 100 luck 25* — pick any combo`,
    }, { quoted: message });

    const raw    = (q || '').toLowerCase();
    const grab   = stat => { const m = raw.match(new RegExp(`\\b${stat}\\s+(\\d+)`)); return m ? parseInt(m[1]) : null; };
    const parsed = { atk: grab('atk'), def: grab('def'), luck: grab('luck') };
    const partial = Object.values(parsed).some(v => v !== null);

    const u     = getUser(db, mentioned);
    const oldSt = getStats(u);

    if (partial) {
        u.statBonus = u.statBonus || {};
        if (parsed.atk  !== null) u.statBonus.atk  = (u.statBonus.atk  || 0) + parsed.atk;
        if (parsed.def  !== null) u.statBonus.def  = (u.statBonus.def  || 0) + parsed.def;
        if (parsed.luck !== null) u.statBonus.luck = (u.statBonus.luck || 0) + parsed.luck;
    } else {
        u.statBonus = u.statBonus || {};
        u.statBonus.atk  = (u.statBonus.atk  || 0) + 10;
        u.statBonus.def  = (u.statBonus.def  || 0) + 10;
        u.statBonus.luck = (u.statBonus.luck || 0) + 10;
    }
    saveDB(db);
    const newSt = getStats(u);

    const sleep  = ms => new Promise(r => setTimeout(r, ms));
    const fill   = (pct, len = 10) => '▓'.repeat(Math.round(pct * len)) + '░'.repeat(len - Math.round(pct * len));
    const lerp   = (a, b, t)       => Math.round(a + (b - a) * t);

    const changing = {
        atk:  oldSt.atk   !== newSt.atk,
        def:  oldSt.def   !== newSt.def,
        luck: oldSt.luck  !== newSt.luck,
        hp:   oldSt.maxHp !== newSt.maxHp,
    };

    const buildFrame = (pct, done = false) => {
        const row = (icon, label, oldVal, newVal, active) => {
            const cur = active ? lerp(oldVal, newVal, pct) : newVal;
            const bar = active ? fill(pct) : '▓'.repeat(10);
            const v   = (done && active) ? `*${fmt(cur)}*` : fmt(cur);
            return `${icon} ${label.padEnd(4)} │${bar}│ ${v}`;
        };
        const hdr = done
            ? `🌟 *BOOST COMPLETE!* ${mention(mentioned)}\n`
            : `⚡ *BOOSTING* ${mention(mentioned)}...\n`;
        const footer = done
            ? (partial
                ? `\n_Stat bonus applied — use $profile to check_`
                : `\n_All gear at +${MAX_UPGRADE} — use $equip to switch loadout_`)
            : '';
        return (
            hdr + `\n` +
            row('⚔️', 'ATK',  oldSt.atk,   newSt.atk,   changing.atk)  + '\n' +
            row('🛡️', 'DEF',  oldSt.def,   newSt.def,   changing.def)  + '\n' +
            row('🍀', 'Luck', oldSt.luck,  newSt.luck,  changing.luck) + '\n' +
            row('❤️', 'HP',   oldSt.maxHp, newSt.maxHp, changing.hp)   +
            footer
        );
    };

    const sent = await sock.sendMessage(chatId,
        { text: buildFrame(0), mentions: [mentioned] },
        { quoted: message }
    );

    const steps = [0.25, 0.5, 0.75, 1];
    for (let i = 0; i < steps.length; i++) {
        await sleep(650);
        await sock.sendMessage(chatId,
            { text: buildFrame(steps[i], i === steps.length - 1), edit: sent.key, mentions: [mentioned] }
        );
    }
}

// ─── Auto-seed owner/connector on startup ────────────────────────────────────
function seedEconomyOwner(ownerJid, ownerLid) {
    if (!ownerJid) return;
    connectorJid = ownerJid;
    if (ownerLid) connectorLid = ownerLid;
    try {
        const db = loadDB();

        // Merge stale @lid entries for the owner into the canonical key
        const lidKeys = Object.keys(db).filter(k => k.endsWith('@lid'));
        for (const lid of lidKeys) {
            if (ownerLid && lid === ownerLid) {
                const stale = db[lid];
                if (!db[ownerJid]) db[ownerJid] = stale;
                delete db[lid];
                console.log(`[Economy] Merged stale LID entry ${lid} → ${ownerJid}`);
            }
        }

        const allEquip    = Object.entries(STORE).filter(([, v]) => !v.consumable).map(([k]) => k);
        const consumables = Object.entries(STORE).filter(([, v]) =>  v.consumable).flatMap(([k]) => [k, k, k, k, k]);
        const allUpgrades = {};
        allEquip.forEach(k => { allUpgrades[k] = MAX_UPGRADE; });

        const bestOf = (type, stat) => Object.entries(STORE)
            .filter(([, v]) => v.type === type)
            .sort(([, a], [, b]) => (b[stat] || 0) - (a[stat] || 0))[0]?.[0];

        const bestWeapon    = bestOf('weapon',    'atk');
        const bestArmor     = bestOf('armor',     'def');
        const bestAccessory = Object.entries(STORE)
            .filter(([, v]) => v.type === 'accessory')
            .sort(([, a], [, b]) => ((b.atk||0)+(b.def||0)+(b.luck||0)) - ((a.atk||0)+(a.def||0)+(a.luck||0)))[0]?.[0];

        db[ownerJid] = {
            registered:  true,
            name:        'Daratech',
            wallet:      1e84,
            bank:        1e84,
            xp:          1e84,
            wins:        999999999,
            losses:      0,
            totalEarned: 1e84,
            totalSpent:  0,
            inventory:   [...allEquip, ...consumables],
            upgrades:    allUpgrades,
            equipped: {
                weapon:    bestWeapon    || 'godslayer',
                armor:     bestArmor     || 'angelwings',
                accessory: bestAccessory || 'godamulet',
            },
            lastDaily: 0, lastWork: 0, lastMine: 0, lastFish: 0,
            lastRob: 0, lastBattle: 0, lastQuest: 0,
            jail: false, jailUntil: null,
        };

        const dir = path.join(__dirname, '../data');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        saveDB(db);
        console.log(`[Economy] Owner account seeded: ${ownerJid}`);
    } catch (e) {
        console.error('[Economy] Failed to seed owner:', e.message);
    }
}

// ─── Router ───────────────────────────────────────────────────────────────────
async function economyCommand(sock, chatId, message, userMessage) {
    const raw = userMessage || message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const cmd = raw.trim().split(' ')[0].replace('$', '').toLowerCase()
    const q   = raw.trim().split(' ').slice(1).join(' ').trim();

    switch (cmd) {
        case 'register':                                 return registerCommand(sock, chatId, message, q);
        case 'balance': case 'bal': case 'wallet':       return balanceCommand(sock, chatId, message);
        case 'profile': case 'prof':                     return profileCommand(sock, chatId, message);
        case 'daily':                                    return dailyCommand(sock, chatId, message);
        case 'work':                                     return workCommand(sock, chatId, message);
        case 'mine':                                     return mineCommand(sock, chatId, message);
        case 'fish':                                     return fishCommand(sock, chatId, message);
        case 'rob':                                      return robCommand(sock, chatId, message);
        case 'pay': case 'transfer':                     return payCommand(sock, chatId, message, q);
        case 'gift':                                     return giftCommand(sock, chatId, message, q);
        case 'deposit': case 'dep':                      return depositCommand(sock, chatId, message, q);
        case 'withdraw': case 'with':                    return withdrawCommand(sock, chatId, message, q);
        case 'gamble': case 'bet':                       return gambleCommand(sock, chatId, message, q);
        case 'slots': case 'slot':                       return slotsCommand(sock, chatId, message, q);
        case 'coinflip': case 'cf':                      return coinflipEcoCommand(sock, chatId, message, q);
        case 'store': case 'shop':                       return storeCommand(sock, chatId, message);
        case 'buy':                                      return buyCommand(sock, chatId, message, q);
        case 'sell': case 'sellitem':                    return sellCommand(sock, chatId, message, q);
        case 'inventory': case 'inv': case 'items':      return inventoryCommand(sock, chatId, message);
        case 'equip':                                    return equipCommand(sock, chatId, message, q);
        case 'upgrade': case 'up':                       return upgradeCommand(sock, chatId, message, q);
        case 'use':                                      return useCommand(sock, chatId, message, q);
        case 'battle': case 'fight': case 'duel':        return battleCommand(sock, chatId, message, q);
        case 'estats':                                   return statsCommand(sock, chatId, message);
        case 'level': case 'rank': case 'xp':            return levelCommand(sock, chatId, message);
        case 'quest':                                    return questCommand(sock, chatId, message);
        case 'leaderboard': case 'richlist':
        case 'richest': case 'lb':                       return leaderboardCommand(sock, chatId, message);
        case 'jail':                                     return jailCommand(sock, chatId, message, q);
        case 'unjail': case 'freejail':                  return unjailCommand(sock, chatId, message);
        case 'jailstatus': case 'jailcheck':             return jailStatusCommand(sock, chatId, message);
        case 'addcoins':                                 return addCoinsCommand(sock, chatId, message, q);
        case 'removecoins': case 'deductcoins':          return removeCoinsCommand(sock, chatId, message, q);
        case 'resetuser':                                return resetUserCommand(sock, chatId, message);
        case 'boostuser': case 'boost':                  return boostUserCommand(sock, chatId, message, q);
        default:
            await sock.sendMessage(chatId, { text: `❌ Unknown economy command. Use *$menu economy* to see all.` }, { quoted: message });
    }
}

module.exports = economyCommand;
module.exports.seedEconomyOwner = seedEconomyOwner;
module.exports.isOwner          = isOwner;
