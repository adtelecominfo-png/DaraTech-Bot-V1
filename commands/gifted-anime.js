'use strict';
/**
 * commands/gifted-anime.js
 * New anime commands powered by https://api.gifted.co.ke/api/anime/
 *
 * Commands: .konachan  .kusonime <query>  .animenew
 */

const { animeGet } = require('../lib/gifted');

async function react(sock, message, emoji) {
    await sock.sendMessage(await sock.decodeJid(message.key.remoteJid), {
        react: { text: emoji, key: message.key },
    });
}

function getQ(message) {
    const body = message.message?.conversation
        || message.message?.extendedTextMessage?.text
        || '';
    return body.split(' ').slice(1).join(' ').trim();
}

// ─── .konachan ───────────────────────────────────────────────────────────────
/** Returns a random anime wallpaper image from Konachan */
async function konachanCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await animeGet('konachan');
        const url = data?.result;
        if (!url || typeof url !== 'string') throw new Error('No image returned');
        await sock.sendMessage(chatId, {
            image: { url },
            caption: `🖼️ *KONACHAN WALLPAPER*\n\n_Random anime wallpaper_ ✨\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-anime:konachan]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Konachan fetch failed. Try again!` }, { quoted: message });
    }
}

// ─── .kusonime ────────────────────────────────────────────────────────────────
/** Search KusoNime for anime downloads (.kusonime <query>) */
async function kusonimeCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: `🔍 Usage: *.kusonime <anime name>*\nExample: *.kusonime one piece*`,
    }, { quoted: message });

    await react(sock, message, '⏳');
    try {
        const data = await animeGet('kusonime-search', { query: q });
        const results = data?.result;
        if (!results?.length) throw new Error('No results found');

        const top = results.slice(0, 5);
        let text = `🎌 *KUSONIME SEARCH: "${q}"*\n`;
        text += `_${results.length} result(s) found — showing top ${top.length}_\n`;
        text += `${'─'.repeat(30)}\n\n`;

        top.forEach((r, i) => {
            text += `*${i + 1}. ${r.title}*\n`;
            if (r.genres?.length) text += `   🏷️ ${r.genres.slice(0, 3).join(', ')}\n`;
            if (r.url) text += `   🔗 ${r.url}\n`;
            text += '\n';
        });

        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-anime:kusonime]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: message });
    }
}

// ─── .animenew ───────────────────────────────────────────────────────────────
/** Latest anime releases from KusoNime */
async function animenewCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await animeGet('kusonime-info');
        const results = data?.result;
        if (!results?.length) throw new Error('No data returned');

        const top = results.slice(0, 8);
        let text = `🆕 *LATEST ANIME RELEASES*\n`;
        text += `${'─'.repeat(30)}\n\n`;

        top.forEach((r, i) => {
            text += `*${i + 1}. ${r.title}*\n`;
            if (r.genres?.length) text += `   🏷️ ${r.genres.slice(0, 3).join(', ')}\n`;
            if (r.releaseTime) text += `   ⏰ ${r.releaseTime}\n`;
            if (r.url) text += `   🔗 ${r.url}\n`;
            text += '\n';
        });

        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-anime:animenew]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Could not fetch latest releases. Try again!` }, { quoted: message });
    }
}

module.exports = { konachanCommand, kusonimeCommand, animenewCommand };
