'use strict';
const fs   = require('fs');
const path = require('path');
const { CATEGORIES } = require('../lib/categories');

const ROOT = process.cwd();

// ─── Security: keep paths inside bot root ─────────────────────────────────────
function safePath(input) {
    const resolved = path.resolve(ROOT, input);
    if (!resolved.startsWith(ROOT)) return null;
    return resolved;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatSize(bytes) {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fileType(ext) {
    const map = {
        js: 'JAVASCRIPT', ts: 'TYPESCRIPT', json: 'JSON', md: 'MARKDOWN',
        txt: 'TEXT', sh: 'SHELL SCRIPT', env: 'ENV FILE', html: 'HTML',
        css: 'CSS', py: 'PYTHON', yml: 'YAML', yaml: 'YAML',
        jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', gif: 'IMAGE',
        mp4: 'VIDEO', mp3: 'AUDIO', zip: 'ARCHIVE',
    };
    return map[ext.toLowerCase()] || ext.toUpperCase() || 'FILE';
}

function fileEmoji(ext) {
    const map = {
        js: '📜', ts: '📘', json: '📋', md: '📖', txt: '📄',
        sh: '⚙️', html: '🌐', css: '🎨', py: '🐍',
        jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
        mp4: '🎬', mp3: '🎵', zip: '📦', env: '🔐',
    };
    return map[ext.toLowerCase()] || '📄';
}

function isBinary(ext) {
    return ['jpg','jpeg','png','gif','mp4','mp3','wav','ogg','webp','zip','tar','gz','bin','exe'].includes(ext.toLowerCase());
}

// ─── Show a single file ───────────────────────────────────────────────────────
async function showFile(sock, chatId, message, absPath, relPath) {
    const stat = fs.statSync(absPath);
    const ext  = path.extname(absPath).replace('.', '');
    const name = path.basename(absPath);

    const header = [
        `╭${'─'.repeat(38)}╮`,
        `│  📄 *FILE VIEWER* 📄${' '.repeat(17)}│`,
        `├${'─'.repeat(38)}┤`,
        `│                                      │`,
        `│  🔴 *NAME :* ${name}`,
        `│  📦 *SIZE :* ${formatSize(stat.size)}`,
        `│  🔤 *TYPE :* ${fileType(ext)}`,
        `│  📋 *PATH :* ${relPath}`,
        `│                                      │`,
        `╰${'─'.repeat(38)}╯`,
    ].join('\n');

    if (isBinary(ext)) {
        return sock.sendMessage(chatId, {
            text: `${header}\n\n_Binary file — content not displayed._\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    }

    let raw = '';
    try {
        raw = fs.readFileSync(absPath, 'utf8');
    } catch (e) {
        return sock.sendMessage(chatId, {
            text: `${header}\n\n_(could not read: ${e.message})_\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    }

    const MAX = 3000;
    if (raw.length > MAX) {
        await sock.sendMessage(chatId, { text: header }, { quoted: message });
        await sock.sendMessage(chatId, {
            document: Buffer.from(raw, 'utf8'),
            mimetype: 'text/plain',
            fileName: `${name}.txt`,
            caption: `📄 *${name}* — full file\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        return;
    }

    const text = `${header}\n\n📝 *CONTENT :*\n${'─'.repeat(28)}\n\`\`\`\n${raw}\n\`\`\`\n\n_Daratech_ ⚡`;
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Show a directory listing ─────────────────────────────────────────────────
async function showDir(sock, chatId, message, absPath, relPath) {
    let entries;
    try { entries = fs.readdirSync(absPath); }
    catch (e) { return sock.sendMessage(chatId, { text: `❌ Cannot read folder: ${e.message}` }, { quoted: message }); }

    const skip = SKIP_ALWAYS;
    entries = entries.filter(e => !skip.has(e)).sort();

    const lines = [];
    for (let i = 0; i < entries.length; i++) {
        const name   = entries[i];
        const full   = path.join(absPath, name);
        const isLast = i === entries.length - 1;
        const prefix = isLast ? '└─' : '├─';
        const isDir  = fs.statSync(full).isDirectory();
        const ext    = path.extname(name).replace('.', '');
        const icon   = isDir ? '📁' : fileEmoji(ext);
        lines.push(`${prefix} ${icon} ${name}${isDir ? '/' : ''}`);
    }

    const displayPath = relPath || '.';
    const text = [
        `╭${'─'.repeat(38)}╮`,
        `│  📁 *FOLDER VIEW* 📁${' '.repeat(16)}│`,
        `├${'─'.repeat(38)}┤`,
        `│  📋 *PATH  :* ${displayPath}`,
        `│  📦 *ITEMS :* ${entries.length}`,
        `╰${'─'.repeat(38)}╯`,
        ``,
        `*📂 Contents:*`,
        lines.join('\n') || '_Empty folder_',
        ``,
        `_Daratech_ ⚡`,
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Full recursive directory tree ───────────────────────────────────────────
const SKIP_ALWAYS = new Set([
    'node_modules', 'session', 'sessions', 'auth_info', 'auth_info_baileys',
    'creds', 'store', 'backup',
    '.git', '.npm', '.upm', '.config', '.cache', '__pycache__',
    'dist', 'build', 'coverage',
    'temp', 'tmp', 'logs', 'log',
    '.env',
    '.agents', 'attached_assets', '.local',
]);

function buildTree(dir, prefix) {
    prefix = prefix || '';
    let entries;
    try { entries = fs.readdirSync(dir).filter(e => !SKIP_ALWAYS.has(e)).sort(); }
    catch { return []; }

    const lines = [];
    for (let i = 0; i < entries.length; i++) {
        const name   = entries[i];
        const full   = path.join(dir, name);
        const isLast = i === entries.length - 1;
        const branch = isLast ? '└─' : '├─';
        const child  = isLast ? '   ' : '│  ';

        let isDir = false;
        try { isDir = fs.statSync(full).isDirectory(); } catch { continue; }

        const ext  = path.extname(name).replace('.', '');
        const icon = isDir ? '📁' : fileEmoji(ext);
        lines.push(`${prefix}${branch} ${icon} ${name}${isDir ? '/' : ''}`);

        if (isDir) {
            const sub = buildTree(full, prefix + child);
            lines.push(...sub);
        }
    }
    return lines;
}

async function showFullDir(sock, chatId, message) {
    const lines    = buildTree(ROOT);
    const rootName = ROOT.split('/').pop() || 'bot';

    const header = [
        `╭${'─'.repeat(38)}╮`,
        `│  🗂️  *BOT DIRECTORY TREE* 🗂️${' '.repeat(7)}│`,
        `├${'─'.repeat(38)}┤`,
        `│  📋 *ROOT :* ${rootName}`,
        `│  📦 *FILES:* ${lines.length} entries`,
        `╰${'─'.repeat(38)}╯`,
        ``,
        `*📂 Full Structure:*`,
    ].join('\n');

    const tree   = lines.join('\n');
    const footer = `\n\n_Tip: \`$dir <path>\` to view a folder or file_`;
    const MAX    = 60000;
    const full   = `${header}\n${tree}${footer}`;

    if (full.length <= MAX) {
        await sock.sendMessage(chatId, { text: full }, { quoted: message });
    } else {
        const chunks = [];
        let cur = header + '\n';
        for (const line of lines) {
            if ((cur + line + '\n').length > MAX) { chunks.push(cur); cur = ''; }
            cur += line + '\n';
        }
        if (cur) chunks.push(cur + footer);
        for (let i = 0; i < chunks.length; i++) {
            await sock.sendMessage(chatId, {
                text: i === 0 ? chunks[i] : `📂 _(continued ${i + 1}/${chunks.length})_\n\n${chunks[i]}`,
            }, { quoted: message });
        }
    }
}

// ─── $dir search <query> — find commands by name ──────────────────────────────
async function searchDirCommand(sock, chatId, message, query) {
    if (!query) return sock.sendMessage(chatId, {
        text: '🔍 *CMD SEARCH*\n\nUsage: *$dir search <command>*\nExample: $dir search tiktok\n\nSearches all commands.\n\n_Daratech_ ⚡',
    }, { quoted: message });

    const q       = query.toLowerCase().replace(/^\$/, '');
    const mainJs  = path.join(ROOT, 'main.js');
    const cmdsDir = path.join(ROOT, 'commands');

    // ── Step 1: Build varName -> file map from main.js require() calls ────────
    const varToFile = new Map();
    try {
        const src = fs.readFileSync(mainJs, 'utf8');

        // const X = require('./commands/Y')
        for (const m of src.matchAll(/const\s+(\w+)\s*=\s*require\(['"`]\.\/commands\/([^'"` /]+?)['"`]\)/g)) {
            varToFile.set(m[1], 'commands/' + m[2] + '.js');
        }
        // const { A, B } = require('./commands/Y')
        for (const m of src.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(['"`]\.\/commands\/([^'"` /]+?)['"`]\)/g)) {
            const file = 'commands/' + m[2] + '.js';
            for (const part of m[1].split(',')) {
                const name = part.trim().split(/\s+as\s+/).pop().trim();
                if (/^\w+$/.test(name)) varToFile.set(name, file);
            }
        }
    } catch {}

    // ── Step 2: Parse main.js routing — trace each $cmd to its source file ────
    const cmdMap = new Map();
    try {
        const src   = fs.readFileSync(mainJs, 'utf8');
        const lines = src.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            const triggers = [];
            for (const m of line.matchAll(/startsWith\(['"`](\$[a-zA-Z][a-zA-Z0-9_-]*)['"`]\)/g)) triggers.push(m[1]);
            for (const m of line.matchAll(/===\s*['"`](\$[a-zA-Z][a-zA-Z0-9_-]*)['"`]/g))        triggers.push(m[1]);
            if (!triggers.length) continue;

            // Look ahead for the first awaited function call to find the source file
            const context = lines.slice(i, i + 5).join(' ');
            const fnCall  = context.match(/await\s+(\w+)\s*\(/);
            const srcFile = fnCall ? (varToFile.get(fnCall[1]) || null) : null;

            for (const cmd of triggers) {
                // Normalise e.g. $trending-crypto -> $trendingcrypto
                const norm  = cmd.replace(/-/g, '').toLowerCase();
                const entry = srcFile || 'main.js';
                if (!cmdMap.has(norm))             cmdMap.set(norm, entry);
                if (!cmdMap.has(cmd.toLowerCase())) cmdMap.set(cmd.toLowerCase(), entry);
            }
        }
    } catch {}

    // ── Step 3: Scan commands/ files — always override main.js entries ─────────
    let files = [];
    try { files = fs.readdirSync(cmdsDir).filter(f => f.endsWith('.js')).sort(); } catch {}

    for (const file of files) {
        const relFile = 'commands/' + file;
        let src = '';
        try { src = fs.readFileSync(path.join(cmdsDir, file), 'utf8'); } catch { continue; }

        const found = new Set();

        // a) startsWith('$cmd') or === '$cmd' inside the file
        for (const m of src.matchAll(/startsWith\(['"`](\$[a-zA-Z][a-zA-Z0-9_]*)['"`]\)/g)) found.add(m[1].toLowerCase());
        for (const m of src.matchAll(/===\s*['"`](\$[a-zA-Z][a-zA-Z0-9_]*)['"`]/g))        found.add(m[1].toLowerCase());

        // b) JSDoc / comment lines: "* $gcstatus" or "// $gcstatus"
        for (const m of src.matchAll(/(?:^|\n)\s*(?:\/\/+|\*+)\s*(\$[a-zA-Z][a-zA-Z0-9_]*)/g)) found.add(m[1].toLowerCase());

        // c) Usage strings: "Usage: $cmd"
        for (const m of src.matchAll(/[Uu]sage[:\s]+(\$[a-zA-Z][a-zA-Z0-9_]*)/g)) found.add(m[1].toLowerCase());

        // d) Filename heuristic: gcstatus.js => $gcstatus
        const SKIP_NAMES = new Set(['main','index','config','settings','helper','utils','lib','handler','router']);
        const base = path.basename(file, '.js').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (base && !SKIP_NAMES.has(base)) found.add('$' + base);

        for (const cmd of found) cmdMap.set(cmd, relFile);
    }

    // ── Step 4: Filter and display ────────────────────────────────────────────
    const seen    = new Set();
    const results = [];
    for (const [cmd, file] of cmdMap) {
        const bare = cmd.replace(/^\$/, '');
        if (bare.includes(q) && !seen.has(cmd)) {
            seen.add(cmd);
            results.push({ cmd, file });
        }
    }
    results.sort((a, b) => a.cmd.localeCompare(b.cmd));

    if (results.length === 0) {
        return sock.sendMessage(chatId, {
            text: '🔍 No commands found matching *"' + query + '"*.\n\n_Daratech_ ⚡',
        }, { quoted: message });
    }

    const outLines = [
        '┌─( 🔍 *SEARCH: ' + query + '* ) — ' + results.length + ' result' + (results.length !== 1 ? 's' : ''),
        '│',
    ];
    for (let i = 0; i < results.length; i++) {
        const { cmd, file } = results[i];
        const isLast = i === results.length - 1;
        outLines.push((isLast ? '└─' : '├─') + '◆ *' + cmd + '*');
        outLines.push('│  📂 ' + file);
        outLines.push('│');
    }
    outLines.push('_Daratech_ ⚡');
    await sock.sendMessage(chatId, { text: outLines.join('\n') }, { quoted: message });
}

// ─── Main export ──────────────────────────────────────────────────────────────
async function dirCommand(sock, chatId, message, userMessage) {
    const arg = userMessage.slice(4).trim(); // strip "$dir"

    if (!arg) return showDir(sock, chatId, message, ROOT, '.');

    // "search" sub-command
    if (arg.toLowerCase().startsWith('search')) {
        const q = arg.slice(6).trim();
        return searchDirCommand(sock, chatId, message, q);
    }

    const absPath = safePath(arg);
    if (!absPath) {
        return sock.sendMessage(chatId, {
            text: '❌ Invalid path — cannot navigate outside bot directory.',
        }, { quoted: message });
    }

    if (!fs.existsSync(absPath)) {
        return sock.sendMessage(chatId, {
            text: '❌ Path not found: `' + arg + '`',
        }, { quoted: message });
    }

    const stat = fs.statSync(absPath);
    const rel  = path.relative(ROOT, absPath);

    if (stat.isDirectory()) return showDir(sock, chatId, message, absPath, rel);
    return showFile(sock, chatId, message, absPath, rel);
}

module.exports = { dirCommand, searchDirCommand };
