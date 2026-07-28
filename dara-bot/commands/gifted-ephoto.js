'use strict';
/**
 * commands/gifted-ephoto.js
 * Text image effects via https://api.gifted.co.ke/api/ephoto360/
 *
 * Commands:
 *   $ephoto <style> <text>              — single-text image effect
 *   $ephoto2 <style> <text1> | <text2> — dual-text image effect
 *   $ephotolist                         — list all available styles
 */

const { ephotoGet } = require('../lib/gifted');

async function react(sock, message, emoji) {
    await sock.sendMessage(message.key.remoteJid, {
        react: { text: emoji, key: message.key },
    });
}

// ─── Single-text style map (alias → endpoint) ─────────────────────────────────
const SINGLE_STYLES = {
    // Gaming / Mascot
    'hacker':       'hackerAvatar',
    'joker':        'jokerAvatar',
    'assassin':     'assassinLogo',
    'gaming':       'gamingMascot',
    'fps':          'fpsGamingLogo',
    'astronaut':    'astronautMascot',
    'dragonball':   'dragonball',
    'naruto':       'narutoShippuden',
    'minion':       'minionText',
    'dragon':       'dragonSteel',
    'comic':        'comic3d',

    // Neon / Glow
    'neon':         'makingneon',
    'neongalaxy':   'neonGalaxy',
    'blueneon':     'blueNeonLogo',
    'glow':         'glowingtext',
    'devil':        'neonDevilWings',
    'fireworks':    'fireworks',
    'futuristic':   'futuristicLight',
    'light':        'lighteffect',

    // Metal / 3D
    'silver':       'glossysilver',
    'gold':         'luxurygold',
    'glitter':      'glitterGold',
    'metallic':     'shinyMetallic3d',
    'metal3d':      'decorativeMetal3d',
    'titanium':     'titanium',
    'hot':          'hotMetallic',
    'balloon':      'foilBalloon',

    // Nature / Art
    'galaxy':       'galaxy',
    'galaxystyle':  'galaxystyle',
    'galaxywrite':  'galaxyWrite',
    'stars':        'starsNight',
    'watercolor':   'watercolor',
    'autumn':       'autumnLeaf',
    'leaves':       'impressiveLeaves',
    'angel':        'angelWing',
    'zodiac':       'zodiacLogo',

    // Text / Typography
    'glitch':       'glitchtext',
    'pixel':        'pixelglitch',
    'gradient':     'gradienttext',
    'gradient3d':   'gradientText3d',
    'typo':         'typographytext',
    'logo':         'logomaker',
    'effect':       'texteffect',
    'write':        'writetext',
    'glow2':        'glowingtext',

    // Sand / Beach
    'sand':         'sandMessages',
    'sand3d':       'sand3d',
    'sandwrite':    'sandWriting',
    'beach':        'beachText3d',

    // Special / Seasonal
    'snow':         'snow3d',
    'christmas':    'christmasSnow',
    'birthday':     'birthdayBalloon',
    'noel':         'noelText',
    'chocolate':    'chocolateText',
    'football':     'footballLogo',
    'hollywood':    'hollywoodStar',
    'double':       'doubleExposure',
    'glass':        'brokenGlass',
    'foggy':        'foggyGlass',
    'road':         'roadPaint',
    'wood':         'wooden3d',
    'embroidery':   'embroidery',
    'blackpink':    'blackpinkstyle',
    '1917':         '1917',
    'cartoon':      'cartoonstyle',
};

// ─── Dual-text style map (alias → endpoint) ───────────────────────────────────
const DUAL_STYLES = {
    'deadpool':     'deadpool',
    'thor':         'thorLogo',
    'avengers':     'avengersLogo',
    'marvel':       'marvelLogo',
    'graffiti':     'graffitiWall',
    'graffitigirl': 'graffitiGirl',
    'glittertext':  'glitterText',
    'vintage':      'vintageLight',
    'floral':       'floralBanner',
    'gun':          'gunGamingLogo',
    'mountain':     'mountainLogoBw',
    'space':        'space3d',
    'letter':       'letterLogo',
    'stone':        'stone3d',
    'gradient3dlogo': 'gradientLogo3d',
    'textlogo':     'textLogoMaker',
    'metal3dlogo':  'metalLogo3d',
    'wolf':         'wolfGalaxy',
    'mascot':       'mascotAvatar',
    'icon':         'iconLogo',
    'metalglass':   'metallicGlass',
    'shirt':        'footballShirt',
    'polygon':      'polygonLogo',
    'pencil':       'pencilSketch',
    'woodlogo':     'woodText3d',
    'team':         'teamLogoBw',
};

