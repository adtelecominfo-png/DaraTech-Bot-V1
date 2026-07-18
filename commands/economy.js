'use strict';
/**
 * Economy System — Daratech Bot
 * Commands: balance, daily, work, mine, fish, rob, pay, deposit, withdraw,
 *           gamble, slots, coinflip, leaderboard, profile, gift, store, buy,
 *           inventory, equip, sell, battle, stats, level, quest,
 *           addcoins, removecoins, resetuser (owner-only)
 */

const fs   = require('fs');
const path = require('path');

const DB_PATH    = path.join(__dirname, '../data/economy.json');
const OWNER_NUM  = '2348152077346';

// ─── Store catalogue ─────────────────────────────────────────────────────────
const STORE = {
    // Weapons
    sword:       { name: '⚔️ Iron Sword',     price:   500, type: 'weapon', atk: 20 },
    steelsword:  { name: '🗡️ Steel Sword',    price:  1500, type: 'weapon', atk: 40 },
    bow:         { name: '🏹 Longbow',         price:  1200, type: 'weapon', atk: 35 },
    staff:       { name: '🔮 Magic Staff',     price:  2000, type: 'weapon', atk: 55 },
    dragonsword: { name: '🐉 Dragon Sword',    price:  8000, type: 'weapon', atk: 85 },
    // Armors
    shield:      { name: '🛡️ Wooden Shield',  price:   400, type: 'armor',  def: 15 },
    ironshield:  { name: '🛡️ Iron Shield',    price:  1000, type: 'armor',  def: 30 },
    leather:     { name: '🥋 Leather Armor',  price:   600, type: 'armor',  def: 20 },
    chainmail:   { name: '🥋 Chain Armor',    price:  1800, type: 'armor',  def: 45 },
    dragonscale: { name: '🐉 Dragon Scale',   price:  7000, type: 'armor',  def: 70 },
    // Accessories
    ring:        { name: '💍 Lucky Ring',      price:   800, type: 'accessory', luck: 10 },
    crown:       { name: '👑 Royal Crown',     price: 15000, type: 'accessory', atk: 20, def: 20, luck: 15 },
    // Potions (consumable)
    potion:      { name: '🧪 Health Potion',   price:   300, type: 'potion', hp: 50,  consumable: true },
    megapotion:  { name: '💊 Mega Potion',     price:   800, type: 'potion', hp: 120, consumable: true },
};

// ─── DB helpers ──────────────────────────────────────────────────────────────
function loadDB() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
    catch { return {}; }
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

function getUser(db, jid) {
    if (!db[jid]) db[jid] = {
        wallet: 500, bank: 0, xp: 0, wins: 0, losses: 0,
        totalEarned: 0, totalSpent: 0,
        inventory: [], equipped: { weapon: null, armor: null, accessory: null },
        lastDaily: 0, lastWork: 0, lastMine: 0, lastFish: 0,
        lastRob: 0, lastBattle: 0, lastQuest: 0,
    };
    return db[jid];
}

function isOwner(jid) {
    return jid.replace(/[^0-9]/g, '').includes(OWNER_NUM);
}

function ownerBoost(db, jid) {
    if (!isOwner(jid)) return;
    const u = getUser(db, jid);
    if (u.wallet < 999_000_000) u.wallet = 999_999_999;
    if (u.bank   < 999_000_000) u.bank   = 999_999_999;
    if (u.xp     < 999_000)     u.xp     = 999_999;
}

function senderJid(message) {
    return message.key?.participant || message.key?.remoteJid || '';
}
function numFromJid(jid) { return jid.replace(/:[^@]*/, '').split('@')[0]; }
function mention(jid)    { return `@${numFromJid(jid)}`; }
function fmt(n)          { return Number(n).toLocaleString(); }

function cooldownLeft(last, ms, ownerJid = '') {
    if (isOwner(ownerJid)) return null;
    const left = ms - (Date.now() - last);
    if (left <= 0) return null;
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(' ');
}

