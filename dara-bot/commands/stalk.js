'use strict';
/**
 * stalk.js — Social profile & data lookup commands
 *
 * All endpoints via https://api.gifted.co.ke/api/stalk/<endpoint>
 *
 * Confirmed endpoints:
 *   tiktokstalk  → result.{name, username, bio, followers, following, likes, videos, avatar}
 *   gitstalk     → result.{login, name, avatar_url, html_url, company, blog, location, bio, followers, following, public_repos}
 *   igstalk      → result.{...}
 *   twitterstalk → result.{username, displayName, profilePic, bio, location, followers, following, totalTweets}
 *   wachannel    → result.{title, followers, img, description}
 *   ipstalk      → result.{ip, country, city, region, asName, org, timezone, loc, countryCode}
 *   npmstalk     → result.{name, description, version, packageLink, owner, publishedDate, homepage, license}
 *
 * steamstalk kept via David Cyril API (no gifted endpoint available)
 */

const { stalkerGet, davidGet } = require('../lib/gifted');

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getQuery(message) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key },
        });
    } catch (_) {}
}

// ─── TikTok ───────────────────────────────────────────────────────────────────

/** $ttstalk / $tiktokstalk <username> — TikTok profile lookup */
async function ttstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '🎵 Usage: $ttstalk <TikTok username>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('tiktokstalk', { username: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Profile not found');
        const r = data.result;
        const txt =
            `🎵 *TIKTOK — @${r.username}*\n\n` +
            `▸ 👤 *Name:* ${r.name || '-'}\n` +
            `▸ 👥 *Followers:* ${(r.followers || 0).toLocaleString()}\n` +
            `▸ 🤝 *Following:* ${(r.following || 0).toLocaleString()}\n` +
            `▸ 💖 *Likes:* ${(r.likes || 0).toLocaleString()}\n` +
            `▸ 🎬 *Videos:* ${r.videos || 0}\n` +
            (r.website ? `▸ 🔗 *Website:* ${r.website}\n` : '') +
            (r.verified ? `▸ ✅ *Verified*\n` : '') +
            (r.private ? `▸ 🔒 *Private Account*\n` : '') +
            `\n📝 *Bio:* ${r.bio || 'No bio set.'}\n\n` +
            `_Daratech_ ⚡`;
        if (r.avatar) {
            await sock.sendMessage(chatId, { image: { url: r.avatar }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:tiktok]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ TikTok stalk failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── GitHub ───────────────────────────────────────────────────────────────────

/** $ghstalk / $gitstalk <username> — GitHub profile lookup */
async function ghstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '🐙 Usage: $ghstalk <GitHub username>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('gitstalk', { username: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'User not found');
        const r = data.result;
        const txt =
            `🐙 *GITHUB — @${r.login}*\n\n` +
            `▸ 👤 *Name:* ${r.name || r.login}\n` +
            (r.company ? `▸ 🏢 *Company:* ${r.company}\n` : '') +
            (r.location ? `▸ 📍 *Location:* ${r.location}\n` : '') +
            `▸ 📂 *Public Repos:* ${r.public_repos || 0}\n` +
            `▸ 👥 *Followers:* ${(r.followers || 0).toLocaleString()}\n` +
            `▸ 🤝 *Following:* ${(r.following || 0).toLocaleString()}\n` +
            (r.blog ? `▸ 🔗 *Website:* ${r.blog}\n` : '') +
            `▸ 🔗 *Profile:* ${r.html_url}\n` +
            (r.bio ? `\n📝 *Bio:* ${r.bio}\n` : '') +
            `\n_Daratech_ ⚡`;
        if (r.avatar_url) {
            await sock.sendMessage(chatId, { image: { url: r.avatar_url }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:github]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ GitHub stalk failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/** $igstalk / $instastalk <username> — Instagram profile lookup */
async function igstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '📸 Usage: $igstalk <Instagram username>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('igstalk', { username: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Profile not found or private');
        const r = data.result;
        const txt =
            `📸 *INSTAGRAM — @${r.username || q}*\n\n` +
            (r.name ? `▸ 👤 *Name:* ${r.name}\n` : '') +
            `▸ 📮 *Posts:* ${(r.posts ?? r.media_count ?? 0).toLocaleString()}\n` +
            `▸ 👥 *Followers:* ${(r.followers ?? r.follower_count ?? 0).toLocaleString()}\n` +
            `▸ 🤝 *Following:* ${(r.following ?? r.following_count ?? 0).toLocaleString()}\n` +
            (r.verified ? `▸ ✅ *Verified*\n` : '') +
            (r.private ? `▸ 🔒 *Private Account*\n` : '') +
            (r.bio || r.biography ? `\n📝 *Bio:* ${r.bio || r.biography}\n` : '') +
            `\n_Daratech_ ⚡`;
        const pic = r.profile_pic || r.avatar || r.pp;
        if (pic && pic.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: pic }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:instagram]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Instagram stalk failed. Profile may be private or not found.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Twitter / X ──────────────────────────────────────────────────────────────

/** $twstalk / $xstalk / $twitterstalk <username> — Twitter/X profile lookup */
async function twstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '🐦 Usage: $twstalk <Twitter/X username>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('twitterstalk', { username: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Profile not found');
        const r = data.result;
        const txt =
            `🐦 *X / TWITTER — @${r.username || q}*\n\n` +
            (r.displayName ? `▸ 👤 *Name:* ${r.displayName}\n` : '') +
            (r.location ? `▸ 📍 *Location:* ${r.location}\n` : '') +
            (r.followers != null ? `▸ 👥 *Followers:* ${(r.followers || 0).toLocaleString()}\n` : '') +
            (r.following != null ? `▸ 🤝 *Following:* ${(r.following || 0).toLocaleString()}\n` : '') +
            (r.totalTweets != null ? `▸ 📮 *Tweets:* ${(r.totalTweets || 0).toLocaleString()}\n` : '') +
            (r.joined ? `▸ 📅 *Joined:* ${r.joined}\n` : '') +
            (r.website ? `▸ 🔗 *Website:* ${r.website}\n` : '') +
            (r.bio ? `\n📝 *Bio:* ${r.bio}\n` : '') +
            `\n_Daratech_ ⚡`;
        if (r.profilePic && r.profilePic.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: r.profilePic }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:twitter]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Twitter/X stalk failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── WhatsApp Channel ─────────────────────────────────────────────────────────

