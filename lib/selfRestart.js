'use strict';
/**
 * selfRestart — zero-downtime restart for Daratech Bot
 *
 * Instead of exiting and waiting 30-60s for the Katabump panel to restart the
 * process, we spawn a fresh instance of ourselves immediately, then exit cleanly.
 * WhatsApp session stays valid because the gap is only ~3-5 seconds.
 *
 * Duplicate-instance guard:
 *   - Every startup writes our PID to tmp/bot.pid.
 *   - If started WITHOUT DARA_SELF_RESTART (i.e. by the panel after a clean exit),
 *     we check whether a bot is already running via the PID file. If it is, we
 *     exit(0) immediately so the panel doesn't create a second instance.
 *   - Self-spawned children (DARA_SELF_RESTART=1) skip the check and just write
 *     their own PID, then start normally.
 */

const { spawn } = require('child_process');
const path      = require('path');
const fs        = require('fs');

const PID_FILE = path.join(process.cwd(), 'tmp', 'bot.pid');

// ── PID helpers ────────────────────────────────────────────────────────────────

function writePid() {
    try {
        const dir = path.dirname(PID_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(PID_FILE, String(process.pid));
    } catch { /* non-fatal */ }
}

/**
 * Call on startup (only when NOT a self-restart child).
 * Returns true if another instance is already running → caller should exit(0).
 */
function isDuplicatePanelRestart() {
    if (process.env.DARA_SELF_RESTART === '1') return false; // we're the intended child
    try {
        if (!fs.existsSync(PID_FILE)) return false;
        const existing = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
        if (!existing || existing === process.pid) return false;
        try {
            process.kill(existing, 0); // signal 0 = check if alive, doesn't send signal
            console.log(`[selfRestart] Another instance already running (PID ${existing}). Exiting this panel-restart.`);
            return true;
        } catch {
            return false; // stale PID — process is dead
        }
    } catch {
        return false;
    }
}

// ── Main restart function ──────────────────────────────────────────────────────

/**
 * selfRestart(sock, chatId, message, text?)
 *
 * 1. Sends a "restarting" message on WhatsApp (if sock/chatId provided).
 * 2. Spawns a fresh detached `node index.js` immediately.
 * 3. Waits ~1.2 s for the message to deliver, then exits cleanly.
 *
 * Exit codes:
 *   0 (spawn succeeded) → panel sees clean shutdown → does NOT auto-restart → only
 *                          the self-spawned child runs.  ✅
 *   1 (spawn failed)    → panel sees crash → auto-restarts as fallback.       ✅
 */
async function selfRestart(sock, chatId, message, text) {
    if (sock && chatId) {
        try {
            await sock.sendMessage(chatId, {
                text: text ||
                    '✅ Update applied!\n\n' +
                    '🔄 Restarting now — bot will be back online in ~5 seconds.\n\n' +
                    '_No need to scan again; session is preserved._'
            }, { quoted: message });
        } catch { /* ignore — process is about to exit anyway */ }
    }

    let spawned = false;
    try {
        // Resolve the entry point — works whether started as `node index.js` or via panel
        const entry = require.main?.filename || path.join(process.cwd(), 'index.js');
        const child = spawn(process.execPath, [entry], {
            detached: true,
            stdio:    'ignore',      // fully detach from parent stdio
            env:      { ...process.env, DARA_SELF_RESTART: '1' },
            cwd:      process.cwd(),
        });
        child.unref();              // don't keep parent alive for the child
        spawned = true;
        console.log('[selfRestart] New instance spawned. Exiting parent cleanly...');
    } catch (err) {
        console.error('[selfRestart] Spawn failed:', err.message, '— falling back to process.exit(1)');
    }

    // Wait for the WA message to deliver before dropping the socket
    await new Promise(r => setTimeout(r, 1200));

    // exit(0) = clean → panel does NOT restart (it only auto-restarts on crash/exit≠0)
    // exit(1) = crash fallback when spawn failed → panel auto-restarts
    process.exit(spawned ? 0 : 1);
}

module.exports = { writePid, isDuplicatePanelRestart, selfRestart };
