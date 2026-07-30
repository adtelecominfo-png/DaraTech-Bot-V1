/**
 * Auto-Update Scheduler for Daratech Bot
 *
 * - On startup: schedules a periodic check (default every 39 seconds)
 * - On each check: git fetch → compare local vs remote HEAD → if different, pull + npm install + restart
 * - Owner is notified on WhatsApp before and after update
 * - Repo URL is hardcoded — no remote config needed
 * - Socket reference is refreshed on every start() call so reconnects never use stale sockets
 *
 * Commands (owner-only):
 *   $autoupdate                  — show status
 *   $autoupdate on/off           — enable/disable
 *   $autoupdate check            — manual check now
 *   $autoupdate interval <n><unit> — set interval (e.g. 30m, 2h, 90s)
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('./isOwner');

const STATE_FILE = path.join(__dirname, '..', 'data', 'autoupdate.json');

// ─── Hardcoded repo ────────────────────────────────────────────────────────────
const REPO_URL    = 'https://github.com/adtelecominfo-png/DaraTech-Bot-V1.git';
const REPO_BRANCH = 'main';

// ─── Shell helper ─────────────────────────────────────────────────────────────
function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString().trim()));
            resolve((stdout || '').toString().trim());
        });
    });
}

// ─── State ────────────────────────────────────────────────────────────────────
// interval is stored in SECONDS internally; default 39s
function readState() {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
    catch { return { enabled: true, intervalSec: 39 }; }
}

function writeState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Interval helpers ─────────────────────────────────────────────────────────
/**
 * Parse a user-supplied interval string into seconds.
 * Accepts: "30s", "30sec", "30m", "30min", "2h", "2hr", bare number = minutes
 * Returns null if invalid.
 */
function parseInterval(raw) {
    const s = raw.toString().trim().toLowerCase();
    const match = s.match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr)?$/);
    if (!match) return null;
    const val = parseFloat(match[1]);
    const unit = match[2] || 'm'; // bare number → minutes
    if (unit === 's' || unit === 'sec') return val;
    if (unit === 'm' || unit === 'min') return val * 60;
    if (unit === 'h' || unit === 'hr')  return val * 3600;
    return null;
}

function formatInterval(sec) {
    if (sec < 60)   return `${sec}s`;
    if (sec < 3600) return `${sec / 60}m`;
    return `${sec / 3600}h`;
}

// ─── Env + session snapshot/restore ───────────────────────────────────────────
// Snapshot $env and session/creds.json in memory before git wipes anything,
// then write them back immediately after — survives hard resets on any host.

// Snapshot ALL files in data/ dynamically — no hardcoded list needed.
// This ensures every anti command, toggle, and config file survives git reset.

function snapshotEnvAndSession() {
    const snap = { env: null, creds: null, data: {}, savedocs: {} };
    const envPath   = path.join(process.cwd(), '.env');
    const credsPath = path.join(process.cwd(), 'session', 'creds.json');
    const dataDir   = path.join(process.cwd(), 'data');
    try { if (fs.existsSync(envPath))   snap.env   = fs.readFileSync(envPath,   'utf8'); } catch {}
    try { if (fs.existsSync(credsPath)) snap.creds = fs.readFileSync(credsPath, 'utf8'); } catch {}
    // Snapshot every file directly inside data/ (not subdirs — those handled below)
    try {
        if (fs.existsSync(dataDir)) {
            for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
                if (!entry.isFile()) continue;
                try {
                    snap.data[entry.name] = fs.readFileSync(path.join(dataDir, entry.name), 'utf8');
                } catch {}
            }
        }
    } catch {}
    // Snapshot all savedoc files
    const savedocsDir = path.join(dataDir, 'savedocs');
    try {
        if (fs.existsSync(savedocsDir)) {
            for (const file of fs.readdirSync(savedocsDir)) {
                try { snap.savedocs[file] = fs.readFileSync(path.join(savedocsDir, file), 'utf8'); } catch {}
            }
        }
    } catch {}
    return snap;
}

