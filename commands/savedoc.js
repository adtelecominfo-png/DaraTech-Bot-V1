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

function getQuotedText(message) {
    const ctx = message.message?.extendedTextMessage?.contextInfo
              || message.message?.imageMessage?.contextInfo
              || message.message?.videoMessage?.contextInfo
              || message.message?.audioMessage?.contextInfo
              || message.message?.documentMessage?.contextInfo;
    if (!ctx?.quotedMessage) return null;
    const q = ctx.quotedMessage;
    return (
        q.conversation
        || q.extendedTextMessage?.text
        || q.imageMessage?.caption
        || q.videoMessage?.caption
        || q.documentMessage?.caption
        || null
    );
}

// ─── Main command ─────────────────────────────────────────────────────────────
async function savedocCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$savedoc'.length).trim();

    // ── $savedoc  /  $savedoc list ────────────────────────────────────────
    if (!raw || raw === 'list') {
        const docs = listDocs();
        if (!docs.length) {
            return reply(
                '╭─「 📂 *SaveDoc* 」\n' +
                '│\n' +
                '│  Your document vault is empty.\n' +
                '│\n' +
                '├─ *Get started:*\n' +
                '│  $savedoc new <name>        → create a doc\n' +
                '│  $savedoc <name> <text>     → write to a doc\n' +
                '╰───────────────────────'
            );
        }
        const list = docs.map((d, i) => `│  ${i + 1}. 📄 ${d}`).join('\n');
        return reply(
            `╭─「 📂 *SaveDoc* — ${docs.length} doc${docs.length > 1 ? 's' : ''} 」\n` +
            '│\n' +
            `${list}\n` +
            '│\n' +
            '├─ *Commands:*\n' +
            '│  $savedoc <name> <text>     → append to a doc\n' +
            '│  $savedoc view <name>       → read a doc\n' +
            '│  $savedoc delete <name>     → delete a doc\n' +
            '╰───────────────────────'
        );
    }

    const parts = raw.split(' ');
    const sub   = parts[0].toLowerCase();

    // ── $savedoc new <name> ───────────────────────────────────────────────
    if (sub === 'new') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 📂 *SaveDoc — New Doc* 」\n' +
                '│\n' +
                '│  Please provide a name for the document.\n' +
                '│\n' +
                '│  *Usage:* $savedoc new <name>\n' +
                '│  *Rules:* letters, numbers, _ or - (max 40)\n' +
                '╰───────────────────────'
            );
        }
        if (!validName(name)) {
            return reply(
                '╭─「 📂 *SaveDoc — Invalid Name* 」\n' +
                '│\n' +
                `│  "${name}" is not a valid document name.\n` +
                '│\n' +
                '│  Only letters, numbers, underscores (_)\n' +
                '│  and hyphens (-) are allowed. Max 40 chars.\n' +
                '╰───────────────────────'
            );
        }
        if (readDoc(name) !== null) {
            return reply(
                `╭─「 📂 *SaveDoc — Already Exists* 」\n` +
                '│\n' +
                `│  A document named *${name}* already exists.\n` +
                '│\n' +
                '├─ *What to do:*\n' +
                `│  $savedoc ${name} <text>   → write to it\n` +
                `│  $savedoc view ${name}     → read it\n` +
                '╰───────────────────────'
            );
        }
        try {
            const quotedText = getQuotedText(message);
            const timestamp  = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
            const initContent = quotedText
                ? `# ${name}\n\n[${timestamp}]\n${quotedText}\n`
                : `# ${name}\n`;
            writeDoc(name, initContent);
            return reply(
                `╭─「 📂 *SaveDoc — Created* 」\n` +
                '│\n' +
                `│  ✅ *${name}* has been created successfully.\n` +
                (quotedText
                    ? `│\n│  📎 Saved quoted message:\n│  ${quotedText}\n`
                    : '│\n├─ *Next step:*\n' + `│  $savedoc ${name} <your text>\n`) +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 📂 *SaveDoc — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to create document.\n' +
                '│  Check bot data folder permissions.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $savedoc delete <name> ────────────────────────────────────────────
    if (sub === 'delete') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 📂 *SaveDoc — Delete* 」\n' +
                '│\n' +
                '│  *Usage:* $savedoc delete <name>\n' +
                '╰───────────────────────'
            );
        }
        if (readDoc(name) === null) {
            return reply(
                `╭─「 📂 *SaveDoc — Not Found* 」\n` +
                '│\n' +
                `│  No document named *${name}* exists.\n` +
                '│  Use $savedoc list to see all docs.\n' +
                '╰───────────────────────'
            );
        }
        try {
            deleteDoc(name);
            return reply(
                `╭─「 📂 *SaveDoc — Deleted* 」\n` +
                '│\n' +
                `│  🗑️ *${name}* has been permanently deleted.\n` +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 📂 *SaveDoc — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to delete the document.\n' +
                '│  Please try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $savedoc view <name>  /  $savedoc read <name> ────────────────────
    if (sub === 'view' || sub === 'read') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 📂 *SaveDoc — View* 」\n' +
                '│\n' +
                '│  *Usage:* $savedoc view <name>\n' +
                '╰───────────────────────'
            );
        }
        const content = readDoc(name);
        if (content === null) {
            return reply(
                `╭─「 📂 *SaveDoc — Not Found* 」\n` +
                '│\n' +
                `│  No document named *${name}* exists.\n` +
                `│  Create it: $savedoc new ${name}\n` +
                '╰───────────────────────'
            );
        }
        return reply(
            `╭─「 📄 *${name}* 」\n` +
            '│\n' +
            `${content.trim() ? content.trim().split('\n').map(l => `│  ${l}`).join('\n') : '│  _(empty document)_'}\n` +
            '╰───────────────────────'
        );
    }

    // ── $savedoc <name> <text>  — append text ─────────────────────────────
    const name = parts[0];
    const text = parts.slice(1).join(' ').trim();

    if (!validName(name)) {
        return reply(
            '╭─「 📂 *SaveDoc — Help* 」\n' +
            '│\n' +
            '│  Unknown subcommand or invalid name.\n' +
            '│\n' +
            '├─ *Available Commands:*\n' +
            '│  $savedoc list\n' +
            '│  $savedoc new <name>\n' +
            '│  $savedoc <name> <text>\n' +
            '│  $savedoc view <name>\n' +
            '│  $savedoc delete <name>\n' +
            '╰───────────────────────'
        );
    }

    if (!text) {
        // If replying to a message, use the quoted text as content to append
        const quotedText = getQuotedText(message);
        if (quotedText) {
            try {
                const existing  = readDoc(name);
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
                let newContent;
                if (existing === null) {
                    newContent = `# ${name}\n\n[${timestamp}]\n${quotedText}\n`;
                } else {
                    newContent = existing.trimEnd() + `\n\n[${timestamp}]\n${quotedText}\n`;
                }
                writeDoc(name, newContent);
                const isNew = existing === null;
                return reply(
                    `╭─「 📂 *SaveDoc — ${isNew ? 'Created & Saved' : 'Saved'}* 」\n` +
                    '│\n' +
                    `│  📄 Document: *${name}*\n` +
                    `│  🕐 ${timestamp}\n` +
                    '│\n' +
                    `│  ${quotedText}\n` +
                    '╰───────────────────────'
                );
            } catch {
                return reply(
                    '╭─「 📂 *SaveDoc — Error* 」\n' +
                    '│\n' +
                    '│  ⚠️ Failed to write to the document.\n' +
                    '│  Please try again.\n' +
                    '╰───────────────────────'
                );
            }
        }

        const content = readDoc(name);
        if (content === null) {
            return reply(
                `╭─「 📂 *SaveDoc — Not Found* 」\n` +
                '│\n' +
                `│  No document named *${name}* exists.\n` +
                `│  Create it: $savedoc new ${name}\n` +
                '╰───────────────────────'
            );
        }
        return reply(
            `╭─「 📄 *${name}* 」\n` +
            '│\n' +
            `${content.trim() ? content.trim().split('\n').map(l => `│  ${l}`).join('\n') : '│  _(empty document)_'}\n` +
            '╰───────────────────────'
        );
    }

    // Append text
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
        const isNew = existing === null;
        return reply(
            `╭─「 📂 *SaveDoc — ${isNew ? 'Created & Saved' : 'Saved'}* 」\n` +
            '│\n' +
            `│  📄 Document: *${name}*\n` +
            `│  🕐 ${timestamp}\n` +
            '│\n' +
            `│  ${text}\n` +
            '╰───────────────────────'
        );
    } catch {
        return reply(
            '╭─「 📂 *SaveDoc — Error* 」\n' +
            '│\n' +
            '│  ⚠️ Failed to write to the document.\n' +
            '│  Please try again.\n' +
            '╰───────────────────────'
        );
    }
}

module.exports = savedocCommand;
