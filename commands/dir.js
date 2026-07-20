'use strict';
const fs   = require('fs');
const path = require('path');
const { CATEGORIES } = require('../lib/categories');

const ROOT = process.cwd(); // bot root — all paths are confined here

// ─── Security: keep paths inside bot root ────────────────────────────────────
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

    const skip = new Set(['node_modules', '.git', '.npm', '__pycache__', '.cache', 'temp', 'tmp']);
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
const SKIP_ALWAYS = new Set(['node_modules', '.git', '.npm', '__pycache__', '.cache', 'temp', 'tmp']);

function buildTree(dir, prefix = '') {
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

// ─── $dir search <query> — search bot commands (open to all) ─────────────────
async function searchDirCommand(sock, chatId, message, query) {
    if (!query) return sock.sendMessage(chatId, {
        text: '🔍 *COMMAND SEARCH*\n\nUsage: *$dir search <keyword>*\nExample: $dir search pin\n\n_Daratech_ ⚡',
    }, { quoted: message });

    const q       = query.toLowerCase();
    const results = [];
    const seen    = new Set();

    for (const cat of CATEGORIES) {
        for (const line of cat.help) {
            if (!line.startsWith('$')) continue;
            if (!line.toLowerCase().includes(q)) continue;

            // Parse: "$cmd <args>   → description"
            const arrow   = line.indexOf('→');
            const cmdPart = (arrow >= 0 ? line.slice(0, arrow) : line).trim();
            const descPart = (arrow >= 0 ? line.slice(arrow + 1) : '').trim();

            // Deduplicate by base command (first word)
            const base = cmdPart.split(/[\s/]/)[0];
            if (seen.has(base)) continue;
            seen.add(base);

            results.push({ cmd: cmdPart, desc: descPart, cat: cat.slug, emoji: cat.emoji });
        }
    }

    if (results.length === 0) {
        return sock.sendMessage(chatId, {
            text: `🔍 No commands found matching *"${query}"*.\n\nTip: use *$dir search <keyword>* to find commands.`,
        }, { quoted: message });
    }

    const lines = [`┌─( 🔍 *SEARCH: ${query}* ) — ${results.length} result${results.length !== 1 ? 's' : ''}`];
    for (const r of results) {
        lines.push('│');
        lines.push(`├─◆ *${r.cmd}*`);
        if (r.desc) lines.push(`│  ${r.desc}`);
        lines.push(`│  ${r.emoji} ${r.cat}`);
    }
    lines.push('│');
    lines.push('└─ _Daratech_ ⚡');

    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}

// ─── Main export ──────────────────────────────────────────────────────────────
async function dirCommand(sock, chatId, message, userMessage) {
    const arg = userMessage.slice(4).trim(); // strip "$dir"

    if (!arg) return showDir(sock, chatId, message, ROOT, '.');

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

module.exports = { dirCommand, searchDirCommand };