function levelOf(xp) { return Math.floor(xp / 300) + 1; }
function xpForNext(xp) { const l = levelOf(xp); return l * 300 - xp; }

function getStats(u) {
    let atk = 15, def = 0, luck = 0, maxHp = 100 + levelOf(u.xp || 0) * 8;
    const apply = key => {
        const item = u.equipped?.[key];
        if (!item || !STORE[item]) return;
        const s = STORE[item];
        atk  += s.atk  || 0;
        def  += s.def  || 0;
        luck += s.luck || 0;
    };
    ['weapon', 'armor', 'accessory'].forEach(apply);
    maxHp += def * 2;
    return { atk, def, luck, maxHp };
}

function addXp(u, amount) { u.xp = (u.xp || 0) + amount; }

function badge(jid, u) {
    if (isOwner(jid)) return '👑 *OWNER*';
    const lv = levelOf(u.xp || 0);
    if (lv >= 30) return '💎 *Legend*';
    if (lv >= 20) return '🏆 *Elite*';
    if (lv >= 10) return '⭐ *Pro*';
    return '🌱 *Rookie*';
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function balanceCommand(sock, chatId, message) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u = getUser(db, uid);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text:
            `💰 *WALLET — ${mention(uid)}*\n\n` +
            `╭──────────────────\n` +
            `│ 👛 Wallet : *🪙 ${fmt(u.wallet)}*\n` +
            `│ 🏦 Bank   : *🪙 ${fmt(u.bank)}*\n` +
            `│ 💎 Total  : *🪙 ${fmt(u.wallet + u.bank)}*\n` +
            `╰──────────────────\n\n` +
            `_Use .daily to earn free coins!_`,
    }, { quoted: message });
}

async function profileCommand(sock, chatId, message, q) {
    const db      = loadDB();
    const uid     = senderJid(message);
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target  = mentioned || uid;
    ownerBoost(db, uid);
    const u  = getUser(db, target);
    const lv = levelOf(u.xp || 0);
    const st = getStats(u);
    const wp = u.equipped?.weapon    ? STORE[u.equipped.weapon]?.name    : '🚫 None';
    const ar = u.equipped?.armor     ? STORE[u.equipped.armor]?.name     : '🚫 None';
    const ac = u.equipped?.accessory ? STORE[u.equipped.accessory]?.name : '🚫 None';
    saveDB(db);
    await sock.sendMessage(chatId, {
        text:
            `🪪 *PROFILE — ${mention(target)}*\n\n` +
            `│ Badge  : ${badge(target, u)}\n` +
            `│ Level  : ⚡ *${lv}*  (${u.xp || 0} XP)\n` +
            `│ Next   : ${xpForNext(u.xp || 0)} XP to level ${lv + 1}\n` +
            `│\n` +
            `│ 👛 Wallet : *🪙 ${fmt(u.wallet)}*\n` +
            `│ 🏦 Bank   : *🪙 ${fmt(u.bank)}*\n` +
            `│ 💰 Earned : *🪙 ${fmt(u.totalEarned || 0)}*\n` +
            `│\n` +
            `│ ⚔️ ATK    : ${st.atk}\n` +
            `│ 🛡️ DEF    : ${st.def}\n` +
            `│ ❤️ Max HP : ${st.maxHp}\n` +
            `│\n` +
            `│ Weapon    : ${wp}\n` +
            `│ Armor     : ${ar}\n` +
            `│ Accessory : ${ac}\n` +
            `│\n` +
            `│ 🏆 Wins   : ${u.wins || 0}\n` +
            `│ 💀 Losses : ${u.losses || 0}\n` +
            `│ 📦 Items  : ${(u.inventory || []).length}\n`,
        mentions: [target],
    }, { quoted: message });
}