/**
 * Deep-merge two parsed JSON values for the restore step.
 *
 * Rules (base = post-git-reset on-disk version, overlay = snapshotted runtime version):
 *   - Objects  → start from base (has any new keys git just added), then
 *                recursively overlay runtime values on top so user data wins.
 *   - Arrays   → union of both sides, deduplicated by strict equality,
 *                snapshot entries first (preserves order of runtime additions).
 *   - Primitives / mismatched types → snapshot (overlay) always wins.
 *
 * This means:
 *   • New keys a git commit adds to a data file are kept even after restore.
 *   • Runtime changes ($sudo add, toggle commands, etc.) are never lost.
 */
function _deepMerge(base, overlay) {
    if (Array.isArray(overlay) && Array.isArray(base)) {
        // Union: snapshot entries first, then any extras from base not already present
        const seen = new Set(overlay.map(v => JSON.stringify(v)));
        const extras = base.filter(v => !seen.has(JSON.stringify(v)));
        return [...overlay, ...extras];
    }
    if (
        overlay !== null && base !== null &&
        typeof overlay === 'object' && typeof base === 'object' &&
        !Array.isArray(overlay) && !Array.isArray(base)
    ) {
        const result = { ...base }; // start with git version (new keys land here)
        for (const [k, v] of Object.entries(overlay)) {
            if (k in result && result[k] !== null && v !== null &&
                typeof result[k] === 'object' && typeof v === 'object') {
                result[k] = _deepMerge(result[k], v); // recurse
            } else {
                result[k] = v; // snapshot value wins for existing keys
            }
        }
        return result;
    }
    // Primitive, or type mismatch: snapshot wins
    return overlay !== undefined ? overlay : base;
}