/** $wachannel <url> — WhatsApp channel info lookup */
async function wachannelCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '💬 Usage: $wachannel <WhatsApp channel URL>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('wachannel', { url: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Channel not found');
        const r = data.result;
        const txt =
            `💬 *WHATSAPP CHANNEL*\n\n` +
            `▸ 📛 *Name:* ${r.title || '-'}\n` +
            `▸ 👥 *Followers:* ${r.followers || '-'}\n` +
            (r.description ? `\n📝 *Description:* ${r.description}\n` : '') +
            `\n_Daratech_ ⚡`;
        if (r.img && r.img.startsWith('http')) {
            await sock.sendMessage(chatId, { image: { url: r.img }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:wachannel]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ WhatsApp channel lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── IP Lookup ────────────────────────────────────────────────────────────────

/** $ipstalk / $iplookup <ip> — IP address geolocation & info */
async function ipstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '🌐 Usage: $ipstalk <IP address>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('ipstalk', { address: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'IP not found');
        const r = data.result;
        const txt =
            `🌐 *IP LOOKUP — ${r.ip}*\n\n` +
            `▸ 🌍 *Country:* ${r.country || '-'} (${r.countryCode || '-'})\n` +
            `▸ 🗺️ *Continent:* ${r.continent || '-'}\n` +
            `▸ 🏙️ *City:* ${r.city || '-'}\n` +
            `▸ 📍 *Region:* ${r.region || '-'}\n` +
            `▸ 📮 *Postal:* ${r.postal || '-'}\n` +
            `▸ 🏢 *ISP/Org:* ${r.asName || r.org || '-'}\n` +
            `▸ 🔢 *ASN:* ${r.asn || '-'}\n` +
            `▸ ⏰ *Timezone:* ${r.timezone || '-'}\n` +
            (r.loc ? `▸ 🗾 *Coords:* ${r.loc}\n` : '') +
            `\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:ip]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ IP lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── NPM Package ─────────────────────────────────────────────────────────────

/** $npmstalk / $npmlookup <package> — npm package info */
async function npmstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '📦 Usage: $npmstalk <package name>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await stalkerGet('npmstalk', { packagename: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Package not found');
        const r = data.result;
        const keywords = Array.isArray(r.keywords) ? r.keywords.slice(0, 6).join(', ') : '-';
        const txt =
            `📦 *NPM — ${r.name}*\n\n` +
            `▸ 🏷️ *Version:* ${r.version || '-'}\n` +
            `▸ 👤 *Owner:* ${r.owner || '-'}\n` +
            `▸ 📅 *Published:* ${r.publishedDate || '-'}\n` +
            `▸ 📜 *License:* ${r.license || '-'}\n` +
            (r.homepage ? `▸ 🔗 *Homepage:* ${r.homepage}\n` : '') +
            `▸ 🔗 *npm:* ${r.packageLink || '-'}\n` +
            (keywords !== '-' ? `▸ 🔖 *Keywords:* ${keywords}\n` : '') +
            (r.description ? `\n📝 *Description:* ${r.description}\n` : '') +
            `\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:npm]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ NPM lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Steam ────────────────────────────────────────────────────────────────────

/** $steamstalk <username> — Steam profile lookup (David Cyril API) */
async function steamstalkCommand(sock, chatId, message) {
    const q = getQuery(message);
    if (!q) return sock.sendMessage(chatId, { text: '🎮 Usage: $steamstalk <Steam username>' }, { quoted: message });
    await react(sock, message, '⏳');
    try {
        const data = await davidGet(`/stalk/steam?username=${encodeURIComponent(q)}`);
        if (!data?.success) throw new Error('Steam profile not found');
        const p = data.result || data.data || {};
        const txt =
            `🎮 *STEAM — ${p.personaname || q}*\n\n` +
            `▸ 👤 *Display Name:* ${p.personaname || '-'}\n` +
            `▸ 🌐 *Profile URL:* ${p.profileurl || '-'}\n` +
            `▸ 🎮 *Games Owned:* ${p.gamecount || '-'}\n` +
            `▸ 📅 *Member Since:* ${p.timecreated ? new Date(p.timecreated * 1000).toDateString() : '-'}\n` +
            `▸ 🟢 *Status:* ${['Offline','Online','Busy','Away','Snooze','Looking to Trade','Looking to Play'][p.personastate] || '-'}\n\n` +
            `_Daratech_ ⚡`;
        const avatar = p.avatarfull || p.avatarmedium;
        if (avatar) {
            await sock.sendMessage(chatId, { image: { url: avatar }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[stalk:steam]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Steam stalk failed. Try again.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = {
    ttstalkCommand,
    ghstalkCommand,
    igstalkCommand,
    twstalkCommand,
    wachannelCommand,
    ipstalkCommand,
    npmstalkCommand,
    steamstalkCommand,
};
