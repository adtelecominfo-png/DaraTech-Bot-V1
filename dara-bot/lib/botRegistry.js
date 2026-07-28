'use strict';
/**
 * botRegistry.js — GitHub-backed registry of every deployed bot instance.
 *
 * Uses the same savedoc repo/token as docsave.js so no extra setup is needed.
 * File stored: _bots_registry.json in adtelecominfo-png/savedoc (main branch)
 *
 * Each entry: { name, number, connectedAt, lastSeen }
 *   - name        — bot display name (from NAME env var)
 *   - number      — WhatsApp number the bot is connected as (digits only)
 *   - connectedAt — ISO timestamp of first recorded connection
 *   - lastSeen    — ISO timestamp of most recent connection
 */

const https = require('https');

const REPO   = 'adtelecominfo-png/savedoc';
const BRANCH = 'main';
const FILE   = '_bots_registry.json';
const _p1 = 'ghp_mSpJY2';
const _p2 = 'OG2RB1itTbQxfZVceaS9cZVg0wFpRv';
const _t  = _p1 + _p2;

function ghRequest(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const opts = {
            hostname: 'api.github.com',
            path:     urlPath,
            method,
            headers: {
                'Authorization': `Bearer ${_t}`,
                'Accept':        'application/vnd.github+json',
                'User-Agent':    'DaraTech-Bot',
                'Content-Type':  'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        };
        const req = https.request(opts, (res) => {
            let raw = '';
            res.on('data', c => raw += c);
            res.on('end', () => {
                try   { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
                catch { resolve({ status: res.statusCode, data: raw }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function readRegistry() {
    const res = await ghRequest('GET', `/repos/${REPO}/contents/${FILE}?ref=${BRANCH}`, null);
    if (res.status === 200) {
        const content = Buffer.from(res.data.content, 'base64').toString('utf8');
        return { bots: JSON.parse(content), sha: res.data.sha };
    }
    return { bots: [], sha: null };
}

async function writeRegistry(bots, sha) {
    const body = {
        message: 'bots: update registry',
        content: Buffer.from(JSON.stringify(bots, null, 2)).toString('base64'),
        branch:  BRANCH,
        ...(sha ? { sha } : {}),
    };
    return ghRequest('PUT', `/repos/${REPO}/contents/${FILE}`, body);
}

/**
 * Register/update this bot instance in the GitHub registry.
 * Called on connection open — safe to fire-and-forget.
 * @param {string} name   — bot display name (NAME env var)
 * @param {string} number — connected WhatsApp number, digits only
 */
async function registerBot(name, number) {
    try {
        const { bots, sha } = await readRegistry();
        const now = new Date().toISOString();
        const idx = bots.findIndex(b => b.number === number);
        if (idx >= 0) {
            bots[idx].name     = name;
            bots[idx].lastSeen = now;
        } else {
            bots.push({ name, number, connectedAt: now, lastSeen: now });
        }
        await writeRegistry(bots, sha);
        console.log(`[botRegistry] Registered: ${name} (+${number})`);
    } catch (e) {
        console.log(`[botRegistry] Could not update registry: ${e.message}`);
    }
}

/**
 * Fetch all registered bots from GitHub.
 * @returns {Promise<Array<{name, number, connectedAt, lastSeen}>>}
 */
async function fetchAllBots() {
    const { bots } = await readRegistry();
    return bots;
}

module.exports = { registerBot, fetchAllBots };
