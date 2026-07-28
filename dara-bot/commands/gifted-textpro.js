'use strict';
/**
 * commands/gifted-textpro.js — Gifted Textpro API commands
 * Base: https://api.gifted.co.ke/api/textpro/<style>?text=<text>
 *
 * All 100+ styles work — returns result.image_url
 * Usage: $textpro <style> <text>   OR   $textpro  (shows style list)
 */

const axios = require('axios');
const { textproGet } = require('../lib/gifted');

// ─── Curated style list ───────────────────────────────────────────────────────
// Full list has 100+ styles; we expose ~35 popular ones with short aliases.

const STYLES = {
    // ✨ Glitter & Shine
    'goldglitter':    'goldGlitter',
    'silverglitter':  'silverGlitter',
    'blueglitter':    'blueGlitter',
    'pinkglitter':    'pinkGlitter',
    'greenglitter':   'greenGlitter',
    'bronzeglitter':  'bronzeGlitter',

    // 🌈 Neon & Glow
    'neon':           'neonLightText',
    'neonalt':        'neonTextAlt',
    'greenneon':      'greenNeon',
    'glowing':        'glowingMetal3d',

    // 🔥 Fire & Lava
    'firework':       'fireworkSparkle',
    'lava':           'lavaText',
    'halloween':      'halloweenFire',
    'blood':          'horrorBlood',

    // 🧊 Ice & Metal
    'ice':            'iceCold',
    'steel':          'steel3d',
    'blackmetal':     'blackMetal',
    'chrome':         'chromeText3d',
    'metal':          'shinyMetal',
    'goldmetal':      'metalGold3d',
    'silvermetal':    'metalSilver3d',
    'rosegold':       'metalRoseGold3d',
    'rainbow':        'metalRainbow',

    // 🎈 Balloons & Foil
    'goldfoil':       'goldFoilBalloon',
    'pinkfoil':       'pinkFoilBalloon',
    'bluefoil':       'blueFoilBalloon',
    'greenfoil':      'greenFoilBalloon',
    'redfoil':        'redFoilBalloon',
    'purplefoil':     'purpleFoilBalloon',
    'cyanfoil':       'cyanFoilBalloon',

    // 🦸 Themed
    'captain':        'captainAmerica',
    'joker':          'jokerLogo',
    'robot':          'robotR2d2',
    'wolf':           'wolfLogoGalaxy',
    'wolfbw':         'wolfLogoBw',
    'rainbow2':       'rainbowEqualizer',
    'christmas':      'christmasGift',
};

const STYLE_MENU = Object.entries(STYLES)
    .map(([alias, _]) => alias)
    .join(', ');

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getQ(message) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } });
    } catch (_) {}
}

// ─── $textpro [style] <text> ─────────────────────────────────────────────────

async function textproCommand(sock, chatId, message) {
    const q = getQ(message);

    // No args → show style list
    if (!q) {
        return sock.sendMessage(chatId, {
            text:
                `✨ *TEXTPRO STYLES*\n\n` +
                `Usage: *$textpro <style> <your text>*\n` +
                `Example: *$textpro neon Daratech*\n\n` +
                `*Available styles:*\n${STYLE_MENU}\n\n` +
                `_Daratech_ ⚡`,
        }, { quoted: message });
    }

    const parts = q.split(/\s+/);
    const alias = parts[0].toLowerCase();
    const endpoint = STYLES[alias];

    // Unknown style → try raw style name as endpoint, or show menu
    if (!endpoint) {
        // Allow user to pass a raw textpro endpoint directly (advanced)
        const rawEndpoint = parts[0];
        const text = parts.slice(1).join(' ').trim();
        if (!text) {
            return sock.sendMessage(chatId, {
                text:
                    `❓ Unknown style: *${rawEndpoint}*\n\n` +
                    `Available: ${STYLE_MENU}\n\n` +
                    `_Or use $textpro to see all styles._`,
            }, { quoted: message });
        }
        // Try it anyway
        await react(sock, message, '⏳');
        try {
            const data = await textproGet(rawEndpoint, { text });
            if (!data?.success || !data?.result?.image_url) throw new Error(data?.error || 'No image returned');
            await sock.sendMessage(chatId, {
                image: await (async () => { const r = await require('axios').get(data.result.image_url, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } }); return Buffer.from(r.data); })(),
                caption: `✨ *${rawEndpoint.toUpperCase()}*\n"${text}"\n\n_Daratech_ ⚡`,
            }, { quoted: message });
            await react(sock, message, '✅');
        } catch (err) {
            await react(sock, message, '❌');
            await sock.sendMessage(chatId, { text: `❌ Textpro failed. Unknown or invalid style.\n\nTry: $textpro to see valid styles.` }, { quoted: message });
        }
        return;
    }

    const text = parts.slice(1).join(' ').trim();
    if (!text) {
        return sock.sendMessage(chatId, {
            text: `✨ Usage: $textpro ${alias} <your text>\nExample: $textpro ${alias} Daratech`,
        }, { quoted: message });
    }

    await react(sock, message, '⏳');
    try {
        const data = await textproGet(endpoint, { text });
        if (!data?.success || !data?.result?.image_url) throw new Error(data?.error || 'No image returned');
        await sock.sendMessage(chatId, {
            image: await (async () => { const r = await require('axios').get(data.result.image_url, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } }); return Buffer.from(r.data); })(),
            caption: `✨ *TEXTPRO — ${alias.toUpperCase()}*\n"${text}"\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error(`[gifted-textpro:${endpoint}]`, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Textpro image failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = { textproCommand, STYLES };
