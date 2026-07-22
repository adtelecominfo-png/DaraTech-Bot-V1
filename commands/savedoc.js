'use strict';

const fs   = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../data/savedocs');
if (!fs.existsSync(DOCS_DIR)) fs.mkdirSync(DOCS_DIR, { recursive: true });

function docPath(name) { return path.join(DOCS_DIR, `${name}.txt`); }
function validName(name) { return /^[a-zA-Z0-9_-]{1,40}$/.test(name); }

function listDocs() {
    return fs.readdirSync(DOCS_DIR)
        .filter(f => f.endsWith('.txt'))
        .map(f => f.replace('.txt', ''));
}

function readDoc(name) {
    const p = docPath(name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function writeDoc(name, content) {
    fs.writeFileSync(docPath(name), content, 'utf8');
}

function deleteDoc(name) {
    const p = docPath(name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ─── Main command ─────────────────────────────────────────────────────────────
async function savedocCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$savedoc'.length).trim();

    // ── $savedoc  /  $savedoc list ─────────────────────────────────────────
    if (!raw || raw === 'list') {
        const docs = listDocs();
        if (!docs.length) {
            return reply(
                '📂 *Saved Docs*\n\n' +
                'No documents yet.\n\n' +
                '_Create one:_  $savedoc new <name>\n' +
                '_Write to it:_ $savedoc <name> <text>'
            );
        }
        const list = docs.map((d, i) => `${i + 1}. 📄 ${d}`).join('\n');
        return reply(
            `📂 *Saved Docs* (${docs.length})\n\n${list}\n\n` +
            '_$savedoc <name> <text>_ → write\n' +
            '_$savedoc view <name>_   → read\n' +
            '_$savedoc delete <name>_ → delete'
        );
    }

    const parts = raw.split(' ');
    const sub   = parts[0].toLowerCase();

    // ── $savedoc new <name> ────────────────────────────────────────────────
    if (sub === 'new') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc new <name>*\nName must be letters, numbers, _ or -');
        if (!validName(name)) return reply('❌ Name can only use letters, numbers, _ and - (max 40 chars)');
        if (readDoc(name) !== null) return reply(`❌ *${name}* already exists.\n\nWrite to it: $savedoc ${name} <text>\nRead it: $savedoc view ${name}`);
        try {
            writeDoc(name, `# ${name}\n`);
            return reply(`✅ *${name}* created!\n\nWrite to it:\n$savedoc ${name} <your text here>`);
        } catch {
            return reply('❌ Error creating doc. Check bot data folder permissions.');
        }
    }

    // ── $savedoc delete <name> ─────────────────────────────────────────────
    if (sub === 'delete') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc delete <name>*');
        if (readDoc(name) === null) return reply(`❌ *${name}* doesn't exist.`);
        try {
            deleteDoc(name);
            return reply(`🗑️ *${name}* deleted.`);
        } catch {
            return reply('❌ Error deleting doc.');
        }
    }

    // ── $savedoc view <name>  /  $savedoc read <name> ─────────────────────
    if (sub === 'view' || sub === 'read') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc view <name>*');
        const content = readDoc(name);
        if (content === null) return reply(`❌ *${name}* doesn't exist.\nCreate it: $savedoc new ${name}`);
        return reply(`📄 *${name}*\n\n${content.trim() || '_(empty)_'}`);
    }

    // ── $savedoc <name> <text>  — append text ─────────────────────────────
    const name = parts[0];
    const text = parts.slice(1).join(' ').trim();

    if (!validName(name)) {
        return reply(
            '❌ Unknown subcommand or invalid name.\n\n' +
            '*Usage:*\n' +
            '$savedoc list\n' +
            '$savedoc new <name>\n' +
            '$savedoc <name> <text>\n' +
            '$savedoc view <name>\n' +
            '$savedoc delete <name>'
        );
    }

    // No text supplied → show the doc
    if (!text) {
        const content = readDoc(name);
        if (content === null) return reply(`❌ *${name}* doesn't exist.\nCreate it: $savedoc new ${name}`);
        return reply(`📄 *${name}*\n\n${content.trim() || '_(empty)_'}`);
    }

    // Append text — auto-create doc if it doesn't exist yet
    try {
        const existing  = readDoc(name);
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
        let newContent;

        if (existing === null) {
            newContent = `# ${name}\n\n[${timestamp}]\n${text}\n`;
        } else {
            newContent = existing.trimEnd() + `\n\n[${timestamp}]\n${text}\n`;
        }

        writeDoc(name, newContent);
        const action = existing === null ? 'Created & saved to' : 'Saved to';
        return reply(`✅ ${action} *${name}*:\n\n${text}`);
    } catch {
        return reply('❌ Error writing to doc. Try again.');
    }
}

module.exports = savedocCommand;
