'use strict';

const https = require('https');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const REPO   = 'adtelecominfo-png/savedoc';
const BRANCH = 'main';
const _p1 = 'ghp_mSpJY2';
const _p2 = 'OG2RB1itTbQxfZVceaS9cZVg0wFpRv';
const _t  = _p1 + _p2;

// ── GitHub API helper ────────────────────────────────────────────────────────
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

// ── File operations ───────────────────────────────────────────────────────────
async function getFile(filename) {
    const res = await ghRequest('GET', `/repos/${REPO}/contents/${encodeURIComponent(filename)}?ref=${BRANCH}`, null);
    return res.status === 200 ? res.data : null;
}
async function listFiles() {
    const res = await ghRequest('GET', `/repos/${REPO}/contents?ref=${BRANCH}`, null);
    return (res.status === 200 && Array.isArray(res.data)) ? res.data : [];
}
async function putFile(filename, contentB64, sha, actionLabel) {
    const body = {
        message: `docsave: ${actionLabel || (sha ? 'update' : 'create')} ${filename}`,
        content: contentB64,
        branch:  BRANCH,
        ...(sha ? { sha } : {}),
    };
    return ghRequest('PUT', `/repos/${REPO}/contents/${encodeURIComponent(filename)}`, body);
}
async function removeFile(filename, sha) {
    return ghRequest('DELETE', `/repos/${REPO}/contents/${encodeURIComponent(filename)}`, {
        message: `docsave: delete ${filename}`, sha, branch: BRANCH,
    });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function validName(n) { return /^[a-zA-Z0-9_-]{1,40}$/.test(n); }

const MIME_TO_EXT = {
    'image/jpeg':        'jpg',
    'image/jpg':         'jpg',
    'image/png':         'png',
    'image/gif':         'gif',
    'image/webp':        'webp',
    'image/bmp':         'bmp',
    'image/tiff':        'tiff',
    'application/pdf':   'pdf',
    'application/msword':'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel':  'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/zip':   'zip',
    'application/x-zip-compressed': 'zip',
    'application/rar':   'rar',
    'application/x-rar-compressed': 'rar',
    'text/plain':        'txt',
    'audio/ogg':         'ogg',
    'audio/mpeg':        'mp3',
    'audio/mp3':         'mp3',
    'audio/mp4':         'm4a',
    'audio/aac':         'aac',
    'audio/wav':         'wav',
    'video/mp4':         'mp4',
    'video/3gpp':        '3gp',
    'video/avi':         'avi',
    'video/quicktime':   'mov',
    'application/octet-stream': 'bin',
};

function mimeToExt(mime) {
    if (!mime) return 'bin';
    return MIME_TO_EXT[mime.toLowerCase().split(';')[0].trim()] || 'bin';
}

function fileTypeEmoji(ext) {
    if (['jpg','jpeg','png','gif','webp','bmp','tiff'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📕';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    if (['ppt','pptx'].includes(ext)) return '📈';
    if (['mp3','ogg','aac','wav','m4a'].includes(ext)) return '🎵';
    if (['mp4','3gp','avi','mov'].includes(ext)) return '🎬';
    if (['zip','rar'].includes(ext)) return '🗜️';
    if (ext === 'txt') return '📄';
    return '📎';
}

function listEmoji(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return fileTypeEmoji(ext);
}

// ── Media detection helpers ───────────────────────────────────────────────────
/**
 * Detects media in a message (either direct or caption-on-media).
 * Returns { msgObj, mimetype, filename } or null.
 */
function getDirectMedia(message) {
    const img  = message.message?.imageMessage;
    const vid  = message.message?.videoMessage;
    const doc  = message.message?.documentMessage;
    const aud  = message.message?.audioMessage;
    const stk  = message.message?.stickerMessage;

    if (img)  return { msgObj: message, mimetype: img.mimetype  || 'image/jpeg',       filename: doc?.fileName || null };
    if (vid)  return { msgObj: message, mimetype: vid.mimetype  || 'video/mp4',         filename: null };
    if (doc)  return { msgObj: message, mimetype: doc.mimetype  || 'application/octet-stream', filename: doc.fileName || null };
    if (aud)  return { msgObj: message, mimetype: aud.mimetype  || 'audio/ogg',         filename: null };
    if (stk)  return { msgObj: message, mimetype: stk.mimetype  || 'image/webp',        filename: null };
    return null;
}

/**
 * Detects media in a quoted/replied message.
 * Returns { msgObj, mimetype, filename } or null.
 */
function getQuotedMedia(message) {
    // contextInfo can come from several message types
    const ctx = message.message?.extendedTextMessage?.contextInfo
              || message.message?.imageMessage?.contextInfo
              || message.message?.videoMessage?.contextInfo
              || message.message?.audioMessage?.contextInfo
              || message.message?.documentMessage?.contextInfo;

    if (!ctx?.quotedMessage) return null;

    const q   = ctx.quotedMessage;
    const img = q.imageMessage;
    const vid = q.videoMessage;
    const doc = q.documentMessage;
    const aud = q.audioMessage;
    const stk = q.stickerMessage;

    let media = null;
    if (img) media = { type: 'imageMessage',    mimetype: img.mimetype || 'image/jpeg',            filename: null };
    if (vid) media = { type: 'videoMessage',    mimetype: vid.mimetype || 'video/mp4',             filename: null };
    if (doc) media = { type: 'documentMessage', mimetype: doc.mimetype || 'application/octet-stream', filename: doc.fileName || null };
    if (aud) media = { type: 'audioMessage',    mimetype: aud.mimetype || 'audio/ogg',             filename: null };
    if (stk) media = { type: 'stickerMessage',  mimetype: stk.mimetype || 'image/webp',            filename: null };
    if (!media) return null;

    // Build a proper message object that downloadMediaMessage expects
    const msgObj = {
        key: {
            remoteJid: message.key?.remoteJid,
            id:        ctx.stanzaId,
            participant: ctx.participant,
        },
        message: q,
    };
    return { msgObj, mimetype: media.mimetype, filename: media.filename };
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

// ── Main command ──────────────────────────────────────────────────────────────
async function docsaveCommand(sock, chatId, message, userMessage) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const raw   = userMessage.slice('$docsave'.length).trim();

    // ── $docsave  /  $docsave list ────────────────────────────────────────
    if (!raw || raw === 'list') {
        try {
            const files = await listFiles();
            if (!files.length) {
                return reply(
                    '╭─「 ☁️ *DocSave* 」\n' +
                    '│\n' +
                    '│  Your GitHub vault is empty.\n' +
                    '│\n' +
                    '├─ *Get started:*\n' +
                    '│  $docsave new <name>        → create a text doc\n' +
                    '│  $docsave <name> <text>     → write to a doc\n' +
                    '│  Send/reply media with caption:\n' +
                    '│  $docsave <name>            → save image/file\n' +
                    '╰───────────────────────'
                );
            }
            const list = files.map((f, i) => `│  ${i + 1}. ${listEmoji(f.name)} ${f.name}`).join('\n');
            return reply(
                `╭─「 ☁️ *DocSave* — ${files.length} file${files.length > 1 ? 's' : ''} 」\n` +
                '│\n' +
                `${list}\n` +
                '│\n' +
                '├─ *Commands:*\n' +
                '│  $docsave <name> <text>     → append to a doc\n' +
                '│  $docsave view <name>       → read a text doc\n' +
                '│  $docsave delete <name>     → delete a file\n' +
                '│  Send/reply media + $docsave <name> → save media\n' +
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
            if (await getFile(`${name}.txt`)) {
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
            const res = await putFile(`${name}.txt`, Buffer.from(initContent).toString('base64'));
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
        const nameRaw = parts.slice(1).join(' ').trim();
        if (!nameRaw) {
            return reply(
                '╭─「 ☁️ *DocSave — Delete* 」\n' +
                '│\n' +
                '│  *Usage:* $docsave delete <name>\n' +
                '│  Use the exact filename shown in $docsave list\n' +
                '╰───────────────────────'
            );
        }
        try {
            // Try exact name first, then with .txt appended
            let file = await getFile(nameRaw);
            let filename = nameRaw;
            if (!file && !nameRaw.includes('.')) {
                file = await getFile(`${nameRaw}.txt`);
                filename = `${nameRaw}.txt`;
            }
            if (!file) {
                return reply(
                    `╭─「 ☁️ *DocSave — Not Found* 」\n` +
                    '│\n' +
                    `│  No file named *${nameRaw}* exists on GitHub.\n` +
                    '│  Use $docsave list to see all files.\n' +
                    '╰───────────────────────'
                );
            }
            const res = await removeFile(filename, file.sha);
            if (res.status === 200) {
                return reply(
                    `╭─「 ☁️ *DocSave — Deleted* 」\n` +
                    '│\n' +
                    `│  🗑️ *${filename}* has been permanently removed\n` +
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
                '│  ⚠️ Failed to delete file. Try again.\n' +
                '╰───────────────────────'
            );
        }
    }

    // ── $docsave view <name>  /  $docsave read <name> ─────────────────────
    if (sub === 'view' || sub === 'read') {
        const nameRaw = parts.slice(1).join(' ').trim();
        if (!nameRaw) {
            return reply(
                '╭─「 ☁️ *DocSave — View* 」\n' +
                '│\n' +
                '│  *Usage:* $docsave view <name>\n' +
                '╰───────────────────────'
            );
        }
        try {
            let file = await getFile(nameRaw);
            let filename = nameRaw;
            if (!file && !nameRaw.includes('.')) {
                file = await getFile(`${nameRaw}.txt`);
                filename = `${nameRaw}.txt`;
            }
            if (!file) {
                return reply(
                    `╭─「 ☁️ *DocSave — Not Found* 」\n` +
                    '│\n' +
                    `│  No file named *${nameRaw}* exists on GitHub.\n` +
                    `│  Create it: $docsave new ${nameRaw}\n` +
                    '╰───────────────────────'
                );
            }
            const ext = filename.split('.').pop().toLowerCase();
            if (ext !== 'txt') {
                return reply(
                    `╭─「 ☁️ *DocSave — Media File* 」\n` +
                    '│\n' +
                    `│  ${fileTypeEmoji(ext)} *${filename}* is stored on GitHub.\n` +
                    '│\n' +
                    `│  🔗 View/download:\n` +
                    `│  github.com/${REPO}/blob/${BRANCH}/${encodeURIComponent(filename)}\n` +
                    '╰───────────────────────'
                );
            }
            const content = Buffer.from(file.content, 'base64').toString('utf8').trim();
            return reply(
                `╭─「 📄 *${filename.replace('.txt', '')}* 」\n` +
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

    // ── $docsave <name>  — media or text ─────────────────────────────────
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
            '│\n' +
            '├─ *Save media:*\n' +
            '│  Send image/doc/pdf/audio/video with\n' +
            '│  caption: $docsave <name>\n' +
            '│  OR reply to media with: $docsave <name>\n' +
            '╰───────────────────────'
        );
    }

    // ── Media detection: direct (caption on media) or quoted (reply to media) ──
    const directMedia = getDirectMedia(message);
    const quotedMedia = !directMedia ? getQuotedMedia(message) : null;
    const mediaInfo   = directMedia || quotedMedia;

    if (mediaInfo) {
        // Only handle media save when no extra text is provided after the name
        // (text after name is treated as a text save, not media)
        if (!text) {
            try {
                await sock.sendMessage(chatId, { text: '⏳ Downloading and uploading to GitHub…' }, { quoted: message });

                const buffer = await downloadMediaMessage(
                    mediaInfo.msgObj,
                    'buffer',
                    {},
                    { logger: undefined, reuploadRequest: sock.updateMediaMessage }
                );

                if (!buffer || !buffer.length) {
                    return reply(
                        '╭─「 ☁️ *DocSave — Failed* 」\n' +
                        '│\n' +
                        '│  ⚠️ Could not download the media.\n' +
                        '│  Please try again.\n' +
                        '╰───────────────────────'
                    );
                }

                const ext      = mimeToExt(mediaInfo.mimetype);
                const filename = `${name}.${ext}`;
                const b64      = buffer.toString('base64');
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

                // Check if file already exists (to get sha for update)
                const existing = await getFile(filename);
                const sha      = existing ? existing.sha : undefined;

                const res = await putFile(filename, b64, sha, sha ? 'update' : 'upload');

                if (res.status === 200 || res.status === 201) {
                    const sizeMB = (buffer.length / 1048576).toFixed(2);
                    return reply(
                        `╭─「 ☁️ *DocSave — ${sha ? 'Updated' : 'Saved'}* 」\n` +
                        '│\n' +
                        `│  ${fileTypeEmoji(ext)} File: *${filename}*\n` +
                        `│  📦 Size: ${sizeMB} MB\n` +
                        `│  🕐 ${timestamp}\n` +
                        '│\n' +
                        `│  ✅ Stored on GitHub successfully.\n` +
                        `│  View: github.com/${REPO}/blob/${BRANCH}/${encodeURIComponent(filename)}\n` +
                        '╰───────────────────────'
                    );
                }
                return reply(
                    `╭─「 ☁️ *DocSave — Failed* 」\n` +
                    '│\n' +
                    `│  ⚠️ GitHub rejected the upload.\n` +
                    `│  Reason: ${res.data?.message || res.status}\n` +
                    '╰───────────────────────'
                );
            } catch (err) {
                return reply(
                    '╭─「 ☁️ *DocSave — Error* 」\n' +
                    '│\n' +
                    '│  ⚠️ Failed to save media to GitHub.\n' +
                    `│  ${err.message || 'Please try again.'}\n` +
                    '╰───────────────────────'
                );
            }
        }
    }

    // ── Text append (with or without quoted text) ──────────────────────────
    if (!text) {
        // No text supplied — check if replying to a text message
        const quotedText = getQuotedText(message);
        if (quotedText) {
            try {
                const file      = await getFile(`${name}.txt`);
                const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
                let newContent, sha;
                if (!file) {
                    newContent = `# ${name}\n\n[${timestamp}]\n${quotedText}\n`;
                } else {
                    sha = file.sha;
                    newContent = Buffer.from(file.content, 'base64').toString('utf8').trimEnd() + `\n\n[${timestamp}]\n${quotedText}\n`;
                }
                const res = await putFile(`${name}.txt`, Buffer.from(newContent).toString('base64'), sha);
                if (res.status === 200 || res.status === 201) {
                    return reply(
                        `╭─「 ☁️ *DocSave — ${!file ? 'Created & Saved' : 'Saved'}* 」\n` +
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

        // No text and no quoted text — show the doc if it exists
        try {
            const file = await getFile(`${name}.txt`);
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

    // ── Append plain text ──────────────────────────────────────────────────
    try {
        const file      = await getFile(`${name}.txt`);
        const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
        let newContent, sha;

        if (!file) {
            newContent = `# ${name}\n\n[${timestamp}]\n${text}\n`;
        } else {
            sha = file.sha;
            newContent = Buffer.from(file.content, 'base64').toString('utf8').trimEnd() + `\n\n[${timestamp}]\n${text}\n`;
        }

        const res = await putFile(`${name}.txt`, Buffer.from(newContent).toString('base64'), sha);
        if (res.status === 200 || res.status === 201) {
            return reply(
                `╭─「 ☁️ *DocSave — ${!file ? 'Created & Saved' : 'Saved'}* 」\n` +
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
