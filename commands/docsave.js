'use strict';

const https = require('https');

const REPO   = 'adtelecominfo-png/savedoc';
const BRANCH = 'main';
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

async function getFile(name) {
    const res = await ghRequest('GET', `/repos/${REPO}/contents/${name}.txt?ref=${BRANCH}`, null);
    return res.status === 200 ? res.data : null;
}
async function listFiles() {
    const res = await ghRequest('GET', `/repos/${REPO}/contents?ref=${BRANCH}`, null);
    return (res.status === 200 && Array.isArray(res.data)) ? res.data : [];
}
async function putFile(name, content, sha) {
    const body = {
        message: `docsave: ${sha ? 'update' : 'create'} ${name}.txt`,
        content: Buffer.from(content).toString('base64'),
        branch:  BRANCH,
        ...(sha ? { sha } : {}),
    };
    return ghRequest('PUT', `/repos/${REPO}/contents/${name}.txt`, body);
}
async function removeFile(name, sha) {
    return ghRequest('DELETE', `/repos/${REPO}/contents/${name}.txt`, {
        message: `docsave: delete ${name}.txt`, sha, branch: BRANCH,
    });
}

function validName(n) { return /^[a-zA-Z0-9_-]{1,40}$/.test(n); }

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

async function docsaveCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$docsave'.length).trim();

    // ── $docsave  /  $docsave list ────────────────────────────────────────
    if (!raw || raw === 'list') {
        try {
            const files = await listFiles();
            const docs  = files.filter(f => f.name.endsWith('.txt'));
            if (!docs.length) {
                return reply(
                    '╭─「 ☁️ *DocSave* 」\n' +
                    '│\n' +
                    '│  Your GitHub vault is empty.\n' +
                    '│\n' +
                    '├─ *Get started:*\n' +
                    '│  $docsave new <name>        → create a doc\n' +
                    '│  $docsave <name> <text>     → write to a doc\n' +
                    '╰───────────────────────'
                );
            }
            const list = docs.map((f, i) => `│  ${i + 1}. 📄 ${f.name.replace('.txt', '')}`).join('\n');
            return reply(
                `╭─「 ☁️ *DocSave* — ${docs.length} doc${docs.length > 1 ? 's' : ''} 」\n` +
                '│\n' +
                `${list}\n` +
                '│\n' +
                '├─ *Commands:*\n' +
                '│  $docsave <name> <text>     → append to a doc\n' +
                '│  $docsave view <name>       → read a doc\n' +
                '│  $docsave delete <name>     → delete a doc\n' +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 ☁️ *DocSave — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Could not reach GitHub. Check your\n' +
                '│  connection and try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    const parts = raw.split(' ');
    const sub   = parts[0].toLowerCase();

    // ── $docsave new <name> ───────────────────────────────────────────────
    if (sub === 'new') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 ☁️ *DocSave — New Doc* 」\n' +
                '│\n' +
                '│  Please provide a name for the document.\n' +
                '│\n' +
                '│  *Usage:* $docsave new <name>\n' +
                '│  *Rules:* letters, numbers, _ or - (max 40)\n' +
                '╰───────────────────────'
            );
        }
        if (!validName(name)) {
            return reply(
                '╭─「 ☁️ *DocSave — Invalid Name* 」\n' +
                '│\n' +
                `│  "${name}" is not a valid document name.\n` +
                '│\n' +
                '│  Only letters, numbers, underscores (_)\n' +
                '│  and hyphens (-) are allowed. Max 40 chars.\n' +
                '╰───────────────────────'
            );
        }
        try {
            if (await getFile(name)) {
                return reply(
                    `╭─「 ☁️ *DocSave — Already Exists* 」\n` +
                    '│\n' +
                    `│  A document named *${name}* already exists\n` +
                    '│  on GitHub.\n' +
                    '│\n' +
                    '├─ *What to do:*\n' +
                    `│  $docsave ${name} <text>   → write to it\n` +
                    `│  $docsave view ${name}     → read it\n` +
                    '╰───────────────────────'
                );
            }
            const quotedText = getQuotedText(message);
            const timestamp  = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
            const initContent = quotedText
                ? `# ${name}\n\n[${timestamp}]\n${quotedText}\n`
                : `# ${name}\n`;
            const res = await putFile(name, initContent);
            if (res.status === 201) {
                return reply(
                    `╭─「 ☁️ *DocSave — Created* 」\n` +
                    '│\n' +
                    `│  ✅ *${name}* has been created on GitHub.\n` +
                    (quotedText
                        ? `│\n│  📎 Saved quoted message:\n│  ${quotedText}\n`
                        : '│\n├─ *Next step:*\n' + `│  $docsave ${name} <your text>\n`) +
                    '╰───────────────────────'
                );
            }
            return reply(
                `╭─「 ☁️ *DocSave — Failed* 」\n` +
                '│\n' +
                `│  ⚠️ GitHub rejected the request.\n` +
                `│  Reason: ${res.data?.message || res.status}\n` +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 ☁️ *DocSave — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to create document on GitHub.\n' +
                '│  Please try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $docsave delete <name> ────────────────────────────────────────────
    if (sub === 'delete') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 ☁️ *DocSave — Delete* 」\n' +
                '│\n' +
                '│  *Usage:* $docsave delete <name>\n' +
                '╰───────────────────────'
            );
        }
        try {
            const file = await getFile(name);
            if (!file) {
                return reply(
                    `╭─「 ☁️ *DocSave — Not Found* 」\n` +
                    '│\n' +
                    `│  No document named *${name}* exists on GitHub.\n` +
                    '│  Use $docsave list to see all docs.\n' +
                    '╰───────────────────────'
                );
            }
            const res = await removeFile(name, file.sha);
            if (res.status === 200) {
                return reply(
                    `╭─「 ☁️ *DocSave — Deleted* 」\n` +
                    '│\n' +
                    `│  🗑️ *${name}* has been permanently removed\n` +
                    '│  from GitHub.\n' +
                    '╰───────────────────────'
                );
            }
            return reply(
                `╭─「 ☁️ *DocSave — Failed* 」\n` +
                '│\n' +
                `│  ⚠️ GitHub rejected the request.\n` +
                `│  Reason: ${res.data?.message || res.status}\n` +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 ☁️ *DocSave — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to delete document. Try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $docsave view <name>  /  $docsave read <name> ─────────────────────
    if (sub === 'view' || sub === 'read') {
        const name = parts[1];
        if (!name) {
            return reply(
                '╭─「 ☁️ *DocSave — View* 」\n' +
                '│\n' +
                '│  *Usage:* $docsave view <name>\n' +
                '╰───────────────────────'
            );
        }
        try {
            const file = await getFile(name);
            if (!file) {
                return reply(
                    `╭─「 ☁️ *DocSave — Not Found* 」\n` +
                    '│\n' +
                    `│  No document named *${name}* exists on GitHub.\n` +
                    `│  Create it: $docsave new ${name}\n` +
                    '╰───────────────────────'
                );
            }
            const content = Buffer.from(file.content, 'base64').toString('utf8').trim();
            return reply(
                `╭─「 📄 *${name}* 」\n` +
                '│\n' +
                `${content ? content.split('\n').map(l => `│  ${l}`).join('\n') : '│  _(empty document)_'}\n` +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 ☁️ *DocSave — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to read document from GitHub.\n' +
                '│  Please try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $docsave <name> <text>  — append text ─────────────────────────────
    const name = parts[0];
    const text = parts.slice(1).join(' ').trim();

    if (!validName(name)) {
        return reply(
            '╭─「 ☁️ *DocSave — Help* 」\n' +
            '│\n' +
            '│  Unknown subcommand or invalid name.\n' +
            '│\n' +
            '├─ *Available Commands:*\n' +
            '│  $docsave list\n' +
            '│  $docsave new <name>\n' +
            '│  $docsave <name> <text>\n' +
            '│  $docsave view <name>\n' +
            '│  $docsave delete <name>\n' +
            '╰───────────────────────'
        );
    }

    if (!text) {
        // If replying to a message, use the quoted text as content to append
        const quotedText = getQuotedText(message);
        if (quotedText) {
            try {
                const file      = await getFile(name);
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
                let newContent, sha;
                if (!file) {
                    newContent = `# ${name}\n\n[${timestamp}]\n${quotedText}\n`;
                } else {
                    sha = file.sha;
                    newContent = Buffer.from(file.content, 'base64').toString('utf8').trimEnd() + `\n\n[${timestamp}]\n${quotedText}\n`;
                }
                const res = await putFile(name, newContent, sha);
                if (res.status === 200 || res.status === 201) {
                    const isNew = !file;
                    return reply(
                        `╭─「 ☁️ *DocSave — ${isNew ? 'Created & Saved' : 'Saved'}* 」\n` +
                        '│\n' +
                        `│  📄 Document: *${name}*\n` +
                        `│  🕐 ${timestamp}\n` +
                        '│\n' +
                        `│  ${quotedText}\n` +
                        '╰───────────────────────'
                    );
                }
                return reply(
                    `╭─「 ☁️ *DocSave — Failed* 」\n` +
                    '│\n' +
                    `│  ⚠️ GitHub rejected the request.\n` +
                    `│  Reason: ${res.data?.message || res.status}\n` +
                    '╰───────────────────────'
                );
            } catch {
                return reply(
                    '╭─「 ☁️ *DocSave — Error* 」\n' +
                    '│\n' +
                    '│  ⚠️ Failed to write to document. Try again.\n' +
                    '╰───────────────────────'
                );
            }
        }

        try {
            const file = await getFile(name);
            if (!file) {
                return reply(
                    `╭─「 ☁️ *DocSave — Not Found* 」\n` +
                    '│\n' +
                    `│  No document named *${name}* exists on GitHub.\n` +
                    `│  Create it: $docsave new ${name}\n` +
                    '╰───────────────────────'
                );
            }
            const content = Buffer.from(file.content, 'base64').toString('utf8').trim();
            return reply(
                `╭─「 📄 *${name}* 」\n` +
                '│\n' +
                `${content ? content.split('\n').map(l => `│  ${l}`).join('\n') : '│  _(empty document)_'}\n` +
                '╰───────────────────────'
            );
        } catch {
            return reply(
                '╭─「 ☁️ *DocSave — Error* 」\n' +
                '│\n' +
                '│  ⚠️ Failed to read document. Try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // Append text
    try {
        const file      = await getFile(name);
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
        let newContent, sha;

        if (!file) {
            newContent = `# ${name}\n\n[${timestamp}]\n${text}\n`;
        } else {
            sha = file.sha;
            newContent = Buffer.from(file.content, 'base64').toString('utf8').trimEnd() + `\n\n[${timestamp}]\n${text}\n`;
        }

        const res = await putFile(name, newContent, sha);
        if (res.status === 200 || res.status === 201) {
            const isNew = !file;
            return reply(
                `╭─「 ☁️ *DocSave — ${isNew ? 'Created & Saved' : 'Saved'}* 」\n` +
                '│\n' +
                `│  📄 Document: *${name}*\n` +
                `│  🕐 ${timestamp}\n` +
                '│\n' +
                `│  ${text}\n` +
                '╰───────────────────────'
            );
        }
        return reply(
            `╭─「 ☁️ *DocSave — Failed* 」\n` +
            '│\n' +
            `│  ⚠️ GitHub rejected the request.\n` +
            `│  Reason: ${res.data?.message || res.status}\n` +
            '╰───────────────────────'
        );
    } catch {
        return reply(
            '╭─「 ☁️ *DocSave — Error* 」\n' +
            '│\n' +
            '│  ⚠️ Failed to write to document. Try again.\n' +
            '╰───────────────────────'
        );
    }
}

module.exports = docsaveCommand;