function restoreEnvAndSession(snap) {
    const envPath    = path.join(process.cwd(), '.env');
    const sessionDir = path.join(process.cwd(), 'session');
    const credsPath  = path.join(sessionDir, 'creds.json');
    const dataDir    = path.join(process.cwd(), 'data');
    try {
        if (snap.env !== null) {
            fs.writeFileSync(envPath, snap.env, 'utf8');
            console.log('[AutoUpdate] $env restored ✅');
        }
    } catch (e) { console.error('[AutoUpdate] Failed to restore .env:', e.message); }
    try {
        if (snap.creds !== null) {
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(credsPath, snap.creds, 'utf8');
            console.log('[AutoUpdate] session/creds.json restored ✅');
        }
    } catch (e) { console.error('[AutoUpdate] Failed to restore session:', e.message); }
    if (!fs.existsSync(dataDir)) {
        try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    }
    for (const [file, content] of Object.entries(snap.data || {})) {
        try {
            const destPath = path.join(dataDir, file);
            let finalContent = content;
            // For JSON files: merge git on-disk version with snapshot so that
            // new keys from a git commit are kept AND runtime changes survive.
            if (file.endsWith('.json')) {
                try {
                    const snapParsed = JSON.parse(content);
                    if (fs.existsSync(destPath)) {
                        const diskParsed = JSON.parse(fs.readFileSync(destPath, 'utf8'));
                        const merged = _deepMerge(diskParsed, snapParsed);
                        finalContent = JSON.stringify(merged, null, 2);
                    }
                } catch { /* not valid JSON — fall back to raw snapshot content */ }
            }
            fs.writeFileSync(destPath, finalContent, 'utf8');
            console.log(`[AutoUpdate] data/${file} restored ✅`);
        } catch (e) { console.error(`[AutoUpdate] Failed to restore data/${file}:`, e.message); }
    }
    // Restore savedoc files
    const savedocsEntries = Object.entries(snap.savedocs || {});
    if (savedocsEntries.length) {
        const savedocsDir = path.join(dataDir, 'savedocs');
        try { if (!fs.existsSync(savedocsDir)) fs.mkdirSync(savedocsDir, { recursive: true }); } catch {}
        for (const [file, content] of savedocsEntries) {
            try {
                fs.writeFileSync(path.join(savedocsDir, file), content, 'utf8');
                console.log(`[AutoUpdate] data/savedocs/${file} restored ✅`);
            } catch (e) { console.error(`[AutoUpdate] Failed to restore data/savedocs/${file}:`, e.message); }
        }
    }
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Ensure the bot directory has a git repo pointing at the correct remote.
 * If the bot was installed via ZIP (no $git folder), we initialise one here
 * so auto-update can work without the user needing to clone manually.
 * Returns true if git is ready, false if git isn't installed at all.
 */
async function ensureGitRepo() {
    // Check git is installed
    try { await run('git --version'); } catch { return false; }

    const gitDir = path.join(process.cwd(), '.git');
    if (!fs.existsSync(gitDir)) {
        console.log('[AutoUpdate] No .git found — initialising repo for auto-update...');
        await run('git init');
        await run(`git remote add origin ${REPO_URL}`);
        // Fetch and reset local HEAD to match remote — this ensures the first
        // comparison (local vs remote) sees no diff, so no false-positive update.
        await run(`git fetch ${REPO_URL} ${REPO_BRANCH} --quiet`);
        const snap0 = snapshotEnvAndSession();
        await run('git reset --hard FETCH_HEAD');
        restoreEnvAndSession(snap0);
        console.log('[AutoUpdate] Git repo initialised — local HEAD synced to remote.');
    } else {
        // Make sure the remote URL is correct (in case it drifted)
        try {
            const currentRemote = await run('git remote get-url origin').catch(() => '');
            if (!currentRemote.includes('DaraTech-Bot-V1')) {
                await run(`git remote set-url origin ${REPO_URL}`);
            }
        } catch { /* ignore */ }
    }

    return true;
}

async function getCurrentRev() {
    try { return await run('git rev-parse HEAD'); } catch { return null; }
}

async function fetchUpdates() {
    await run(`git fetch ${REPO_URL} ${REPO_BRANCH} --quiet`);
}

async function getRemoteRev() {
    try { return await run('git rev-parse FETCH_HEAD'); } catch { return null; }
}

async function applyGitUpdate(oldRev, newRev) {
    // Snapshot before git touches anything
    const snap = snapshotEnvAndSession();

    await run('git reset --hard FETCH_HEAD');
    await run('git clean -fd --exclude=package-lock.json --exclude=node_modules --exclude=data');

    // Restore $env and session immediately — before npm install or restart
    restoreEnvAndSession(snap);

    // Only run npm install if package.json actually changed (same logic as .update)
    try {
        if (oldRev && newRev && oldRev !== newRev) {
            const diff = await run(`git diff --name-only ${oldRev} ${newRev} -- package.json`);
            if (diff.length > 0) {
                console.log('[AutoUpdate] package.json changed — running npm install');
                await run('npm install --no-audit --no-fund --prefer-offline');
            } else {
                console.log('[AutoUpdate] package.json unchanged — skipping npm install');
            }
        } else {
            // Fallback: revs unknown, run install to be safe
            await run('npm install --no-audit --no-fund --prefer-offline');
        }
    } catch { /* non-fatal — bot still restarts with existing modules */ }
}

// ─── Runtime state (never stale after reconnect) ──────────────────────────────
let _sock = null;
let _ownerJid = null;
let _timer = null;
let _running = false; // true while a check/update is in progress

function getOwnerJid() {
    // Priority: per-session _ownerNumber → OWNER_NUMBER env → connected bot's own number
    if (_sock?._ownerNumber) {
        const n = _sock._ownerNumber.toString().replace(/\D/g, '');
        if (n) return `${n}@s.whatsapp.net`;
    }
    const envNum = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
    if (envNum) return `${envNum}@s.whatsapp.net`;
    if (_sock?.user?.id) {
        const n = _sock.user.id.split(':')[0].split('@')[0];
        if (n) return `${n}@s.whatsapp.net`;
    }
    return null;
}

async function notifyOwner(text) {
    if (!_sock || !_ownerJid) return;
    try { await _sock.sendMessage(_ownerJid, { text }); } catch { /* ignore */ }
}

// ─── File safety check ────────────────────────────────────────────────────────
// Verify the pulled files look like a real bot before restarting.
const REQUIRED_FILES = [
    'index.js',
    'main.js',
    'settings.js',
    'package.json',
    'commands',
    'lib',
];

function botFilesLookCorrect() {
    const root = process.cwd();
    for (const f of REQUIRED_FILES) {
        if (!fs.existsSync(path.join(root, f))) {
            console.error(`[AutoUpdate] Safety check failed — missing: ${f}`);
            return false;
        }
    }
    // package.json must be valid JSON with a "name" field
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        if (!pkg.name) throw new Error('missing name');
    } catch (e) {
        console.error('[AutoUpdate] Safety check failed — bad package.json:', e.message);
        return false;
    }
    return true;
}

