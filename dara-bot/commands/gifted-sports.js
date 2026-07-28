'use strict';
/**
 * commands/gifted-sports.js
 * Football & basketball commands powered by https://api.gifted.co.ke/api/
 *
 * Commands:
 *   $flivescore / $fls       — all live football matches
 *   $fnews / $footballnews   — football news
 *   $fleagues                — list available leagues
 *   $fstream                 — football streaming links
 *   $fplayer <name>          — search a football player
 *   $fteam <name>            — search a football team
 *   $fvenue <name>           — search a stadium / venue
 *   $eplstand                — EPL standings
 *   $eplmatches              — EPL match results
 *   $eplupcoming             — EPL upcoming fixtures
 *   $laligastand             — La Liga standings
 *   $laligamatches           — La Liga match results
 *   $laligaupcoming          — La Liga upcoming fixtures
 *   $bundesstand             — Bundesliga standings
 *   $blive / $bball          — basketball live scores
 */

const { sportsGet } = require('../lib/gifted');

async function react(sock, message, emoji) {
    await sock.sendMessage(message.key.remoteJid, {
        react: { text: emoji, key: message.key },
    });
}

function getQ(message) {
    const body = message.message?.conversation
        || message.message?.extendedTextMessage?.text || '';
    return body.split(' ').slice(1).join(' ').trim();
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtScore(m) {
    const home = m.homeScore ?? '-';
    const away = m.awayScore ?? '-';
    return `${m.homeTeam} *${home} - ${away}* ${m.awayTeam}`;
}

// ─── $flivescore / $fls ───────────────────────────────────────────────────────
async function flivescoreCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/livescore');
        const matches = data?.result?.matches;
        if (!matches?.length) throw new Error('No live matches right now');

        const top = matches.slice(0, 15);
        let text = `⚽ *FOOTBALL LIVE SCORES*\n`;
        text += `_${data.result.totalMatches} matches total — showing ${top.length}_\n`;
        text += `${'─'.repeat(32)}\n\n`;

        top.forEach(m => {
            text += `🏟️ ${m.league || 'Unknown League'}\n`;
            text += `   ${fmtScore(m)}\n`;
            if (m.status && m.status !== 'Unknown') text += `   ⏱ ${m.status}\n`;
            text += '\n';
        });

        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:flivescore]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: message });
    }
}

// ─── $fnews / $footballnews ───────────────────────────────────────────────────
async function fnewsCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/news');
        const items = data?.result?.items;
        if (!items?.length) throw new Error('No news available');

        let text = `📰 *FOOTBALL NEWS*\n${'─'.repeat(32)}\n\n`;
        items.slice(0, 8).forEach((n, i) => {
            text += `*${i + 1}. ${n.title}*\n`;
            if (n.summary) text += `   ${n.summary.slice(0, 100)}…\n`;
            text += '\n';
        });
        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fnews]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Could not fetch football news. Try again!` }, { quoted: message });
    }
}

// ─── $fleagues ────────────────────────────────────────────────────────────────
async function fleaguesCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/leagues');
        const leagues = data?.result;
        if (!leagues?.length) throw new Error('No leagues data');

        let text = `🏆 *AVAILABLE FOOTBALL LEAGUES*\n${'─'.repeat(32)}\n\n`;
        leagues.forEach(l => {
            text += `• *${l.name}* \`${l.id}\`\n`;
            if (l.endpoints?.length) text += `  📋 ${l.endpoints.join(' · ')}\n`;
            text += '\n';
        });
        text += `_Use $eplstand / $laligastand / $bundesstand for standings_\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fleagues]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Could not fetch leagues. Try again!` }, { quoted: message });
    }
}

