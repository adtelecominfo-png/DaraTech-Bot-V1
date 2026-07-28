'use strict';
/**
 * curl.js
 * $curl <url> [-X METHOD] [-H "Key: Value"] [-d '{"body":"data"}']
 *
 * Make an HTTP request to any API and see:
 *   status · duration · response size · response headers · response body
 *
 * Examples:
 *   $curl https://api.example.com/endpoint
 *   $curl https://api.example.com/endpoint?apikey=abc123
 *   $curl https://api.example.com/data -H "Authorization: Bearer TOKEN"
 *   $curl https://api.example.com/post -X POST -d '{"name":"test"}'
 *   $curl https://api.example.com/post -X POST -H "Content-Type: application/json" -d '{"q":"hello"}'
 */

const axios = require('axios');

// Headers worth showing (filter noise)
const SHOW_HEADERS = new Set([
    'content-type', 'server', 'cache-control', 'x-powered-by',
    'cf-ray', 'x-ratelimit-limit', 'x-ratelimit-remaining',
    'x-ratelimit-reset', 'x-request-id', 'x-response-time',
    'access-control-allow-origin', 'vary', 'etag',
    'last-modified', 'content-encoding', 'transfer-encoding',
]);

const MAX_BODY_CHARS = 3000;

/** Parse -H "Key: Value" flags — handles multiple */
function parseHeaders(args) {
    const headers = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-H' && args[i + 1]) {
            const raw = args[i + 1].replace(/^["']|["']$/g, '');
            const colon = raw.indexOf(':');
            if (colon !== -1) {
                const key = raw.slice(0, colon).trim();
                const val = raw.slice(colon + 1).trim();
                headers[key] = val;
            }
            i++;
        }
    }
    return headers;
}