// ─── Core check logic ─────────────────────────────────────────────────────────
async function runCheck() {
    if (_running) return; // prevent overlap
    _running = true;

    try {
        const state = readState();
        if (!state.enabled) return;

        if (!await ensureGitRepo()) {
            console.log('[AutoUpdate] git not installed — skipping check.');
            return;
        }

        console.log(`[AutoUpdate] Fetching ${REPO_URL}...`);
        await fetchUpdates();

        const local  = await getCurrentRev();
        const remote = await getRemoteRev();

        if (!local || !remote) return;

        if (local === remote) {
            console.log('[AutoUpdate] Already up to date.');
            return;
        }

        // ── Update available — apply automatically ────────────────────────────
        console.log('[AutoUpdate] New update found — applying automatically.');

        await notifyOwner(`🔄 *Auto-Update Started*\n\n📦 New update found on \`${REPO_BRANCH}\`.\nApplying now — bot will restart in a moment…`);

        try {
            await applyGitUpdate(local, remote);
        } catch (err) {
            console.error('[AutoUpdate] Failed to apply update:', err.message);
            await notifyOwner(`❌ *Auto-Update Failed*\n\n${err.message}\n\nRun *$update* manually to try again.`);
            return;
        }

        // Write flag so reconnect sends a clean "update done" message to owner
        try {
            const flagDir  = path.join(__dirname, '..', 'data');
            const flagPath = path.join(flagDir, 'update_done.json');
            if (!fs.existsSync(flagDir)) fs.mkdirSync(flagDir, { recursive: true });
            fs.writeFileSync(flagPath, JSON.stringify({ chatId: _ownerJid, ts: Date.now() }));
        } catch { /* non-fatal */ }

        console.log('[AutoUpdate] Restarting...');
        try { await run('pm2 restart all'); return; } catch {}
        setTimeout(() => process.exit(0), 800);

    } catch (err) {
        console.error('[AutoUpdate] Error during check:', err.message);
    } finally {
        _running = false;
    }
}

// ─── Scheduler ────────────────────────────────────────────────────────────────
function scheduleNext() {
    const state = readState();
    if (!state.enabled) return;
    const sec = Math.max(39, state.intervalSec || 39); // minimum 39s
    const ms  = sec * 1000;
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(async () => { await runCheck(); scheduleNext(); }, ms);
    console.log(`[AutoUpdate] Next check in ${formatInterval(sec)}`);
}

/**
 * Start (or refresh) the auto-update scheduler.
 * Always forces enabled=true on boot — auto-update cannot be permanently disabled.
 * Safe to call multiple times; always refreshes the socket so reconnects work.
 */
function start(sock) {
    _sock = sock;
    _ownerJid = getOwnerJid();

    const state = readState();
    if (!state.enabled) {
        state.enabled = true;
        writeState(state);
        console.log('[AutoUpdate] Was disabled — forcing enabled on startup.');
    }

    if (_timer) return; // already scheduled; socket updated above — done
    console.log(`[AutoUpdate] Started (always-on). Checking immediately, then every ${formatInterval(state.intervalSec || 39)}`);
    // Check immediately on startup, then schedule repeating interval
    runCheck().finally(() => scheduleNext());
}