async function dailyCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    const CD   = 24 * 60 * 60 * 1000;
    const left = cooldownLeft(u.lastDaily, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Daily already claimed!\nCome back in *${left}*.` }, { quoted: message });
    const reward = isOwner(uid) ? 999999 : Math.floor(Math.random() * 501) + 500;
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
    const CD   = 60 * 60 * 1000;
    const left = cooldownLeft(u.lastWork, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Still tired from last job!\nRest for *${left}* more.` }, { quoted: message });
    const jobs = [
        ['🧑‍💻 Freelance Dev', 150, 400], ['🚗 Uber Driver', 100, 300],
        ['📦 Delivery Rider', 120, 350], ['🍔 Fast Food Worker', 80, 250],
        ['🏗️ Construction', 130, 380], ['🎨 Graphic Designer', 160, 420],
        ['📷 Photographer', 140, 390], ['🧹 Cleaner', 70, 200],
        ['🎤 Street Performer', 100, 450], ['🌾 Farmer', 110, 330],
        ['👨‍🍳 Chef', 170, 440], ['🔧 Mechanic', 140, 400],
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
    const CD   = 30 * 60 * 1000;
    const left = cooldownLeft(u.lastMine, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Pickaxe needs a break!\nMine again in *${left}*.` }, { quoted: message });
    const finds   = [
        { item: '💎 Diamond', coins: 500 }, { item: '🥇 Gold', coins: 300 },
        { item: '🥈 Silver', coins: 150 },  { item: '🪨 Stone', coins: 50 },
        { item: '⛏️ Nothing', coins: 0 },
    ];
    const weights = [5, 15, 25, 40, 15];
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
    const CD   = 20 * 60 * 1000;
    const left = cooldownLeft(u.lastFish, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Fish aren't biting yet!\nTry again in *${left}*.` }, { quoted: message });
    const catches = [
        { item: '🐋 Whale', coins: 600 }, { item: '🦈 Shark', coins: 400 },
        { item: '🐟 Fish', coins: 200 },  { item: '🐡 Blowfish', coins: 100 },
        { item: '👟 Old Boot', coins: 0 },
    ];
    const weights = [3, 12, 35, 35, 15];
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
    const CD   = 2 * 60 * 60 * 1000;
    const left = cooldownLeft(u.lastRob, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Lay low! Police are watching.\nRob again in *${left}*.` }, { quoted: message });
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return sock.sendMessage(chatId, { text: `❌ Tag someone to rob!\n_Example: .rob @user_` }, { quoted: message });
    const target = getUser(db, mentioned);
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
        saveDB(db);
        await sock.sendMessage(chatId, {
            text: `🚔 *CAUGHT!*\n\nFailed to rob ${mention(mentioned)}!\nPaid *🪙 ${fmt(fine)}* as a fine.\n👛 Wallet: *🪙 ${fmt(u.wallet)}*`,
            mentions: [mentioned],
        }, { quoted: message });
    }
}

async function payCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *.pay @user amount*` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    const target   = getUser(db, mentioned);
    if (!isOwner(uid)) u.wallet -= amount;
    target.wallet += amount;
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
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *.gift @user amount*` }, { quoted: message });
    if (u.wallet < amount && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*` }, { quoted: message });
    const target   = getUser(db, mentioned);
    if (!isOwner(uid)) u.wallet -= amount;
    target.wallet += amount;
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
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *.deposit <amount/all>*` }, { quoted: message });
    if (u.wallet < amount) return sock.sendMessage(chatId, { text: `❌ Not enough in wallet!` }, { quoted: message });
    u.wallet -= amount; u.bank += amount; saveDB(db);
    await sock.sendMessage(chatId, { text: `🏦 Deposited *🪙 ${fmt(amount)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*  |  🏦 Bank: *🪙 ${fmt(u.bank)}*` }, { quoted: message });
}

async function withdrawCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    const amount = q?.toLowerCase() === 'all' ? u.bank : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *.withdraw <amount/all>*` }, { quoted: message });
    if (u.bank < amount) return sock.sendMessage(chatId, { text: `❌ Not enough in bank!` }, { quoted: message });
    u.bank -= amount; u.wallet += amount; saveDB(db);
    await sock.sendMessage(chatId, { text: `🏦 Withdrew *🪙 ${fmt(amount)}*\n👛 Wallet: *🪙 ${fmt(u.wallet)}*  |  🏦 Bank: *🪙 ${fmt(u.bank)}*` }, { quoted: message });
}

