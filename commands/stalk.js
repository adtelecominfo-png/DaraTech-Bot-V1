'use strict';
const { davidGet } = require('../lib/gifted');

/** .ttstalk <username> — TikTok profile lookup */
async function ttstalkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🎵 Usage: .ttstalk <TikTok username>' }, { quoted: message });
    try {
        const data = await davidGet(`/tiktokStalk?q=${encodeURIComponent(q)}`);
        if (!data?.status || !data?.data) return sock.sendMessage(chatId, { text: '❌ TikTok profile not found.' }, { quoted: message });
        const u = data.data.user;
        const s = data.data.stats;
        const txt =
            `🎵 *TIKTOK — @${u.uniqueId}*\n\n` +
            `▸ 👤 *Name:* ${u.nickname}\n` +
            `▸ 👥 *Followers:* ${(s.followerCount||0).toLocaleString()}\n` +
            `▸ 🤝 *Following:* ${(s.followingCount||0).toLocaleString()}\n` +
            `▸ 💖 *Hearts:* ${(s.heartCount||0).toLocaleString()}\n` +
            `▸ 🎬 *Videos:* ${s.videoCount||0}\n\n` +
            `📝 *Bio:* ${u.signature || 'No bio set.'}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { image: { url: u.avatarLarger }, caption: txt }, { quoted: message });
    } catch (err) {
        console.error('[ttstalk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ TikTok stalk failed. Try again.' }, { quoted: message });
    }
}

/** .ghstalk <username> — GitHub profile lookup */
async function ghstalkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🐙 Usage: .ghstalk <GitHub username>' }, { quoted: message });
    try {
        const data = await davidGet(`/githubStalk?user=${encodeURIComponent(q)}`);
        if (!data?.username) return sock.sendMessage(chatId, { text: '❌ GitHub user not found.' }, { quoted: message });
        const txt =
            `🐙 *GITHUB — @${data.username}*\n\n` +
            `▸ 👤 *Name:* ${data.name || data.username}\n` +
            `▸ 📂 *Repos:* ${data.public_repositories}\n` +
            `▸ 👥 *Followers:* ${data.followers}\n` +
            `▸ 🤝 *Following:* ${data.following}\n` +
            `▸ 📅 *Joined:* ${(data.created_at || '').split('T')[0]}\n\n` +
            `📝 *Bio:* ${data.bio || 'No bio available.'}\n` +
            `🔗 ${data.url}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { image: { url: data.profile_pic }, caption: txt }, { quoted: message });
    } catch (err) {
        console.error('[ghstalk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ GitHub stalk failed. Try again.' }, { quoted: message });
    }
}

/** .igstalk <username> — Instagram profile lookup */
async function igstalkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '📸 Usage: .igstalk <Instagram username>' }, { quoted: message });
    try {
        const data = await davidGet(`/igstalk?username=${encodeURIComponent(q)}`);
        if (data?.usrname === 'No User Found' || !data?.usrname) {
            return sock.sendMessage(chatId, { text: '❌ Instagram user not found.' }, { quoted: message });
        }
        const txt =
            `📸 *INSTAGRAM — @${data.usrname}*\n\n` +
            `▸ 📮 *Posts:* ${data.status?.post || 0}\n` +
            `▸ 👥 *Followers:* ${data.status?.follower || 0}\n` +
            `▸ 🤝 *Following:* ${data.status?.following || 0}\n\n` +
            `📝 *Bio:* ${data.desk || 'No bio set.'}\n\n` +
            `_Daratech_ ⚡`;
        const pp = (data.pp || '').startsWith('http') ? data.pp : `https://apis.davidcyril.name.ng${data.pp}`;
        await sock.sendMessage(chatId, { image: { url: pp }, caption: txt }, { quoted: message });
    } catch (err) {
        console.error('[igstalk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Instagram stalk failed. Try again.' }, { quoted: message });
    }
}

/** .twstalk <username> — Twitter/X profile lookup */
async function twstalkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🐦 Usage: .twstalk <Twitter/X username>' }, { quoted: message });
    try {
        const data = await davidGet(`/stalk/twitter?username=${encodeURIComponent(q)}`);
        if (!data?.success) return sock.sendMessage(chatId, { text: '❌ Twitter/X profile not found.' }, { quoted: message });
        const txt =
            `🐦 *X / TWITTER — @${data.username}*\n\n` +
            `▸ 👤 *Name:* ${data.name}\n` +
            `▸ 👥 *Followers:* ${(data.followers||0).toLocaleString()}\n` +
            `▸ 🤝 *Following:* ${(data.following||0).toLocaleString()}\n` +
            `▸ 📮 *Tweets:* ${(data.tweets||0).toLocaleString()}\n` +
            `▸ 💖 *Likes:* ${(data.likes||0).toLocaleString()}\n\n` +
            `📝 *Bio:* ${data.bio || 'No bio available.'}\n` +
            `🔗 ${data.url || ''}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error('[twstalk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Twitter/X stalk failed. Try again.' }, { quoted: message });
    }
}

/** .steamstalk <username> — Steam profile lookup */
async function steamstalkCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🎮 Usage: .steamstalk <Steam username>' }, { quoted: message });
    try {
        const data = await davidGet(`/stalk/steam?username=${encodeURIComponent(q)}`);
        if (!data?.success) return sock.sendMessage(chatId, { text: '❌ Steam profile not found.' }, { quoted: message });
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
    } catch (err) {
        console.error('[steamstalk]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Steam stalk failed. Try again.' }, { quoted: message });
    }
}

module.exports = { ttstalkCommand, ghstalkCommand, igstalkCommand, twstalkCommand, steamstalkCommand };