// ─── $fstream ─────────────────────────────────────────────────────────────────
async function fstreamCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/streaming');
        const matches = data?.result?.matches;
        if (!matches?.length) throw new Error('No streams available right now');

        let text = `📡 *FOOTBALL LIVE STREAMS*\n`;
        text += `_${data.result.totalMatches} streams — showing top 10_\n`;
        text += `${'─'.repeat(32)}\n\n`;

        matches.slice(0, 10).forEach((m, i) => {
            text += `*${i + 1}. ${m.homeTeam} vs ${m.awayTeam}*\n`;
            if (m.homeScore !== undefined) text += `   📊 ${fmtScore(m)}\n`;
            if (m.homeLogo || m.streamUrl) {
                const link = m.streamUrl || m.link || m.url;
                if (link) text += `   🔗 ${link}\n`;
            }
            text += '\n';
        });

        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fstream]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ No streams available right now. Try again later!` }, { quoted: message });
    }
}

// ─── $fplayer <name> ──────────────────────────────────────────────────────────
async function fplayerCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: `⚽ Usage: *$fplayer <name>*\nExample: *$fplayer messi*`,
    }, { quoted: message });

    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/player-search', { q });
        const results = data?.result;
        if (!results?.length) throw new Error('No players found');

        const p = results[0];
        let text = `👤 *${p.name}*\n${'─'.repeat(32)}\n`;
        if (p.team)       text += `🏟️ Club: *${p.team}*\n`;
        if (p.sport)      text += `🏅 Sport: ${p.sport}\n`;
        if (p.nationality) text += `🌍 Country: ${p.nationality}\n`;
        if (p.position)   text += `📋 Position: ${p.position}\n`;
        if (p.dateOfBirth) text += `🎂 DOB: ${p.dateOfBirth}\n`;
        if (p.description) text += `\n📝 ${p.description.slice(0, 200)}…\n`;

        if (p.thumbnail) {
            await sock.sendMessage(chatId, {
                image: { url: p.thumbnail },
                caption: text + '\n_Daratech_ ⚡',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: text + '\n_Daratech_ ⚡' }, { quoted: message });
        }

        if (results.length > 1) {
            const others = results.slice(1, 4).map(r => `• ${r.name} (${r.team || '?'})`).join('\n');
            await sock.sendMessage(chatId, {
                text: `🔍 Other results:\n${others}`,
            }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fplayer]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ No player found for *${q}*` }, { quoted: message });
    }
}

// ─── $fteam <name> ────────────────────────────────────────────────────────────
async function fteamCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: `🏟️ Usage: *$fteam <name>*\nExample: *$fteam arsenal*`,
    }, { quoted: message });

    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/team-search', { q });
        const results = data?.result;
        if (!results?.length) throw new Error('No teams found');

        const t = results[0];
        let text = `🏟️ *${t.name}*\n${'─'.repeat(32)}\n`;
        if (t.alternateName)     text += `📛 Also known as: ${t.alternateName}\n`;
        if (t.shortName)         text += `🔤 Short: ${t.shortName}\n`;
        if (t.league)            text += `🏆 League: ${t.league}\n`;
        if (t.formedYear)        text += `📅 Founded: ${t.formedYear}\n`;
        if (t.location)          text += `📍 Location: ${t.location}\n`;
        if (t.stadium)           text += `🏟️ Stadium: ${t.stadium}\n`;
        if (t.stadiumCapacity)   text += `👥 Capacity: ${Number(t.stadiumCapacity).toLocaleString()}\n`;
        if (t.description)       text += `\n📝 ${t.description.slice(0, 200)}…\n`;

        const logo = t.teamBadge || t.badge || t.logo || t.thumbnail;
        if (logo) {
            await sock.sendMessage(chatId, {
                image: { url: logo },
                caption: text + '\n_Daratech_ ⚡',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: text + '\n_Daratech_ ⚡' }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fteam]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ No team found for *${q}*` }, { quoted: message });
    }
}

// ─── $fvenue <name> ───────────────────────────────────────────────────────────
async function fvenueCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: `🏟️ Usage: *$fvenue <stadium name>*\nExample: *$fvenue wembley*`,
    }, { quoted: message });

    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('football/venue-search', { q });
        const results = data?.result;
        if (!results?.length) throw new Error('No venues found');

        const v = results[0];
        let text = `🏟️ *${v.name || v.venue || q.toUpperCase()}*\n${'─'.repeat(32)}\n`;
        if (v.location)   text += `📍 Location: ${v.location}\n`;
        if (v.capacity)   text += `👥 Capacity: ${Number(v.capacity).toLocaleString()}\n`;
        if (v.surface)    text += `🌱 Surface: ${v.surface}\n`;
        if (v.teams)      text += `🏆 Home teams: ${Array.isArray(v.teams) ? v.teams.join(', ') : v.teams}\n`;

        const img = v.image || v.thumbnail || v.photo;
        if (img) {
            await sock.sendMessage(chatId, {
                image: { url: img },
                caption: text + '\n_Daratech_ ⚡',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: text + '\n_Daratech_ ⚡' }, { quoted: message });
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:fvenue]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ No venue found for *${q}*` }, { quoted: message });
    }
}