async function gambleCommand(sock, chatId, message, q) {
    const db     = loadDB();
    const uid    = senderJid(message);
    ownerBoost(db, uid);
    const u      = getUser(db, uid);
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *.gamble <amount/all>*` }, { quoted: message });
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
    const amount = q?.toLowerCase() === 'all' ? u.wallet : parseInt(q) || 0;
    if (!amount || amount <= 0) return sock.sendMessage(chatId, { text: `❌ Usage: *.slots <amount>*` }, { quoted: message });
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
    const parts  = (q || '').trim().split(' ');
    const amount = parseInt(parts[0]) || 0;
    const side   = (parts[1] || '').toLowerCase();
    if (!amount || !['heads','tails','h','t'].includes(side)) return sock.sendMessage(chatId, { text: `❌ Usage: *.coinflip <amount> <heads/tails>*` }, { quoted: message });
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
    const categories = { weapon: [], armor: [], accessory: [], potion: [] };
    for (const [key, item] of Object.entries(STORE)) {
        categories[item.type].push({ key, ...item });
    }
    const section = (title, items) =>
        `*${title}*\n` + items.map(i => {
            const stats = [i.atk && `⚔️${i.atk}`, i.def && `🛡️${i.def}`, i.luck && `🍀${i.luck}`, i.hp && `❤️${i.hp}`].filter(Boolean).join(' ');
            return `│ \`.buy ${i.key}\` — ${i.name}  🪙${fmt(i.price)}  ${stats}`;
        }).join('\n');
    await sock.sendMessage(chatId, {
        text:
            `🏪 *DARATECH STORE*\n\n` +
            section('⚔️ WEAPONS', categories.weapon) + '\n\n' +
            section('🛡️ ARMORS', categories.armor) + '\n\n' +
            section('💍 ACCESSORIES', categories.accessory) + '\n\n' +
            section('🧪 POTIONS', categories.potion) + '\n\n' +
            `_Use .buy <item name> to purchase_`,
    }, { quoted: message });
}

