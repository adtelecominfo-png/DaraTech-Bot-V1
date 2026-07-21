'use strict';
/**
 * Update Command — pulls latest code from GitHub and restarts.
 *
 * Strategy:
 *  1. git fetch → reset → clean
 *     Session survives because $env (SESSION_ID) and session/ are both
 *     gitignored — git never touches them. On next boot, index.js restores
 *     creds from SESSION_ID if the session folder is empty.
 *  2. Exit cleanly so the panel restarts once, as the sole owner of the session.
 *
 * No selfRestart, no child-process spawning.
 * Spawning a child + exiting causes two simultaneous Baileys connections,
 * which WhatsApp kills by invalidating one session → forces re-pairing.
 */

const { exec } = require('child_process');
const fs       = require('fs');
const path     = require('path');
const settings = require('../settings');
const isOwnerOrSudo = require('../lib/isOwner');

// ── Shell helper ─────────────────────────────────────────────────────────────

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { windowsHide: true }, (err, stdout, stderr) => {
            if (err) return reject(new Error((stderr || stdout || err.message || '').toString().trim()));
            resolve((stdout || '').toString().trim());
        });
    });
}

// ── Git helpers ──────────────────────────────────────────────────────────────

async function hasGit() {
    if (!fs.existsSync(path.join(process.cwd(), '.git'))) return false;
    try { await run('git --version'); return true; } catch { return false; }
}

async function detectBranch() {
    try {
        const t = (await run('git rev-parse --abbrev-ref --symbolic-full-name @{u}')).trim();
        if (t) return t;
    } catch {}
    const b = (settings.githubBranch || '').trim();
    if (b) return `origin/${b}`;
    for (const n of ['main', 'master']) {
        try { await run(`git rev-parse origin/${n}`); return `origin/${n}`; } catch {}
    }
    return 'origin/main';
}

// ── Env + session backup/restore ─────────────────────────────────────────────
// Some hosting platforms (e.g. Katabump) reset the container to the git repo
// state when the process restarts, wiping any non-tracked files including $env
// and session/. We snapshot them in memory before git operations and write them
// back afterwards so they survive even a hard container reset.

// Data files to snapshot/restore — add any new ones here
const DATA_FILES = [
    'economy.json',
    'userGroupData.json',
    'antimedia.json',
    'banned.json',
    'premium.json',
    'gcstatus.json',
    'warnings.json',
    'clean_store.json',
];

function snapshotEnvAndSession() {
    const snap = { env: null, creds: null, data: {} };
    const dataDir   = path.join(process.cwd(), 'data');
    const envPath   = path.join(process.cwd(), '.env');
    const credsPath = path.join(process.cwd(), 'session', 'creds.json');

    try { if (fs.existsSync(envPath))   snap.env   = fs.readFileSync(envPath,   'utf8'); } catch {}
    try { if (fs.existsSync(credsPath)) snap.creds = fs.readFileSync(credsPath, 'utf8'); } catch {}

    for (const file of DATA_FILES) {
        try {
            const p = path.join(dataDir, file);
            if (fs.existsSync(p)) snap.data[file] = fs.readFileSync(p, 'utf8');
        } catch {}
    }
    return snap;
}

function restoreEnvAndSession(snap) {
    const envPath    = path.join(process.cwd(), '.env');
    const sessionDir = path.join(process.cwd(), 'session');
    const credsPath  = path.join(sessionDir, 'creds.json');
    const dataDir    = path.join(process.cwd(), 'data');

    try {
        if (snap.env !== null) {
            fs.writeFileSync(envPath, snap.env, 'utf8');
            console.log('[update] $env restored ✅');
        }
    } catch (e) {
        console.error('[update] Failed to restore $env:', e.message);
    }

    try {
        if (snap.creds !== null) {
            if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
            fs.writeFileSync(credsPath, snap.creds, 'utf8');
            console.log('[update] session/creds.json restored ✅');
        }
    } catch (e) {
        console.error('[update] Failed to restore session/creds.json:', e.message);
    }

    if (!fs.existsSync(dataDir)) {
        try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    }
    for (const [file, content] of Object.entries(snap.data || {})) {
        try {
            fs.writeFileSync(path.join(dataDir, file), content, 'utf8');
            console.log(`[update] data/${file} restored ✅`);
        } catch (e) {
            console.error(`[update] Failed to restore data/${file}:`, e.message);
        }
    }
}

