'use strict';
const axios = require('axios');
/**
 * commands/gifted-search.js — Gifted Search API commands
 * Base: https://api.gifted.co.ke/api/search/<endpoint>
 *
 * Confirmed working endpoints & params:
 *   google        → query            → results[]{title,link,description}
 *   googleimage   → query            → results[] (image URLs)
 *   tiktoksearch  → query            → results.{title,cover,...}
 *   chord         → query            → result.{url,artist,title,lyrics}
 *   hearthis      → query            → results[]{name,url,thumbnail,trackCount}
 *   npmsearch     → packagename      → result.{name,description,version,packageLink}
 *   spotifylyrics → query            → results[]{title,artist,thumbnail,url,lyricsUrl}
 *   happymod      → query            → results.data[]
 *   soundcloud    → query            → results[]{title,artist,url}
 *   wattpad       → query            → results[]{tittle,reads,likes,thumbnail,link}
 *   stickersearch → query            → results[] (sticker image URLs)
 *   lyrics        → query            → result.{artist,title,lyrics,image,link}
 *   bible         → verse            → result.{verse,data,translations}
 *   wallpaper     → query            → results[]{type,source,image[]}
 *   yts           → query            → results[]{videoId,url,title,description}
 *   define        → term             → results[]{definition,author}
 */

const { searchGet } = require('../lib/gifted');

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

// ─── $gsearch <query> — Google web search ────────────────────────────────────

async function gsearchCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🔍 Usage: $gsearch <search query>\nExample: $gsearch best phone 2025',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('google', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No results');
        const top = data.results.slice(0, 6);
        let txt = `🔍 *GOOGLE — "${q}"*\n\n`;
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.title}*\n`;
            if (r.description) txt += `   ${r.description.slice(0, 120)}${r.description.length > 120 ? '…' : ''}\n`;
            txt += `   🔗 ${r.link}\n\n`;
        });
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:google]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Google search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $gimage <query> — Google image search ────────────────────────────────────

async function gimageCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🖼️ Usage: $gimage <search query>\nExample: $gimage sunset Kenya',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('googleimage', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No images found');
        const imgUrl = data.results.find(u => typeof u === 'string' && u.startsWith('http'));
        if (!imgUrl) throw new Error('No valid image URL in results');
        const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption: `🖼️ *GOOGLE IMAGES — "${q}"*\n\n_${data.results.length} results found_\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:googleimage]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Image search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $ttsearch <query> — TikTok video search (downloads & sends actual video) ──

async function ttsearchCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🎵 Usage: $ttsearch <query>\nExample: $ttsearch funny cats',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('tiktoksearch', { query: q });
        if (!data?.success || !data?.results) throw new Error(data?.error || 'No results');
        const r = data.results;

        const title  = r.title || r.description || q;
        const author = r.author || r.username || '';
        const cover  = r.cover || r.thumbnail || r.image || '';
        // Try every common field name for the actual video URL
        const videoUrl = r.play || r.video || r.url || r.download || r.videoUrl || r.playUrl || '';

        let txt = `🎵 *TIKTOK — "${q}"*\n\n`;
        txt += `*${title}*\n`;
        if (author)       txt += `▸ 👤 *Author:* ${author}\n`;
        if (r.playCount)  txt += `▸ ▶️ *Plays:* ${Number(r.playCount).toLocaleString()}\n`;
        if (r.likeCount)  txt += `▸ ❤️ *Likes:* ${Number(r.likeCount).toLocaleString()}\n`;
        txt += `\n_Daratech_ ⚡`;

        if (videoUrl && videoUrl.startsWith('http')) {
            // Download and send as actual video
            const axios = require('axios');
            await sock.sendMessage(chatId, { text: '⬇️ _Downloading video…_' }, { quoted: message });
            const resp = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 45000 });
            const buf = Buffer.from(resp.data);
            if (buf.length < 5000) throw new Error('Video too small — may be a bad URL');
            await sock.sendMessage(chatId, {
                video: buf,
                mimetype: 'video/mp4',
                caption: txt,
                fileName: `ttsearch_${Date.now()}.mp4`,
            }, { quoted: message });
        } else if (cover && cover.startsWith('http')) {
            // Fallback: send thumbnail image with info
            await sock.sendMessage(chatId, { image: { url: cover }, caption: txt + '\n\n⚠️ _Video URL not available — showing thumbnail_' }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:tiktoksearch]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ TikTok search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $chord <song> — guitar chord search ─────────────────────────────────────

async function chordCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🎸 Usage: $chord <song name>\nExample: $chord Wonderwall Oasis',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('chord', { query: q });
        if (!data?.success || !data?.result) throw new Error(data?.error || 'No chord data found');
        const r = data.result;
        const body = (r.lyrics || '').slice(0, 3500);
        let txt = `🎸 *CHORDS — ${r.title || q}*\n`;
        if (r.artist) txt += `▸ 🎤 *Artist:* ${r.artist}\n`;
        if (r.url) txt += `▸ 🔗 ${r.url}\n`;
        txt += `${'─'.repeat(28)}\n\n`;
        txt += `${body}${(r.lyrics || '').length > 3500 ? '\n…(truncated)' : ''}\n\n`;
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:chord]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Chord lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $hearthis <query> — hearthis.at audio search ────────────────────────────

