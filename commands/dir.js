'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = process.cwd(); // bot root — all paths are confined here

// ─── Security: keep paths inside bot root ────────────────────────────────────
function safePath(input) {
    const resolved = path.resolve(ROOT, input);
    if (!resolved.startsWith(ROOT)) return null; // path traversal attempt
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
            text: `${header}\n\n_Binary file — content not displayed._`,
        }, { quoted: message });
    }

    // Read content (cap at 3 KB to avoid huge messages)
    let content = '';
    try {
        const raw = fs.readFileSync(absPath, 'utf8');
        const MAX = 3000;
        content = raw.length > MAX
            ? raw.slice(0, MAX) + `\n\n… _(truncated — ${raw.length - MAX} more chars)_`
            : raw;
    } catch (e) {
        content = `_(could not read: ${e.message})_`;
    }

    const text = `${header}\n\n📝 *CONTENT :*\n${'─'.repeat(28)}\n\`\`\`\n${content}\n\`\`\``;
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Show a directory listing ─────────────────────────────────────────────────
async function showDir(sock, chatId, message, absPath, relPath) {
    let entries;
    try { entries = fs.readdirSync(absPath); }
    catch (e) { return sock.sendMessage(chatId, { text: `❌ Cannot read folder: ${e.message}` }, { quoted: message }); }

    // Skip clutter
    const skip = new Set(['node_modules', '.git', '__pycache__', '.cache']);
    entries = entries.filter(e => !skip.has(e)).sort();

    const lines = [];
    for (let i = 0; i < entries.length; i++) {
        const name    = entries[i];
        const full    = path.join(absPath, name);
        const isLast  = i === entries.length - 1;
        const prefix  = isLast ? '└─' : '├─';
        const isDir   = fs.statSync(full).isDirectory();
        const ext     = path.extname(name).replace('.', '');
        const icon    = isDir ? '📁' : fileEmoji(ext);
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
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Full directory tree (top-level only + one level deep) ───────────────────
async function showFullDir(sock, chatId, message) {
    const skip = new Set(['node_modules', '.git', '__pycache__', '.cache', 'tmp', 'temp']);
    let topLevel;
    try { topLevel = fs.readdirSync(ROOT).filter(e => !skip.has(e)).sort(); }
    catch (e) { return sock.sendMessage(chatId, { text: `❌ ${e.message}` }, { quoted: message }); }

    const lines = [];
    for (let i = 0; i < topLevel.length; i++) {
        const name   = topLevel[i];
        const full   = path.join(ROOT, name);
        const isLast = i === topLevel.length - 1;
        const pre    = isLast ? '└─' : '├─';
        const isDir  = fs.statSync(full).isDirectory();
        const ext    = path.extname(name).replace('.', '');
        const icon   = isDir ? '📁' : fileEmoji(ext);
        lines.push(`${pre} ${icon} ${name}${isDir ? '/' : ''}`);

        if (isDir) {
            try {
                const sub = fs.readdirSync(full).filter(e => !skip.has(e)).sort().slice(0, 8);
                for (let j = 0; j < sub.length; j++) {
                    const sName  = sub[j];
                    const sFull  = path.join(full, sName);
                    const sIsDir = fs.statSync(sFull).isDirectory();
                    const sExt   = path.extname(sName).replace('.', '');
                    const sIcon  = sIsDir ? '📁' : fileEmoji(sExt);
                    const sPre   = isLast ? '   ' : '│  ';
                    const sEnd   = j === sub.length - 1 ? '└─' : '├─';
                    lines.push(`${sPre}${sEnd} ${sIcon} ${sName}${sIsDir ? '/' : ''}`);
                }
                const rest = fs.readdirSync(full).filter(e => !skip.has(e)).length - 8;
                if (rest > 0) lines.push(`${isLast ? '   ' : '│  '}   … +${rest} more`);
            } catch {}
        }
    }

    const text = [
        `╭${'─'.repeat(38)}╮`,
        `│  🗂️  *BOT DIRECTORY TREE* 🗂️${' '.repeat(7)}│`,
        `├${'─'.repeat(38)}┤`,
        `│  📋 *ROOT :* ${ROOT.split('/').pop() || '/'}`,
        `╰${'─'.repeat(38)}╯`,
        ``,
        `*📂 Structure:*`,
        lines.join('\n'),
        ``,
        `_Tip: \`$dir <path>\` to explore deeper_`,
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Main export ──────────────────────────────────────────────────────────────
async function dirCommand(sock, chatId, message, userMessage) {
    const arg = userMessage.slice(4).trim(); // strip "$dir"

    if (!arg) return showFullDir(sock, chatId, message);

    const absPath = safePath(arg);
    if (!absPath) {
        return sock.sendMessage(chatId, {
            text: '❌ Invalid path — cannot navigate outside bot directory.',
        }, { quoted: message });
    }

    if (!fs.existsSync(absPath)) {
        return sock.sendMessage(chatId, {
            text: `❌ Path not found: \`${arg}\``,
        }, { quoted: message });
    }

    const stat = fs.statSync(absPath);
    const rel  = path.relative(ROOT, absPath);

    if (stat.isDirectory()) return showDir(sock, chatId, message, absPath, rel);
    return showFile(sock, chatId, message, absPath, rel);
}

module.exports = dirCommand;