/** Parse -d '...' or -d {...} (body data) */
function parseBody(args) {
    const idx = args.indexOf('-d');
    if (idx === -1 || !args[idx + 1]) return null;
    return args[idx + 1].replace(/^["']|["']$/g, '');
}

/** Parse -X METHOD */
function parseMethod(args) {
    const idx = args.indexOf('-X');
    if (idx !== -1 && args[idx + 1]) return args[idx + 1].toUpperCase();
    return 'GET';
}

/** Tokenize respecting quoted strings */
function tokenize(str) {
    const tokens = [];
    let cur = '';
    let inQuote = null;
    for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if ((ch === '"' || ch === "'") && !inQuote) { inQuote = ch; cur += ch; }
        else if (ch === inQuote) { inQuote = null; cur += ch; }
        else if (ch === ' ' && !inQuote) { if (cur) { tokens.push(cur); cur = ''; } }
        else cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
}

/** Format bytes to human-readable */
function fmtSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Shorten content-type to a readable label e.g. "application/json" → "json" */
function shortContentType(ct) {
    if (!ct) return null;
    const base = ct.split(';')[0].trim().toLowerCase();
    const map = {
        'application/json': 'json', 'text/json': 'json',
        'text/html': 'html', 'text/plain': 'plain',
        'text/xml': 'xml', 'application/xml': 'xml',
        'application/javascript': 'js', 'text/javascript': 'js',
        'text/css': 'css', 'application/octet-stream': 'binary',
        'multipart/form-data': 'multipart',
        'application/x-www-form-urlencoded': 'form',
    };
    return map[base] || base.split('/').pop();
}

/** HTTP status emoji */
function statusEmoji(code) {
    if (code >= 500) return '🔴';
    if (code >= 400) return '🟠';
    if (code >= 300) return '🟡';
    if (code >= 200) return '🟢';
    return '⚪';
}

/** Pretty-print JSON or truncate raw text */
function formatBody(raw, contentType) {
    if (contentType?.includes('application/json') || contentType?.includes('text/json')) {
        try {
            const parsed = JSON.parse(raw);
            const pretty = JSON.stringify(parsed, null, 2);
            if (pretty.length > MAX_BODY_CHARS) {
                return pretty.slice(0, MAX_BODY_CHARS) + `\n… *(truncated)*`;
            }
            return pretty;
        } catch { /* fall through to raw */ }
    }
    const text = String(raw);
    if (text.length > MAX_BODY_CHARS) return text.slice(0, MAX_BODY_CHARS) + '\n… *(truncated)*';
    return text;
}

async function curlCommand(sock, chatId, message) {
    const text = message.message?.conversation
               || message.message?.extendedTextMessage?.text
               || '';

    // Strip command prefix, tokenize the rest
    const raw = text.replace(/^\$curl\s*/i, '').trim();
    if (!raw) {
        return sock.sendMessage(chatId, {
            text:
                `╭━━━「 🌐 *API TESTER — $curl* 」━━━\n` +
                `┃\n` +
                `┃ *Usage:*\n` +
                `┃ $curl <url>\n` +
                `┃ $curl <url> -H "Key: Value"\n` +
                `┃ $curl <url> -X POST -d '{"key":"val"}'\n` +
                `┃\n` +
                `┃ *Flags:*\n` +
                `┃ -X <METHOD>       GET POST PUT DELETE PATCH\n` +
                `┃ -H "Key: Value"   add request header (repeat for more)\n` +
                `┃ -d '<body>'       request body (JSON string etc)\n` +
                `┃\n` +
                `┃ *Examples:*\n` +
                `┃ $curl https://api.gifted.co.ke/api/alive\n` +
                `┃ $curl https://api.example.com/data?apikey=abc\n` +
                `┃ $curl https://api.example.com -H "Authorization: Bearer TOKEN"\n` +
                `┃ $curl https://api.example.com -X POST -d '{"q":"hello"}'\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    const tokens = tokenize(raw);
    // First token must be the URL
    let url = tokens[0];
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const flags   = tokens.slice(1);
    const method  = parseMethod(flags);
    const headers = parseHeaders(flags);
    const bodyStr = parseBody(flags);

    // Set Content-Type for JSON body if not already set
    if (bodyStr && !headers['Content-Type'] && !headers['content-type']) {
        try { JSON.parse(bodyStr); headers['Content-Type'] = 'application/json'; } catch {}
    }

    await sock.sendMessage(chatId,
        { text: `🌐 _Requesting_ *${method}* → \`${url}\`…` },
        { quoted: message });

    const start = Date.now();
    let response, errMsg;

    try {
        response = await axios({
            method,
            url,
            headers: {
                'User-Agent': 'Daratech-Bot/1.0 curl-tester',
                ...headers,
            },
            data: bodyStr || undefined,
            timeout: 25000,
            validateStatus: () => true,   // never throw on 4xx/5xx
            maxContentLength: 5 * 1024 * 1024,
            responseType: 'text',
            transformResponse: [(d) => d],  // keep raw string
        });
    } catch (err) {
        errMsg = err.message;
    }

    const duration = Date.now() - start;

    if (!response) {
        return sock.sendMessage(chatId, {
            text:
                `╭─── 🌐 *REQUEST* ───╮\n` +
                `│ ❌ *Failed*\n` +
                `│ ⏱️ Speed: ${duration} ms\n` +
                `│ ⚠️ ${errMsg}\n` +
                `╰────────────────────╯\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    const { status, statusText, headers: resHeaders, data: body } = response;
    const bodyStr2    = String(body || '');
    const sizeBytes   = Buffer.byteLength(bodyStr2, 'utf8');
    const contentType = resHeaders['content-type'] || '';

    // Compact header summary: "json | nginx" style
    const ctShort  = shortContentType(contentType);
    const server   = resHeaders['server'] || resHeaders['x-powered-by'] || null;
    const hdrParts = [ctShort, server].filter(Boolean).map(s => s.toLowerCase());
    const hdrLine  = hdrParts.length ? hdrParts.join(' | ') : 'none';

    const formattedBody = formatBody(bodyStr2, contentType);

    const out =
        `╭─── 🌐 *REQUEST* ───╮\n` +
        `│ ${statusEmoji(status)} *Status:* ${status} ${statusText || ''}\n` +
        `│ ⏱️ Speed: ${duration} ms | 📦 Size: ${fmtSize(sizeBytes)}\n` +
        `│ 📌 Headers: ${hdrLine}\n` +
        `╰────────────────────╯\n\n` +
        `\`\`\`\n${formattedBody}\n\`\`\`\n\n_Daratech_ ⚡`;

    await sock.sendMessage(chatId, { text: out }, { quoted: message });
}

module.exports = curlCommand;