// ─── $ephoto <style> <text> ───────────────────────────────────────────────────
async function ephotoCommand(sock, chatId, message) {
    const body = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const parts = body.split(/\s+/);

    if (parts.length < 3) {
        const styleList = Object.keys(SINGLE_STYLES).join(' · ');
        return sock.sendMessage(chatId, {
            text: `🎨 *EPHOTO TEXT EFFECTS*\n\n`
                + `Usage: *$ephoto <style> <text>*\n`
                + `Example: *$ephoto neon DARATECH*\n\n`
                + `*Available styles:*\n${styleList}\n\n`
                + `_For dual-text styles use $ephoto2_`,
        }, { quoted: message });
    }

    const style   = parts[1].toLowerCase();
    const text    = parts.slice(2).join(' ');
    const endpoint = SINGLE_STYLES[style];

    if (!endpoint) {
        const styleList = Object.keys(SINGLE_STYLES).join(' · ');
        return sock.sendMessage(chatId, {
            text: `❌ Unknown style *"${style}"*\n\n*Available styles:*\n${styleList}`,
        }, { quoted: message });
    }

    await react(sock, message, '⏳');
    try {
        const data = await ephotoGet(endpoint, { text });
        const imgUrl = data?.result?.image_url;
        if (!imgUrl) throw new Error(data?.error || 'No image returned');

        await sock.sendMessage(chatId, {
            image:   { url: imgUrl },
            caption: `🎨 *${style.toUpperCase()}* — ${text}\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ephoto]', endpoint, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Could not generate *${style}* effect. Try again!`,
        }, { quoted: message });
    }
}

// ─── $ephoto2 <style> <text1> | <text2> ──────────────────────────────────────
async function ephoto2Command(sock, chatId, message) {
    const body  = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
    const parts = body.split(/\s+/);

    if (parts.length < 3 || !body.includes('|')) {
        const styleList = Object.keys(DUAL_STYLES).join(' · ');
        return sock.sendMessage(chatId, {
            text: `🎨 *EPHOTO DUAL-TEXT EFFECTS*\n\n`
                + `Usage: *$ephoto2 <style> <text1> | <text2>*\n`
                + `Example: *$ephoto2 deadpool DARATECH | BOT*\n\n`
                + `*Available styles:*\n${styleList}`,
        }, { quoted: message });
    }

    const style    = parts[1].toLowerCase();
    const rest     = parts.slice(2).join(' ');
    const [t1, t2] = rest.split('|').map(s => s.trim());
    const endpoint  = DUAL_STYLES[style];

    if (!endpoint) {
        const styleList = Object.keys(DUAL_STYLES).join(' · ');
        return sock.sendMessage(chatId, {
            text: `❌ Unknown dual style *"${style}"*\n\n*Available styles:*\n${styleList}`,
        }, { quoted: message });
    }

    if (!t1 || !t2) {
        return sock.sendMessage(chatId, {
            text: `❌ Provide both texts separated by *|*\nExample: *$ephoto2 ${style} DARATECH | BOT*`,
        }, { quoted: message });
    }

    await react(sock, message, '⏳');
    try {
        const data = await ephotoGet(endpoint, { text1: t1, text2: t2 });
        const imgUrl = data?.result?.image_url;
        if (!imgUrl) throw new Error(data?.error || 'No image returned');

        await sock.sendMessage(chatId, {
            image:   { url: imgUrl },
            caption: `🎨 *${style.toUpperCase()}* — ${t1} | ${t2}\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ephoto2]', endpoint, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Could not generate *${style}* effect. Try again!`,
        }, { quoted: message });
    }
}

// ─── $ephotolist ──────────────────────────────────────────────────────────────
async function ephotolistCommand(sock, chatId, message) {
    const single = Object.keys(SINGLE_STYLES).join(' · ');
    const dual   = Object.keys(DUAL_STYLES).join(' · ');
    const text   = `🎨 *EPHOTO STYLE LIST*\n`
        + `${'─'.repeat(32)}\n\n`
        + `*Single-text ($ephoto <style> <text>):*\n${single}\n\n`
        + `*Dual-text ($ephoto2 <style> <t1> | <t2>):*\n${dual}\n\n`
        + `_Daratech_ ⚡`;
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = { ephotoCommand, ephoto2Command, ephotolistCommand };