// ── Update via git ─────────────────────────────────────────────────────────────

async function updateViaGit() {
    const oldRev = (await run('git rev-parse HEAD').catch(() => 'unknown'));
    await run('git fetch --all --prune');
    const branch = await detectBranch();
    const newRev = await run(`git rev-parse ${branch}`);
    const sameRev = oldRev === newRev;

    if (!sameRev) {
        // Snapshot $env and session before git wipes anything
        const snap = snapshotEnvAndSession();

        await run(`git reset --hard ${newRev}`);
        await run('git clean -fd --exclude=package-lock.json --exclude=node_modules --exclude=data');

        // Restore immediately after — before npm install or restart
        restoreEnvAndSession(snap);

        // Only run npm install if package.json actually changed
        try {
            const diff = await run(`git diff --name-only ${oldRev} ${newRev} -- package.json`);
            if (diff.length > 0) {
                console.log('[update] package.json changed — running npm install');
                await run('npm install --no-audit --no-fund --prefer-offline');
            } else {
                console.log('[update] package.json unchanged — skipping npm install');
            }
        } catch { /* non-fatal */ }
    }

    return { sameRev, newRev };
}

// ── ZIP fallback ─────────────────────────────────────────────────────────────

function downloadFile(url, dest, visited = new Set()) {
    return new Promise((resolve, reject) => {
        try {
            if (visited.has(url) || visited.size > 5) return reject(new Error('Too many redirects'));
            visited.add(url);
            const client = url.startsWith('https://') ? require('https') : require('http');
            const req = client.get(url, { headers: { 'User-Agent': 'Daratech-Updater/1.0', 'Accept': '*/*' } }, res => {
                if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                    const next = new URL(res.headers.location, url).toString();
                    res.resume();
                    return downloadFile(next, dest, visited).then(resolve).catch(reject);
                }
                if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
                const file = fs.createWriteStream(dest);
                res.pipe(file);
                file.on('finish', () => file.close(resolve));
                file.on('error', err => { try { file.close(() => {}); } catch {} fs.unlink(dest, () => reject(err)); });
            });
            req.on('error', err => { fs.unlink(dest, () => reject(err)); });
        } catch (e) { reject(e); }
    });
}

async function extractZip(zipPath, outDir) {
    if (process.platform === 'win32') {
        await run(`powershell -NoProfile -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${outDir.replace(/\\/g, '/')}' -Force"`);
        return;
    }
    for (const [check, cmd] of [
        ['command -v unzip', `unzip -o '${zipPath}' -d '${outDir}'`],
        ['command -v 7z',    `7z x -y '${zipPath}' -o'${outDir}'`],
        ['busybox unzip -h', `busybox unzip -o '${zipPath}' -d '${outDir}'`],
    ]) {
        try { await run(check); await run(cmd); return; } catch {}
    }
    throw new Error('No unzip tool found (unzip/7z/busybox). Use git mode.');
}

function copyDir(src, dest, skip = []) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const e of fs.readdirSync(src)) {
        if (skip.includes(e)) continue;
        const s = path.join(src, e), d = path.join(dest, e);
        fs.lstatSync(s).isDirectory() ? copyDir(s, d, skip) : fs.copyFileSync(s, d);
    }
}