async function buyCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    const key  = (q || '').trim().toLowerCase().replace(/\s+/g, '');
    const item = STORE[key];
    if (!item) return sock.sendMessage(chatId, { text: `❌ Item not found! Use *.store* to see available items.` }, { quoted: message });
    if (u.wallet < item.price && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Not enough coins!\n🪙 Need: ${fmt(item.price)}  |  👛 Have: ${fmt(u.wallet)}` }, { quoted: message });
    if (!isOwner(uid)) { u.wallet -= item.price; u.totalSpent = (u.totalSpent || 0) + item.price; }
    u.inventory = u.inventory || [];
    u.inventory.push(key);
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `✅ *PURCHASED!*\n\n${item.name} is now in your inventory!\n👛 Wallet: *🪙 ${fmt(u.wallet)}*\n\n_Use .equip ${key} to equip it_`,
    }, { quoted: message });
}

async function sellCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    const u   = getUser(db, uid);
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
    saveDB(db);
    const inv = u.inventory || [];
    if (!inv.length) return sock.sendMessage(chatId, { text: `🎒 Your inventory is empty!\nUse *.store* to buy items.` }, { quoted: message });
    const counts = {};
    inv.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
    const rows = Object.entries(counts).map(([k, c]) => {
        const item = STORE[k];
        const eq   = (u.equipped?.weapon === k || u.equipped?.armor === k || u.equipped?.accessory === k) ? ' ✅ *equipped*' : '';
        return `│ ${item?.name || k}${c > 1 ? ` x${c}` : ''}${eq}`;
    }).join('\n');
    await sock.sendMessage(chatId, {
        text:
            `🎒 *INVENTORY — ${mention(uid)}*\n\n` +
            `╭──────────────────\n${rows}\n╰──────────────────\n\n` +
            `_Use .equip <item> to equip | .sell <item> to sell_`,
    }, { quoted: message });
}

async function equipCommand(sock, chatId, message, q) {
    const db  = loadDB();
    const uid = senderJid(message);
    ownerBoost(db, uid);
    const u   = getUser(db, uid);
    const key = (q || '').trim().toLowerCase();
    const item = STORE[key];
    if (!item) return sock.sendMessage(chatId, { text: `❌ Item not found! Check *.inventory*` }, { quoted: message });
    const inv = u.inventory || [];
    if (!inv.includes(key) && !isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ You don't own *${item.name}*!\nBuy it with *.buy ${key}*` }, { quoted: message });
    if (item.consumable) return sock.sendMessage(chatId, { text: `❌ Potions can't be equipped — they're used automatically in battle!` }, { quoted: message });
    u.equipped        = u.equipped || {};
    u.equipped[item.type] = key;
    saveDB(db);
    await sock.sendMessage(chatId, {
        text: `✅ *EQUIPPED!*\n\n${item.name} is now your active ${item.type}!\n⚔️ ATK: ${getStats(u).atk}  |  🛡️ DEF: ${getStats(u).def}`,
    }, { quoted: message });
}

