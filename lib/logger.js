'use strict';
/**
 * logger.js — In-memory circular log buffer
 *
 * Intercepts console.log / console.error / console.warn / console.info
 * and stores the last LOG_BUFFER_SIZE lines with timestamps.
 *
 * Usage:
 *   require('./lib/logger');          // once, at top of index.js
 *   const { getLogBuffer } = require('./lib/logger');
 */

const LOG_BUFFER_SIZE = 200; // keep last 200 entries in memory
const logBuffer = [];

const LEVEL_LABELS = {
    log:   'LOG',
    info:  'INF',
    warn:  'WRN',
    error: 'ERR',
};

/**
 * Push a formatted entry into the circular buffer.
 */
function pushEntry(level, args) {
    const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const text = args
        .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')
        // strip ANSI colour codes so the WhatsApp message is clean
        .replace(/\x1B\[[0-9;]*m/g, '');

    logBuffer.push(`[${ts}] [${LEVEL_LABELS[level] || 'LOG'}] ${text}`);

    // Trim to max size
    if (logBuffer.length > LOG_BUFFER_SIZE) {
        logBuffer.shift();
    }
}

/**
 * Return the last `n` entries (default 20).
 */
function getLogBuffer(n = 20) {
    return logBuffer.slice(-n);
}

/**
 * Clear the in-memory log buffer.
 */
function clearLogBuffer() {
    logBuffer.length = 0;
}

// ── Patch console methods ──────────────────────────────────────────────
const _orig = {
    log:   console.log.bind(console),
    info:  console.info.bind(console),
    warn:  console.warn.bind(console),
    error: console.error.bind(console),
};

for (const level of ['log', 'info', 'warn', 'error']) {
    console[level] = (...args) => {
        pushEntry(level, args);
        _orig[level](...args);
    };
}

module.exports = { getLogBuffer, clearLogBuffer };
