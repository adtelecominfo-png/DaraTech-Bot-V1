'use strict';
const { davidGet } = require('../lib/gifted');

/** $sports / $scoreboard / $livescores — live game scores */
async function sportsCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, {
            text: `📡 *LIVE SCORES* · Daratech\n\n⏳ Fetching live games...`,
        }, { quoted: message });
        const data = await davidGet('/sports/live');
        if (!data?.success) return sock.sendMessage(chatId, { text: '❌ Failed to fetch live sports data.' }, { quoted: message });

        let txt = `🏟️ *LIVE SCOREBOARD*\n\n`;

        if (data.soccer?.games?.length) {
            txt += `⚽ *SOCCER — ${data.soccer.league || 'Football'}*\n`;
            data.soccer.games.forEach(g => {
                txt += `▸ ${g.shortName}: *${g.homeTeam?.score || 0} - ${g.awayTeam?.score || 0}* (${g.status || '-'})\n`;
            });
            txt += '\n';
        }
        if (data.nba?.games?.length) {
            txt += `🏀 *NBA BASKETBALL*\n`;
            data.nba.games.forEach(g => {
                txt += `▸ ${g.shortName}: *${g.homeTeam?.score || 0} - ${g.awayTeam?.score || 0}* (${g.status || '-'})\n`;
            });
            txt += '\n';
        }
        if (data.nfl?.games?.length) {
            txt += `🏈 *NFL FOOTBALL*\n`;
            data.nfl.games.forEach(g => {
                txt += `▸ ${g.shortName}: *${g.homeTeam?.score || 0} - ${g.awayTeam?.score || 0}* (${g.status || '-'})\n`;
            });
        }
        if (txt === `🏟️ *LIVE SCOREBOARD*\n\n`) {
            txt += '📭 No live games right now. Check back later!';
        }
        txt += `\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error('[sports]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Could not fetch live scores. Try again.' }, { quoted: message });
    }
}

/** $sportsteam <name> — search a sports team */
async function sportsTeamCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🏆 Usage: $sportsteam <team name>\nExample: $sportsteam Lakers' }, { quoted: message });
    try {
        const data = await davidGet(`/sports/team?q=${encodeURIComponent(q)}`);
        if (!data?.success) return sock.sendMessage(chatId, { text: `❌ Team "${q}" not found.` }, { quoted: message });
        const t = data.team || data.result || {};
        let txt =
            `🏆 *TEAM INFO*\n\n` +
            `▸ 🏟️ *Name:* ${t.displayName || t.name || q}\n` +
            `▸ 🏙️ *Location:* ${t.location || '-'}\n` +
            `▸ 🏅 *League:* ${t.league || t.sport || '-'}\n` +
            `▸ 🎨 *Colors:* ${(t.color ? '#' + t.color : '-')}\n` +
            `\n_Daratech_ ⚡`;
        const logo = t.logo || t.logos?.[0]?.href;
        if (logo) {
            await sock.sendMessage(chatId, { image: { url: logo }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[sportsteam]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch team info for "${q}".` }, { quoted: message });
    }
}

/** $sportsplayer <name> — search a sports player */
async function sportsPlayerCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const q = text.split(' ').slice(1).join(' ').trim();
    if (!q) return sock.sendMessage(chatId, { text: '🏅 Usage: $sportsplayer <player name>\nExample: $sportsplayer LeBron James' }, { quoted: message });
    try {
        const data = await davidGet(`/sports/player?q=${encodeURIComponent(q)}`);
        if (!data?.success) return sock.sendMessage(chatId, { text: `❌ Player "${q}" not found.` }, { quoted: message });
        const p = data.player || data.result || {};
        let txt =
            `🏅 *PLAYER INFO*\n\n` +
            `▸ 👤 *Name:* ${p.displayName || p.fullName || q}\n` +
            `▸ 🎽 *Team:* ${p.team?.displayName || p.team || '-'}\n` +
            `▸ 🏆 *Sport:* ${p.sport || '-'}\n` +
            `▸ 📍 *Position:* ${p.position?.displayName || p.position || '-'}\n` +
            `▸ 🎂 *DOB:* ${p.dateOfBirth || p.dob || '-'}\n` +
            `▸ 🌎 *Nationality:* ${p.citizenship || p.nationality || '-'}\n` +
            `\n_Daratech_ ⚡`;
        const headshot = p.headshot?.href || p.image;
        if (headshot) {
            await sock.sendMessage(chatId, { image: { url: headshot }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch (err) {
        console.error('[sportsplayer]', err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch player info for "${q}".` }, { quoted: message });
    }
}

/** $nbastandings / $nflstandings / $soccerstandings — league standings */
async function standingsCommand(sock, chatId, message, league) {
    const endpointMap = { nba: '/sports/nba/standings', nfl: '/sports/nfl/standings', soccer: '/sports/soccer/standings' };
    const emojiMap = { nba: '🏀', nfl: '🏈', soccer: '⚽' };
    const endpoint = endpointMap[league];
    const emoji = emojiMap[league];
    try {
        await sock.sendMessage(chatId, { text: `${emoji} Fetching ${league.toUpperCase()} standings...` }, { quoted: message });
        const data = await davidGet(endpoint);
        if (!data?.success) return sock.sendMessage(chatId, { text: `❌ Could not fetch ${league.toUpperCase()} standings.` }, { quoted: message });

        const standings = data.standings || data.result || [];
        let txt = `╭━═『 ${emoji} *${league.toUpperCase()} STANDINGS* 』═━╮\n\n`;
        standings.slice(0, 15).forEach((team, i) => {
            const w = team.wins || team.w || 0;
            const l = team.losses || team.l || 0;
            txt += `*${i + 1}.* ${team.team || team.name || team.displayName || '-'} — ${w}W / ${l}L\n`;
        });
        if (!standings.length) txt += '📭 No standings data available right now.\n';
        txt += `\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch (err) {
        console.error(`[${league}standings]`, err.message);
        await sock.sendMessage(chatId, { text: `❌ Failed to fetch ${league.toUpperCase()} standings.` }, { quoted: message });
    }
}

module.exports = { sportsCommand, sportsTeamCommand, sportsPlayerCommand, standingsCommand };