async function battleCommand(sock, chatId, message, q) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
    const CD   = 30 * 60 * 1000;
    const left = cooldownLeft(u.lastBattle, CD, uid);
    if (left) return sock.sendMessage(chatId, { text: `⏳ Still recovering from last battle!\nFight again in *${left}*.` }, { quoted: message });
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return sock.sendMessage(chatId, { text: `❌ Tag someone to battle!\n_Example: .battle @user 500_` }, { quoted: message });
    if (numFromJid(mentioned) === numFromJid(uid)) return sock.sendMessage(chatId, { text: `❌ You can't battle yourself!` }, { quoted: message });
    const bet = parseInt((q || '').replace(/\D/g, '')) || 0;
    const t   = getUser(db, mentioned);
    if (bet > 0) {
        if (u.wallet < bet && !isOwner(uid))       return sock.sendMessage(chatId, { text: `❌ You don't have 🪙 ${fmt(bet)} in your wallet!` }, { quoted: message });
        if (t.wallet < bet && !isOwner(mentioned)) return sock.sendMessage(chatId, { text: `❌ ${mention(mentioned)} doesn't have enough coins for this bet!`, mentions: [mentioned] }, { quoted: message });
    }

    const statsU = getStats(u);
    const statsT = getStats(t);
    let hpU = statsU.maxHp, hpT = statsT.maxHp;
    const log = [];
    let round = 0;
    const potionU = (u.inventory || []).includes('potion') || (u.inventory || []).includes('megapotion');
    const potionT = (t.inventory || []).includes('potion') || (t.inventory || []).includes('megapotion');
    let usedPotionU = false, usedPotionT = false;

    while (hpU > 0 && hpT > 0 && round < 12) {
        round++;
        const dmgU = Math.max(1, Math.floor((statsU.atk + Math.random() * 20) * (1 - statsT.def / 200)));
        hpT = Math.max(0, hpT - dmgU);
        log.push(`R${round}: ${mention(uid)} ⚔️ *-${dmgU}* → ${mention(mentioned)} ❤️${hpT}`);
        if (hpT <= 0) break;

        const dmgT = Math.max(1, Math.floor((statsT.atk + Math.random() * 20) * (1 - statsU.def / 200)));
        hpU = Math.max(0, hpU - dmgT);
        log.push(`R${round}: ${mention(mentioned)} ⚔️ *-${dmgT}* → ${mention(uid)} ❤️${hpU}`);

        if (!usedPotionU && potionU && hpU < statsU.maxHp * 0.3) {
            const pKey = (u.inventory || []).includes('megapotion') ? 'megapotion' : 'potion';
            const heal = STORE[pKey].hp;
            hpU = Math.min(statsU.maxHp, hpU + heal);
            const idx = u.inventory.indexOf(pKey); if (idx > -1) u.inventory.splice(idx, 1);
            usedPotionU = true;
            log.push(`🧪 ${mention(uid)} used ${STORE[pKey].name}! ❤️${hpU}`);
        }
        if (!usedPotionT && potionT && hpT < statsT.maxHp * 0.3) {
            const pKey = (t.inventory || []).includes('megapotion') ? 'megapotion' : 'potion';
            const heal = STORE[pKey].hp;
            hpT = Math.min(statsT.maxHp, hpT + heal);
            const idx = t.inventory.indexOf(pKey); if (idx > -1) t.inventory.splice(idx, 1);
            usedPotionT = true;
            log.push(`🧪 ${mention(mentioned)} used ${STORE[pKey].name}! ❤️${hpT}`);
        }
    }

    const winnerJid = hpU > hpT ? uid : mentioned;
    const loserJid  = hpU > hpT ? mentioned : uid;
    const winner    = hpU > hpT ? u : t;
    const loser     = hpU > hpT ? t : u;

    winner.wins   = (winner.wins || 0) + 1;
    loser.losses  = (loser.losses || 0) + 1;
    u.lastBattle  = Date.now();
    addXp(winner, 100);
    addXp(loser, 20);

    if (bet > 0) {
        if (!isOwner(loserJid))  loser.wallet  = Math.max(0, loser.wallet - bet);
        if (!isOwner(winnerJid)) winner.wallet += bet;
        winner.totalEarned = (winner.totalEarned || 0) + bet;
    }
    saveDB(db);

    const battleLog = log.slice(-8).join('\n');
    await sock.sendMessage(chatId, {
        text:
            `⚔️ *BATTLE RESULT*\n\n` +
            `${battleLog}\n\n` +
            `🏆 *WINNER: ${mention(winnerJid)}*\n` +
            (bet > 0 ? `💰 Won: *🪙 ${fmt(bet)}*\n` : '') +
            `⚡ +100 XP | Level ${levelOf(winner.xp)}`,
        mentions: [uid, mentioned],
    }, { quoted: message });
}

async function statsCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const target = mentioned || uid;
    ownerBoost(db, uid);
    const u  = getUser(db, target);
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
            `│ 🛒 Spent  : 🪙 ${fmt(u.totalSpent || 0)}\n` +
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
    saveDB(db);
    const lv     = levelOf(u.xp || 0);
    const toNext = xpForNext(u.xp || 0);
    const progress = Math.floor(((u.xp % 300) / 300) * 10);
    const bar = '█'.repeat(progress) + '░'.repeat(10 - progress);
    await sock.sendMessage(chatId, {
        text:
            `⚡ *LEVEL — ${mention(uid)}*\n\n` +
            `│ Level  : *${lv}*\n` +
            `│ XP     : *${fmt(u.xp || 0)}*\n` +
            `│ To Next: *${toNext} XP*\n` +
            `│ [${bar}]\n\n` +
            `_Earn XP from daily, work, mine, fish, battle, gamble_`,
    }, { quoted: message });
}