async function hearthisCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🎧 Usage: $hearthis <query>\nExample: $hearthis afrobeats mix',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('hearthis', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No results');
        const top = data.results.slice(0, 5);
        let txt = `🎧 *HEARTHIS — "${q}"*\n\n`;
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.name}*\n`;
            if (r.trackCount) txt += `   🎵 ${r.trackCount} track(s)\n`;
            if (r.url) txt += `   🔗 ${r.url}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        const thumb = top[0]?.thumbnail;
        if (thumb && thumb.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: thumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:hearthis]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Hearthis search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $npmpkg <package> — npm package info ────────────────────────────────────

async function npmpkgCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '📦 Usage: $npmpkg <package name>\nExample: $npmpkg axios',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('npmsearch', { packagename: q });
        if (!data?.success || !data?.result) throw new Error(data?.error || 'Package not found');
        const r = data.result;
        let txt =
            `📦 *NPM PACKAGE — ${r.name}*\n\n` +
            `▸ 📝 *Description:* ${r.description || 'N/A'}\n` +
            `▸ 🏷️ *Latest Version:* ${r.version || 'N/A'}\n` +
            `▸ 📅 *Published:* ${r.publishedDate || 'N/A'}\n` +
            `▸ 📅 *Created:* ${r.createdDate || 'N/A'}\n`;
        if (r.license) txt += `▸ 📜 *License:* ${r.license}\n`;
        if (r.homepage) txt += `▸ 🌐 *Homepage:* ${r.homepage}\n`;
        if (r.packageLink) txt += `▸ 🔗 *NPM:* ${r.packageLink}\n`;
        if (r.downloadLink) txt += `▸ 📥 *Download:* ${r.downloadLink}\n`;
        txt += `\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:npmsearch]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ NPM package lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $slyrics <query> — Spotify lyrics search ────────────────────────────────

async function slyricsCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🎵 Usage: $slyrics <song title>\nExample: $slyrics Blinding Lights',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('spotifylyrics', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'Song not found on Spotify');
        const top = data.results.slice(0, 5);
        let txt = `🎵 *SPOTIFY LYRICS SEARCH — "${q}"*\n\n`;
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.title}*\n`;
            if (r.artist) txt += `   🎤 ${r.artist}\n`;
            if (r.duration) txt += `   ⏱️ ${r.duration}\n`;
            if (r.url) txt += `   🔗 ${r.url}\n`;
            if (r.lyricsUrl) txt += `   📝 Lyrics: ${r.lyricsUrl}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        const thumb = top[0]?.thumbnail;
        if (thumb && thumb.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: thumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:spotifylyrics]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Spotify lyrics search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $happymod <query> — app / mod search ────────────────────────────────────

async function happymodCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '📱 Usage: $happymod <app name>\nExample: $happymod minecraft',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('happymod', { query: q });
        if (!data?.success) throw new Error(data?.error || 'Search failed');
        const items = data?.results?.data || [];
        if (!items.length) throw new Error('No apps found');
        const top = items.slice(0, 5);
        let txt = `📱 *APP SEARCH — "${q}"*\n`;
        if (data?.results?.source) txt += `_Source: ${data.results.source}_\n`;
        txt += '\n';
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.name}*\n`;
            if (r.summary) txt += `   ${r.summary.slice(0, 100)}\n`;
            if (r.url) txt += `   🔗 ${r.url}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:happymod]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ App search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $scsearch <query> — SoundCloud search ───────────────────────────────────

async function scsearchCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '☁️ Usage: $scsearch <query>\nExample: $scsearch lofi hip hop',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('soundcloud', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No results');
        const top = data.results.slice(0, 5);
        let txt = `☁️ *SOUNDCLOUD — "${q}"*\n\n`;
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.title || r.name}*\n`;
            if (r.artist) txt += `   🎤 ${r.artist}\n`;
            if (r.url) txt += `   🔗 ${r.url}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:soundcloud]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ SoundCloud search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $wattpad <query> — Wattpad story search ─────────────────────────────────

async function wattpadCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '📖 Usage: $wattpad <story/author>\nExample: $wattpad love story',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('wattpad', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No results');
        const top = data.results.slice(0, 5);
        let txt = `📖 *WATTPAD — "${q}"*\n\n`;
        top.forEach((r, i) => {
            txt += `*${i + 1}. ${r.tittle || r.title}*\n`;
            if (r.reads) txt += `   👁️ ${r.reads} reads\n`;
            if (r.likes) txt += `   ❤️ ${r.likes} likes\n`;
            if (r.link) txt += `   🔗 ${r.link}\n`;
            txt += '\n';
        });
        txt += `_Daratech_ ⚡`;
        const thumb = top[0]?.thumbnail;
        if (thumb && thumb.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: thumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:wattpad]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Wattpad search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── $stickersearch <query> — sticker image search ───────────────────────────

async function stickersearchCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🎭 Usage: $stickersearch <query>\nExample: $stickersearch happy cat',
    }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await searchGet('stickersearch', { query: q });
        if (!data?.success || !data?.results?.length) throw new Error(data?.error || 'No stickers found');
        const imgUrl = data.results.find(u => typeof u === 'string' && u.startsWith('http'));
        if (!imgUrl) throw new Error('No valid sticker URL');
        await sock.sendMessage(chatId, {
            image: { url: imgUrl },
            caption: `🎭 *STICKER SEARCH — "${q}"*\n\n_${data.results.length} stickers found_\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-search:stickersearch]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Sticker search failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = {
    gsearchCommand,
    gimageCommand,
    ttsearchCommand,
    chordCommand,
    hearthisCommand,
    npmpkgCommand,
    slyricsCommand,
    happymodCommand,
    scsearchCommand,
    wattpadCommand,
    stickersearchCommand,
};
