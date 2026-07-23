'use strict';
/**
 * sessionRegistry.js — shared in-process registry of all bot sessions.
 *
 * Each entry:
 *   id        — unique session ID (e.g. "versa", "kaevra")
 *   name      — display name shown in $bots and greetings
 *   sock      — live Baileys socket (null if offline)
 *   startTime — Date.now() when the session came online
 *   status    — 'online' | 'offline' | 'connecting'
 */

const sessions = new Map();

function setConnecting(id, name) {
    sessions.set(id, { name: name || id, sock: null, startTime: null, status: 'connecting' });
}

function register(id, { name, sock, startTime }) {
    sessions.set(id, { name: name || id, sock, startTime, status: 'online' });
}

function setOffline(id, name) {
    const existing = sessions.get(id);
    sessions.set(id, {
        name: name || existing?.name || id,
        sock: null,
        startTime: existing?.startTime || null,
        status: 'offline',
    });
}

function getAll() {
    return Array.from(sessions.entries()).map(([id, v]) => ({ id, ...v }));
}

function get(id) {
    return sessions.get(id);
}

module.exports = { setConnecting, register, setOffline, getAll, get, sessions };