async function questCommand(sock, chatId, message) {
    const db   = loadDB();
    const uid  = senderJid(message);
    ownerBoost(db, uid);
    const u    = getUser(db, uid);
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
        .map(([id, u]) => ({ id, total: (u.wallet || 0) + (u.bank || 0) }))
        .sort((a, b) => b.total - a.total).slice(0, 10);
    if (!entries.length) return sock.sendMessage(chatId, { text: `📊 No economy data yet!` }, { quoted: message });
    const medals = ['🥇', '🥈', '🥉'];
    const rows   = entries.map((e, i) => `│ ${medals[i] || `${i + 1}.`}  ${mention(e.id)}  🪙 ${fmt(e.total)}`).join('\n');
    await sock.sendMessage(chatId, {
        text: `🏆 *RICHEST USERS*\n\n╭──────────────────\n${rows}\n╰──────────────────`,
        mentions: entries.map(e => e.id.includes('@') ? e.id : `${e.id}@s.whatsapp.net`),
    }, { quoted: message });
}

// ─── Owner-only commands ─────────────────────────────────────────────────────
async function addCoinsCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db   = loadDB();
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *.addcoins @user amount*` }, { quoted: message });
    const target = getUser(db, mentioned);
    target.wallet += amount;
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Added *🪙 ${fmt(amount)}* to ${mention(mentioned)}\n👛 Their wallet: *🪙 ${fmt(target.wallet)}*`, mentions: [mentioned] }, { quoted: message });
}

async function removeCoinsCommand(sock, chatId, message, q) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db   = loadDB();
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const amount    = parseInt((q || '').replace(/\D/g, '')) || 0;
    if (!mentioned || !amount) return sock.sendMessage(chatId, { text: `❌ Usage: *.removecoins @user amount*` }, { quoted: message });
    const target  = getUser(db, mentioned);
    target.wallet = Math.max(0, target.wallet - amount);
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Removed *🪙 ${fmt(amount)}* from ${mention(mentioned)}\n👛 Their wallet: *🪙 ${fmt(target.wallet)}*`, mentions: [mentioned] }, { quoted: message });
}

async function resetUserCommand(sock, chatId, message) {
    const uid = senderJid(message);
    if (!isOwner(uid)) return sock.sendMessage(chatId, { text: `❌ Owner only!` }, { quoted: message });
    const db   = loadDB();
    const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned) return sock.sendMessage(chatId, { text: `❌ Usage: *.resetuser @user*` }, { quoted: message });
    delete db[mentioned];
    saveDB(db);
    await sock.sendMessage(chatId, { text: `✅ Economy data reset for ${mention(mentioned)}`, mentions: [mentioned] }, { quoted: message });
}

// ─── Router ──────────────────────────────────────────────────────────────────
async function economyCommand(sock, chatId, message, userMessage) {
    const raw = userMessage || message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const cmd = raw.trim().split(' ')[0].replace('.', '').toLowerCase();
    const q   = raw.trim().split(' ').slice(1).join(' ').trim();

    switch (cmd) {
        case 'balance': case 'bal': case 'wallet':       return balanceCommand(sock, chatId, message);
        case 'profile': case 'prof':                     return profileCommand(sock, chatId, message, q);
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
        case 'battle': case 'fight': case 'duel':        return battleCommand(sock, chatId, message, q);
        case 'estats':                                   return statsCommand(sock, chatId, message);
        case 'level': case 'rank': case 'xp':            return levelCommand(sock, chatId, message);
        case 'quest':                                    return questCommand(sock, chatId, message);
        case 'leaderboard': case 'richlist':
        case 'richest': case 'lb':                       return leaderboardCommand(sock, chatId, message);
        case 'addcoins':                                 return addCoinsCommand(sock, chatId, message, q);
        case 'removecoins': case 'deductcoins':          return removeCoinsCommand(sock, chatId, message, q);
        case 'resetuser':                                return resetUserCommand(sock, chatId, message);
        default:
            await sock.sendMessage(chatId, { text: `❌ Unknown economy command. Use *.menu economy* to see all.` }, { quoted: message });
    }
}

module.exports = economyCommand;