// ─── WhatsApp Command ─────────────────────────────────────────────────────────
async function autoUpdateCommand(sock, chatId, message, userMessage) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
    if (!isOwner) {
        await sock.sendMessage(chatId, { text: '❌ Only the bot owner can use .autoupdate.' }, { quoted: message });
        return;
    }

    const args = userMessage.trim().split(/\s+/).slice(1);
    const sub  = (args[0] || '').toLowerCase();
    const state = readState();

    if (sub === 'on') {
        state.enabled = true;
        writeState(state);
        if (!_timer) scheduleNext();
        await sock.sendMessage(chatId, {
            text: `✅ Auto-update *enabled*. Checks every *${formatInterval(state.intervalSec || 39)}*.\n\nUse \`$autoupdate check\` to trigger a check now.`
        }, { quoted: message });
        return;
    }

    if (sub === 'off') {
        state.enabled = false;
        writeState(state);
        if (_timer) { clearTimeout(_timer); _timer = null; }
        await sock.sendMessage(chatId, {
            text: '⚠️ Auto-update paused for *this session only*.\n\n_It will re-enable automatically the next time the bot restarts._\n\nUse `$autoupdate on` to resume now.'
        }, { quoted: message });
        return;
    }

    if (sub === 'check') {
        await sock.sendMessage(chatId, { text: '🔍 Checking for updates now...' }, { quoted: message });
        if (!await ensureGitRepo()) {
            await sock.sendMessage(chatId, { text: '❌ git is not installed on this server.' }, { quoted: message });
            return;
        }
        try {
            await fetchUpdates();
            const local  = await getCurrentRev();
            const remote = await getRemoteRev();
            if (local === remote) {
                await sock.sendMessage(chatId, { text: `✅ Bot is *already up to date* on \`${REPO_BRANCH}\`.` }, { quoted: message });
            } else {
                const commits = await run(`git log --pretty=format:"%h %s" ${local}..FETCH_HEAD`).catch(() => '');
                await sock.sendMessage(chatId, {
                    text: [
                        `🆕 *Update available!* (branch: \`${REPO_BRANCH}\`)`,
                        '',
                        `📋 *Changes:*\n${commits || '(new commits)'}`,
                        '',
                        'Run `$update` to apply immediately,\nor wait for the next scheduled auto-check.'
                    ].join('\n')
                }, { quoted: message });
            }
        } catch (err) {
            await sock.sendMessage(chatId, { text: `❌ Check failed: ${err.message}` }, { quoted: message });
        }
        return;
    }

    if (sub === 'interval') {
        const sec = parseInterval(args[1] || '');
        if (!sec || sec < 30) {
            await sock.sendMessage(chatId, {
                text: '❌ Interval too short. Minimum is 30s.\n\n*Examples:*\n`$autoupdate interval 30s`\n`$autoupdate interval 10m`\n`$autoupdate interval 2h`\n\nBare number = minutes: `$autoupdate interval 30` → 30 minutes'
            }, { quoted: message });
            return;
        }
        state.intervalSec = sec;
        writeState(state);
        if (_timer) { clearTimeout(_timer); _timer = null; }
        if (state.enabled) scheduleNext();
        await sock.sendMessage(chatId, { text: `⏱️ Auto-update interval set to *${formatInterval(sec)}*.` }, { quoted: message });
        return;
    }

    // Default: status
    const intervalStr = formatInterval(state.intervalSec || 39);
    const statusText = [
        '🔄 *Auto-Update Settings*',
        '',
        `📡 *Status:*   ${state.enabled ? '✅ Enabled' : '🔴 Disabled'}`,
        `⏱️ *Interval:* Every ${intervalStr}`,
        '',
        '*Commands:*',
        '  `$autoupdate on`              — enable',
        '  `$autoupdate off`             — disable',
        '  `$autoupdate check`           — check now',
        '  `$autoupdate interval <time>` — e.g. 30s, 10m, 2h',
        '  `$update`                     — manually apply update',
    ].join('\n');

    await sock.sendMessage(chatId, { text: statusText }, { quoted: message });
}

module.exports = { start, readState, writeState, autoUpdateCommand, runCheck };