// ─── league standings/matches/upcoming factory ───────────────────────────────
function leagueStandingsCommand(leagueId, leagueName) {
    return async function (sock, chatId, message) {
        await react(sock, message, '⏳');
        try {
            const data = await sportsGet(`football/${leagueId}/standings`);
            const rows = data?.result?.standings;
            if (!rows?.length) throw new Error('No standings data');

            let text = `🏆 *${leagueName.toUpperCase()} STANDINGS*\n`;
            text += `${'─'.repeat(36)}\n`;
            text += `${'#'.padEnd(3)} ${'Team'.padEnd(22)} ${'P'.padEnd(3)} ${'W'.padEnd(3)} ${'D'.padEnd(3)} ${'L'.padEnd(3)} ${'Pts'}\n`;
            text += `${'─'.repeat(36)}\n`;
            rows.slice(0, 20).forEach(r => {
                const pos  = String(r.position).padEnd(3);
                const team = (r.team || '').slice(0, 20).padEnd(22);
                const p    = String(r.played ?? 0).padEnd(3);
                const w    = String(r.won ?? 0).padEnd(3);
                const d    = String(r.draw ?? 0).padEnd(3);
                const l    = String(r.lost ?? 0).padEnd(3);
                const pts  = String(r.points ?? 0);
                text += `${pos} ${team} ${p} ${w} ${d} ${l} ${pts}\n`;
            });
            text += `\n_Daratech_ ⚡`;
            await sock.sendMessage(chatId, { text }, { quoted: message });
            await react(sock, message, '✅');
        } catch (err) {
            console.error(`[gifted-sports:${leagueId}/standings]`, err.message);
            await react(sock, message, '❌');
            await sock.sendMessage(chatId, { text: `❌ Could not fetch ${leagueName} standings.` }, { quoted: message });
        }
    };
}

function leagueMatchesCommand(leagueId, leagueName, sub = 'matches') {
    return async function (sock, chatId, message) {
        await react(sock, message, '⏳');
        try {
            const data = await sportsGet(`football/${leagueId}/${sub}`);
            const res  = data?.result;
            const key  = sub === 'upcoming' ? 'upcomingMatches' : 'matches';
            const list = res?.[key];
            if (!list?.length) throw new Error('No fixtures data');

            const label = sub === 'upcoming' ? 'UPCOMING FIXTURES' : 'MATCH RESULTS';
            let text = `📅 *${leagueName.toUpperCase()} ${label}*\n${'─'.repeat(32)}\n\n`;
            list.slice(0, 12).forEach((m, i) => {
                text += `*${i + 1}. ${m.homeTeam} vs ${m.awayTeam}*\n`;
                if (m.date)      text += `   📅 ${m.date}\n`;
                if (m.score && m.score !== '- - -') text += `   📊 ${m.score}\n`;
                if (m.status)    text += `   ⏱ ${m.status}\n`;
                if (m.matchday)  text += `   📋 Matchday ${m.matchday}\n`;
                text += '\n';
            });
            text += `_Daratech_ ⚡`;
            await sock.sendMessage(chatId, { text }, { quoted: message });
            await react(sock, message, '✅');
        } catch (err) {
            console.error(`[gifted-sports:${leagueId}/${sub}]`, err.message);
            await react(sock, message, '❌');
            await sock.sendMessage(chatId, { text: `❌ Could not fetch ${leagueName} ${sub}.` }, { quoted: message });
        }
    };
}

// ─── basketball live ──────────────────────────────────────────────────────────
async function bliveCommand(sock, chatId, message) {
    await react(sock, message, '⏳');
    try {
        const data = await sportsGet('basketball/livescore');
        const matches = data?.result?.matches;
        if (!matches?.length) throw new Error('No live basketball games right now');

        let text = `🏀 *BASKETBALL LIVE SCORES*\n${'─'.repeat(32)}\n\n`;
        matches.slice(0, 10).forEach(m => {
            text += `🏀 ${fmtScore(m)}\n`;
            if (m.league) text += `   🏆 ${m.league}\n`;
            text += '\n';
        });
        text += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-sports:blive]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ ${err.message}` }, { quoted: message });
    }
}

// ─── instantiate league commands ──────────────────────────────────────────────
const eplStandCommand     = leagueStandingsCommand('epl',        'Premier League');
const eplMatchesCommand   = leagueMatchesCommand('epl',          'Premier League', 'matches');
const eplUpcomingCommand  = leagueMatchesCommand('epl',          'Premier League', 'upcoming');
const laligaStandCommand  = leagueStandingsCommand('laliga',     'La Liga');
const laligaMatchCommand  = leagueMatchesCommand('laliga',       'La Liga', 'matches');
const laligaUpCommand     = leagueMatchesCommand('laliga',       'La Liga', 'upcoming');
const bundesStandCommand  = leagueStandingsCommand('bundesliga', 'Bundesliga');

module.exports = {
    flivescoreCommand,
    fnewsCommand,
    fleaguesCommand,
    fstreamCommand,
    fplayerCommand,
    fteamCommand,
    fvenueCommand,
    bliveCommand,
    eplStandCommand,
    eplMatchesCommand,
    eplUpcomingCommand,
    laligaStandCommand,
    laligaMatchCommand,
    laligaUpCommand,
    bundesStandCommand,
};