async function updateViaZip(zipOverride) {
    const zipUrl = (zipOverride || settings.updateZipUrl || process.env.UPDATE_ZIP_URL || '').trim();
    if (!zipUrl) throw new Error('No ZIP URL set. Add settings.updateZipUrl or UPDATE_ZIP_URL env var.');

    const backedUp = backupSession();
    try {
        const tmpDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const zipPath   = path.join(tmpDir, 'update.zip');
        const extractTo = path.join(tmpDir, 'update_extract');

        await downloadFile(zipUrl, zipPath);
        if (fs.existsSync(extractTo)) fs.rmSync(extractTo, { recursive: true, force: true });
        await extractZip(zipPath, extractTo);

        const [root] = fs.readdirSync(extractTo).map(n => path.join(extractTo, n));
        const srcRoot = fs.existsSync(root) && fs.lstatSync(root).isDirectory() ? root : extractTo;

        // Preserve owner numbers from current settings.js
        let owner = null, botOwner = null;
        try {
            const s = require('../settings');
            owner    = s.ownerNumber ? String(s.ownerNumber) : null;
            botOwner = s.botOwner    ? String(s.botOwner)    : null;
        } catch {}

        copyDir(srcRoot, process.cwd(), ['node_modules', '.git', 'session', 'tmp', 'temp', 'data', 'baileys_store.json']);

        if (owner) {
            try {
                const sp = path.join(process.cwd(), 'settings.js');
                if (fs.existsSync(sp)) {
                    let txt = fs.readFileSync(sp, 'utf8');
                    txt = txt.replace(/ownerNumber:\s*'[^']*'/, `ownerNumber: '${owner}'`);
                    if (botOwner) txt = txt.replace(/botOwner:\s*'[^']*'/, `botOwner: '${botOwner}'`);
                    fs.writeFileSync(sp, txt);
                }
            } catch {}
        }

        try { fs.rmSync(extractTo, { recursive: true, force: true }); } catch {}
        try { fs.rmSync(zipPath,   { force: true }); }               catch {}
    } finally {
        if (backedUp) restoreSession();
    }
}

// ── Restart ───────────────────────────────────────────────────────────────────

async function doRestart(sock, chatId, message, text) {
    try {
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch {}

    // Write a flag so the bot sends an "update done" message on next connect
    try {
        const flagDir  = path.join(process.cwd(), 'data');
        const flagPath = path.join(flagDir, 'update_done.json');
        if (!fs.existsSync(flagDir)) fs.mkdirSync(flagDir, { recursive: true });
        fs.writeFileSync(flagPath, JSON.stringify({
            chatId: chatId,
            ts: Date.now(),
        }));
    } catch { /* non-fatal */ }

    // Let the panel handle the single restart.
    // PM2 if available; otherwise clean exit so Katabump/panel auto-restarts.
    try { await run('pm2 restart all'); return; } catch {}
    setTimeout(() => process.exit(0), 800);
}

// ── Main command ──────────────────────────────────────────────────────────────

async function updateCommand(sock, chatId, message, zipOverride) {
    const senderId = message.key.participant || message.key.remoteJid;
    if (!message.key.fromMe && !(await isOwnerOrSudo(senderId, sock, chatId))) {
        return sock.sendMessage(chatId, { text: '❌ Only the bot owner can use $update' }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '🔄 Checking for updates…' }, { quoted: message });

        if (await hasGit()) {
            const { sameRev, newRev } = await updateViaGit();
            if (sameRev) {
                return sock.sendMessage(chatId, {
                    text: '✅ Already up to date!\n\n_No restart needed._'
                }, { quoted: message });
            }
            await doRestart(sock, chatId, message,
                `🔄 Update applied — restarting now…\n_Bot will be back in ~5 seconds._`
            );
        } else {
            await updateViaZip(zipOverride);
            await doRestart(sock, chatId, message,
                `🔄 Update applied — restarting now…\n_Bot will be back in ~5 seconds._`
            );
        }
    } catch (err) {
        console.error('[update] Failed:', err.message);
        await sock.sendMessage(chatId, { text: `❌ Update failed:\n${err.message}` }, { quoted: message });
    }
}

module.exports = updateCommand;
