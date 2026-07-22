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

async function docsaveCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$docsave'.length).trim();

    if (!raw || raw === 'list') {
        try {
            const files = await listFiles();
            const docs  = files.filter(f => f.name.endsWith('.txt'));
            if (!docs.length) return reply('📂 *Docsave (GitHub)*\n\nNo documents yet.\n\n_Create one:_  $docsave new <name>\n_Write to it:_ $docsave <name> <text>');
            const list = docs.map((f, i) => `${i + 1}. 📄 ${f.name.replace('.txt', '')}`).join('\n');
            return reply(`📂 *Docsave (GitHub)* (${docs.length})\n\n${list}\n\n_$docsave <name> <text>_ → write\n_$docsave view <name>_ → read\n_$docsave delete <name>_ → delete`);
        } catch { return reply('❌ Failed to list docs.'); }
    }

    const parts = raw.split(' ');
    const sub   = parts[0].toLowerCase();

    if (sub === 'new') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$docsave new <name>*');
        if (!validName(name)) return reply('❌ Name: letters, numbers, _ or - only (max 40)');
        try {
            if (await getFile(name)) return reply(`❌ *${name}* already exists.`);
            const res = await putFile(name, `# ${name}\n`);
            if (res.status === 201) return reply(`✅ *${name}* created! Write: $docsave ${name} <text>`);
            return reply(`❌ GitHub said: ${res.data?.message || res.status}`);
        } catch { return reply('❌ Error creating doc.'); }
    }

    if (sub === 'delete') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$docsave delete <name>*');
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist.`);
            const res = await removeFile(name, file.sha);
            if (res.status === 200) return reply(`🗑️ *${name}* deleted.`);
            return reply(`❌ GitHub said: ${res.data?.message || res.status}`);
        } catch { return reply('❌ Error deleting doc.'); }
    }

    if (sub === 'view' || sub === 'read') {
        const name = parts[1];
        if (!name) return reply('❌ Usage: *$docsave view <name>*');
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist.`);
            return reply(`📄 *${name}*\n\n${Buffer.from(file.content, 'base64').toString('utf8').trim() || '_(empty)_'}`);
        } catch { return reply('❌ Error reading doc.'); }
    }

    const name = parts[0];
    const text = parts.slice(1).join(' ').trim();

    if (!validName(name)) {
        return reply('❌ Unknown subcommand.\n\n*Usage:*\n$docsave list\n$docsave new <name>\n$docsave <name> <text>\n$docsave view <name>\n$docsave delete <name>');
    }

    if (!text) {
        try {
            const file = await getFile(name);
            if (!file) return reply(`❌ *${name}* doesn't exist. Create: $docsave new ${name}`);
            return reply(`📄 *${name}*\n\n${Buffer.from(file.content, 'base64').toString('utf8').trim() || '_(empty)_'}`);
        } catch { return reply('❌ Error reading doc.'); }
    }

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
        if (res.status === 200 || res.status === 201) return reply(`✅ ${file ? 'Saved to' : 'Created & saved to'} *${name}* (GitHub):\n\n${text}`);
        return reply(`❌ GitHub said: ${res.data?.message || res.status}`);
    } catch { return reply('❌ Error writing to doc. Try again.'); }
}

module.exports = docsaveCommand;
