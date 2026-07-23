'use strict';
/**
 * bots.js — $bots
 *
 * Shows all configured bot sessions with live status and uptime.
 * Owner-only.
 *
 * Usage: $bots
 */

const fs   = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const sessionRegistry = require('../lib/sessionRegistry');

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtUptime(ms) {
    if (!ms || ms <= 0) return '—';
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function loadConfiguredSessions() {
    const p = path.join(process.cwd(), 'data', 'sessions.json');
    try {
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf8')).sessions || [];
        }
    } catch { /* ignore */ }
    return [];
}

// ── Command ────────────────────────────────────────────────────────────────────

async function botsCommand(sock, chatId, senderId, message) {
    try {
        const isAuth = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
        if (!isAuth) {
            return sock.sendMessage(chatId,
                { text: '❌ *$bots* is owner-only.' },
                { quoted: message });
        }

        const configured = loadConfiguredSessions();
        const now = Date.now();
        const allIds = new Set(configured.map(s => s.id));

        // Also include any registry entries not in the config file (dynamically added)
        for (const { id } of sessionRegistry.getAll()) allIds.add(id);

        const entries = [];
        for (const id of allIds) {
            const cfg  = configured.find(s => s.id === id) || {};
            const live = sessionRegistry.get(id);
            const name   = live?.name || cfg.name || id;
            const status = live?.status || 'offline';
            const uptime = (status === 'online' && live?.startTime)
                ? fmtUptime(now - live.startTime)
                : null;
            entries.push({ name, status, uptime });
        }

        // Sort: online first, then alphabetically
        entries.sort((a, b) => {
            if (a.status === b.status) return a.name.localeCompare(b.name);
            return a.status === 'online' ? -1 : 1;
        });

        const onlineCount = entries.filter(e => e.status === 'online').length;
        const total       = entries.length;

        const lines = entries.map((e, i) => {
            const branch = i === entries.length - 1 ? '╰' : '├';
            const circle = e.status === 'online'
                ? '🟢'
                : e.status === 'connecting'
                    ? '🟡'
                    : '🔴';
            const detail = e.status === 'online' && e.uptime
                ? ` _(${e.uptime})_`
                : e.status === 'connecting'
                    ? ' _(connecting…)_'
                    : ' _(offline)_';
            return `${branch}◆ ${circle} *${e.name}*${detail}`;
        });

        const text = [
            `╭━━━「 🤖 *DEPLOYED ACCOUNTS* 」━━━`,
            ...lines,
            `┃`,
            `┃ Online: *${onlineCount}/${total}* account(s)`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            ``,
            `_Daratech_ ⚡`,
        ].join('\n');

        return sock.sendMessage(chatId, { text }, { quoted: message });

    } catch (err) {
        console.error('[bots] error:', err.message);
        return sock.sendMessage(chatId,
            { text: `❌ Failed to fetch session list: ${err.message}` },
            { quoted: message });
    }
}

module.exports = botsCommand;
