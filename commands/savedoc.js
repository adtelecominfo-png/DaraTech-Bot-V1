'use strict';

const https = require('https');

const REPO        = 'adtelecominfo-png/DaraTech-Bot-V1';
const BRANCH      = 'main';
const DOCS_FOLDER = 'savedocs';

// ─── GitHub API helper ────────────────────────────────────────────────────────
function ghRequest(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
        const data  = body ? JSON.stringify(body) : null;
        const opts  = {
            hostname: 'api.github.com',
            path:     urlPath,
            method,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept':        'application/vnd.github+json',
                'User-Agent':    'DaraTech-Bot',
                'Content-Type':  'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
            },
        };
        const req = https.request(opts, (res) => {
            let raw = '';
            res.on('data', chunk => raw += chunk);
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

// ─── GitHub file helpers ──────────────────────────────────────────────────────
async function getFile(name) {
    const res = await ghRequest('GET', `/repos/${REPO}/contents/${DOCS_FOLDER}/${name}.txt?ref=${BRANCH}`, null);
    return res.status === 200 ? res.data : null;
}

async function listFiles() {
    const res = await ghRequest('GET', `/repos/${REPO}/contents/${DOCS_FOLDER}?ref=${BRANCH}`, null);
    return (res.status === 200 && Array.isArray(res.data)) ? res.data : [];
}

async function putFile(name, content, sha) {
    const body = {
        message: `savedoc: ${sha ? 'update' : 'create'} ${name}.txt`,
        content: Buffer.from(content).toString('base64'),
        branch:  BRANCH,
        ...(sha ? { sha } : {}),
    };
    return ghRequest('PUT', `/repos/${REPO}/contents/${DOCS_FOLDER}/${name}.txt`, body);
}

async function removeFile(name, sha) {
    const body = {
        message: `savedoc: delete ${name}.txt`,
        sha,
        branch: BRANCH,
    };
    return ghRequest('DELETE', `/repos/${REPO}/contents/${DOCS_FOLDER}/${name}.txt`, body);
}

// ─── Validate doc name ────────────────────────────────────────────────────────
function validName(name) { return /^[a-zA-Z0-9_-]{1,40}$/.test(name); }

// ─── Main command ─────────────────────────────────────────────────────────────
async function savedocCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$savedoc'.length).trim();

    // ── $savedoc  /  $savedoc list ─────────────────────────────────────────
    if (!raw || raw === 'list') {
        try {
            const files = await listFiles();
            const docs  = files.filter(f => f.name.endsWith('.txt'));
            if (!docs.length) {
                return reply(
                    '📂 *Saved Docs*\n\n' +
                    'No documents yet.\n\n' +
                    '_Create one:_  $savedoc new <name>\n' +
                    '_Write to it:_ $savedoc <name> <text>'
                );
            }
            const list = docs.map((f, i) => `${i + 1}. 📄 ${f.name.replace('.txt', '')}`).join('\n');
            return reply(
                `📂 *Saved Docs* (${docs.length})\n\n${list}\n\n` +
                '_$savedoc <name> <text>_ → write\n' +
                '_$savedoc view <name>_   → read\n' +
                '_$savedoc delete <name>_ → delete'
            );
        } catch {
            return reply('❌ Failed to list docs. Is the GitHub token set?');
        }
    }

    const parts = raw.split(' ');
    const sub   = parts[0].toLowerCase();

    // ── $savedoc new <name> ────────────────────────────────────────────────
    if (sub === 'new') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc new <name>*\nName must be letters, numbers, _ or -');
        if (!validName(name)) return reply('❌ Name can only use letters, numbers, _ and - (max 40 chars)');
        try {
            const existing = await getFile(name);
            if (existing) return reply(`❌ *${name}* already exists.\n\nWrite to it: $savedoc ${name} <text>\nRead it: $savedoc view ${name}`);
            const res = await putFile(name, `# ${name}\n`);
            if (res.status === 201) return reply(`✅ *${name}* created!\n\nWrite to it:\n$savedoc ${name} <your text here>`);
            return reply(`❌ Couldn't create doc. GitHub said: ${res.data?.message || res.status}`);
        } catch {
            return reply('❌ Error creating doc. Try again.');
        }
    }

    // ── $savedoc delete <name> ─────────────────────────────────────────────
    if (sub === 'delete') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc delete <name>*');
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist.`);
            const res = await removeFile(name, file.sha);
            if (res.status === 200) return reply(`🗑️ *${name}* deleted.`);
            return reply(`❌ Couldn't delete. GitHub said: ${res.data?.message || res.status}`);
        } catch {
            return reply('❌ Error deleting doc. Try again.');
        }
    }

    // ── $savedoc view <name>  /  $savedoc read <name> ─────────────────────
    if (sub === 'view' || sub === 'read') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$savedoc view <name>*');
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist.\nCreate it: $savedoc new ${name}`);
            const content = Buffer.from(file.content, 'base64').toString('utf8');
            return reply(`📄 *${name}*\n\n${content.trim() || '_(empty)_'}`);
        } catch {
            return reply('❌ Error reading doc.');
        }
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
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist.\nCreate it: $savedoc new ${name}`);
            const content = Buffer.from(file.content, 'base64').toString('utf8');
            return reply(`📄 *${name}*\n\n${content.trim() || '_(empty)_'}`);
        } catch {
            return reply('❌ Error reading doc.');
        }
    }

    // Append text — auto-create doc if it doesn't exist yet
    try {
        const file      = await getFile(name);
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

        let newContent;
        let sha;

        if (!file) {
            // Auto-create
            newContent = `# ${name}\n\n[${timestamp}]\n${text}\n`;
        } else {
            const existing = Buffer.from(file.content, 'base64').toString('utf8');
            sha        = file.sha;
            newContent = existing.trimEnd() + `\n\n[${timestamp}]\n${text}\n`;
        }

        const res = await putFile(name, newContent, sha);
        if (res.status === 200 || res.status === 201) {
            const action = file ? 'Saved to' : 'Created & saved to';
            return reply(`✅ ${action} *${name}*:\n\n${text}`);
        }
        return reply(`❌ Couldn't save. GitHub said: ${res.data?.message || res.status}`);
    } catch {
        return reply('❌ Error writing to doc. Try again.');
    }
}

module.exports = savedocCommand;
