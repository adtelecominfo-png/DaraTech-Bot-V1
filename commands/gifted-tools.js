'use strict';
/**
 * gifted-tools.js — Gifted API Tools commands
 * Base: https://api.gifted.co.ke/api/tools/<endpoint>
 *
 * Confirmed working endpoints:
 *   ttp       → image_url (text to picture)
 *   canvas    → binary PNG (Spotify-style card)
 *   topdf     → binary PDF (text or URL → PDF document)
 *   web2zip   → result.download_url (archive a website as ZIP)
 *   proxy     → results[] (fresh working proxy list)
 *   encrypt   → encrypted_code (JS code obfuscator)
 *   dns-check → result.records[] (DNS records lookup)
 *   http-headers → result string (raw HTTP response headers)
 *   server-check → result.status / result.http_code (server uptime)
 *   ssphone   → binary JPEG (mobile-viewport screenshot)
 *   sstab     → binary JPEG (tablet-viewport screenshot)
 *   sspc      → binary JPEG (desktop-viewport screenshot)
 */

const { toolsGet, toolsBuf } = require('../lib/gifted');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { UploadFileUgu } = require('../lib/uploader');
const fs   = require('fs');
const path = require('path');

// ─── Shared helpers ──────────────────────────────────────────────────────────

function getQ(message) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } });
    } catch (_) {}
}

/** React with ⏳ AND send a "processing…" text so the user sees immediate feedback */
async function processing(sock, message, chatId, text) {
    await react(sock, message, '⏳');
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Image Tools ─────────────────────────────────────────────────────────────

/** $ttp <text> — text to picture image */
async function ttpCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, { text: '🖼️ Usage: $ttp <text>\nExample: $ttp Hello World' }, { quoted: message });
    await processing(sock, message, chatId, '🖼️ Generating image……');
    try {
        const data = await toolsGet('ttp', { text: q });
        const imageUrl = data?.image_url || data?.result?.image_url || data?.url;
        if (!imageUrl) throw new Error(data?.message || data?.error || 'No image returned');
        const imgRes = await require('axios').get(imageUrl, {
            responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption: `🖼️ *TEXT TO IMAGE*\n"${q}"\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:ttp]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Text to image failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $canvas <title> — Spotify-style canvas card image */
const CANVAS_TYPES = [
    'spotify', 'youtube', 'google', 'tiktok', 'duckduckgo', 'brave',
    'applemusic', 'soundcloud', 'pinterest', 'playstore', 'happymod',
    'apkpure', 'unsplash', 'wallpaper', 'wattpad', 'weather',
    'sticker', 'lyrics', 'shazam', 'web', 'image',
];

async function canvasCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: `🎨 *CANVAS CARD*\n\n` +
              `Usage: *$canvas <type> <title>*\n` +
              `Example: *$canvas spotify Blinding Lights - The Weeknd*\n` +
              `Example: *$canvas youtube Lo-fi Hip Hop Mix*\n\n` +
              `*Available types:*\n${CANVAS_TYPES.join(', ')}`,
    }, { quoted: message });

    const parts = q.split(' ');
    const firstWord = parts[0].toLowerCase();
    let type, title;
    if (CANVAS_TYPES.includes(firstWord)) {
        type  = firstWord;
        title = parts.slice(1).join(' ');
    } else {
        type  = 'spotify';
        title = q;
    }

    if (!title) return sock.sendMessage(chatId, {
        text: `❌ Please provide a title after the type.\nExample: *$canvas ${type} Your Title Here*`,
    }, { quoted: message });

    await processing(sock, message, chatId, '🎨 Creating canvas card……');
    try {
        const buf = await toolsBuf('canvas', { title, type, text: 'Now Playing', watermark: 'Daratech' });
        if (buf.length < 200) throw new Error('Canvas generation failed');
        await sock.sendMessage(chatId, {
            image: buf,
            caption: `🎨 *CANVAS CARD* [${type.toUpperCase()}]\n${title}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:canvas]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Canvas card failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Document Tools ──────────────────────────────────────────────────────────

/** $topdf <text or url> — generate a PDF document */
async function topdfCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '📄 Usage: $topdf <text or URL>\nExample: $topdf https://example.com\nExample: $topdf This is my document content',
    }, { quoted: message });
    await processing(sock, message, chatId, '📄 Generating PDF……');
    try {
        const buf = await toolsBuf('topdf', { query: q });
        if (buf.length < 100) throw new Error('PDF generation failed — try a different input');
        const label = q.startsWith('http') ? q : (q.slice(0, 50) + (q.length > 50 ? '…' : ''));
        await sock.sendMessage(chatId, {
            document: buf,
            mimetype: 'application/pdf',
            fileName: 'daratech-document.pdf',
            caption: `📄 *PDF GENERATED*\n${label}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:topdf]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ PDF generation failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Web Tools ────────────────────────────────────────────────────────────────

/** $web2zip <url> — download a website as a ZIP archive */
async function web2zipCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q || !q.startsWith('http')) return sock.sendMessage(chatId, {
        text: '🗜️ Usage: $web2zip <url>\nExample: $web2zip https://example.com',
    }, { quoted: message });
    await processing(sock, message, chatId, '🗜️ Archiving website……');
    try {
        const data = await toolsGet('web2zip', { url: q }, 60000);
        if (!data?.success || !data?.result?.download_url) throw new Error(data?.message || 'Failed to archive website');
        const r = data.result;
        const txt =
            `🗜️ *WEBSITE → ZIP*\n\n` +
            `▸ 🔗 *Site:* ${r.siteUrl}\n` +
            `▸ 📁 *Files Copied:* ${r.copiedFilesAmount || 1}\n\n` +
            `📥 *Download Link:*\n${r.download_url}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:web2zip]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Website archiving failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $proxy — get a fresh list of working proxies */
async function proxyCommand(sock, chatId, message) {
    await processing(sock, message, chatId, '🌐 Fetching proxy list……');
    try {
        const data = await toolsGet('proxy', {});
        if (!data?.success || !data?.results?.length) throw new Error('No proxies returned');
        const list = data.results.slice(0, 12).map((p, i) => {
            const lock = p.https === 'yes' ? ' 🔒' : '';
            return `${i + 1}. \`${p.ip}:${p.port}\` — ${p.country} [${p.anonymity}]${lock}`;
        }).join('\n');
        const txt = `🌐 *FRESH PROXY LIST*\n\n${list}\n\n_Last checked: a few seconds ago_\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:proxy]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Proxy fetch failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Developer Tools ──────────────────────────────────────────────────────────

/** Local JS obfuscation fallback using javascript-obfuscator (if installed) */
function localObfuscate(code) {
    try {
        const JO = require('javascript-obfuscator');
        return JO.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.75,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            stringEncryption: true,
        }).getObfuscatedCode();
    } catch (_) { return null; }
}

/** $obfuscate <js code> — obfuscate / encrypt JavaScript code */
async function obfuscateCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🔐 Usage: $obfuscate <JavaScript code>\nExample: $obfuscate console.log("hello")',
    }, { quoted: message });
    await processing(sock, message, chatId, '🔐 Obfuscating code……');
    try {
        let result = null;
        // Try GiftedTech API first
        try {
            const data = await toolsGet('encrypt', { code: q });
            if (data?.success && data?.encrypted_code) {
                result = data.encrypted_code;
            } else if (!data?.success) {
                // Surface the real API error (e.g. JS syntax error in user's code)
                const apiErr = data?.error || data?.message || '';
                if (apiErr) throw new Error(apiErr);
            }
        } catch (apiEx) {
            // If it's a real API error (not a network failure), rethrow directly
            if (!apiEx.isAxiosError && apiEx.message && !apiEx.code) throw apiEx;
        }
        // Local fallback (javascript-obfuscator package)
        if (!result) result = localObfuscate(q);
        if (!result) throw new Error('Obfuscation failed — try again shortly');
        const txt = `🔐 *JS OBFUSCATOR*\n\n\`\`\`\n${result.slice(0, 3000)}${result.length > 3000 ? '\n…(truncated)' : ''}\n\`\`\`\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:obfuscate]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Obfuscation failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Network / Lookup Tools ───────────────────────────────────────────────────

/** $dns <domain> — DNS records lookup */
async function dnsCommand(sock, chatId, message) {
    const q = getQ(message).replace(/^https?:\/\//, '').split('/')[0].trim();
    if (!q) return sock.sendMessage(chatId, {
        text: '🔍 Usage: $dns <domain>\nExample: $dns google.com',
    }, { quoted: message });
    await processing(sock, message, chatId, '🔍 Looking up DNS records……');
    try {
        const data = await toolsGet('dns-check', { domain: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'DNS lookup failed');
        const records = data.result.records || [];
        const grouped = {};
        for (const r of records) {
            if (!grouped[r.type]) grouped[r.type] = [];
            grouped[r.type].push(r.ip || r.target || r.value || '-');
        }
        const lines = Object.entries(grouped).map(([type, vals]) =>
            `▸ *${type}:* ${vals.slice(0, 3).join(', ')}`
        ).join('\n');
        const txt = `🔍 *DNS RECORDS — ${q}*\n\n${lines || 'No records found.'}\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:dns]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ DNS lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $headers <url> — HTTP response headers of a server */
async function headersCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q || !q.startsWith('http')) return sock.sendMessage(chatId, {
        text: '📡 Usage: $headers <url>\nExample: $headers https://google.com',
    }, { quoted: message });
    await processing(sock, message, chatId, '📡 Fetching HTTP headers……');
    try {
        const data = await toolsGet('http-headers', { url: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Headers fetch failed');
        const raw = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
        const txt = `📡 *HTTP HEADERS — ${q}*\n\n\`\`\`\n${raw.slice(0, 3000)}${raw.length > 3000 ? '\n…' : ''}\n\`\`\`\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:headers]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Headers fetch failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $servercheck <url> — check if a server / website is online */
async function servercheckCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q || !q.startsWith('http')) return sock.sendMessage(chatId, {
        text: '🖥️ Usage: $servercheck <url>\nExample: $servercheck https://google.com',
    }, { quoted: message });
    await processing(sock, message, chatId, '🖥️ Checking server……');
    try {
        const data = await toolsGet('server-check', { url: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'Server check failed');
        const r = data.result;
        const isUp = r.http_code >= 200 && r.http_code < 400;
        const statusIcon = isUp ? '🟢' : '🔴';
        const txt =
            `🖥️ *SERVER CHECK*\n\n` +
            `▸ 🔗 *URL:* ${r.link || q}\n` +
            `▸ ${statusIcon} *Status:* ${r.status || (isUp ? 'Online' : 'Offline')}\n` +
            `▸ 📊 *HTTP Code:* ${r.http_code}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:servercheck]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Server check failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── Screenshot Viewports ─────────────────────────────────────────────────────

async function _screenshotViewport(sock, chatId, message, endpoint, label) {
    const q = getQ(message);
    if (!q || !q.startsWith('http')) return sock.sendMessage(chatId, {
        text: `📸 Usage: ${endpoint} <url>\nExample: ${endpoint} https://google.com`,
    }, { quoted: message });
    await processing(sock, message, chatId, '📸 Taking screenshot……');
    try {
        const buf = await toolsBuf(endpoint, { url: q });
        if (buf.length < 500) throw new Error('Screenshot failed or empty response');
        await sock.sendMessage(chatId, {
            image: buf,
            caption: `📸 *SCREENSHOT (${label})*\n🔗 ${q}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error(`[gifted-tools:${endpoint}]`, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Screenshot failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $ssphone <url> — screenshot in mobile (phone) viewport */
async function ssphoneCommand(sock, chatId, message) {
    return _screenshotViewport(sock, chatId, message, 'ssphone', 'Mobile');
}

/** $sstab <url> — screenshot in tablet viewport */
async function sstabCommand(sock, chatId, message) {
    return _screenshotViewport(sock, chatId, message, 'sstab', 'Tablet');
}

/** $sspc <url> — screenshot in desktop/PC viewport */
async function sspcCommand(sock, chatId, message) {
    return _screenshotViewport(sock, chatId, message, 'sspc', 'Desktop');
}

// ─── Fancy Text ───────────────────────────────────────────────────────────────

/** $fantext <text> — show 8 different fancy Unicode text styles at once */
async function fantextCommand(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, { text: '✨ Usage: $fantext <text>\nExample: $fantext Hello World' }, { quoted: message });
    await processing(sock, message, chatId, '✨ Generating fancy text……');
    try {
        const data = await toolsGet('fancy', { text: q });
        if (!data?.success || !Array.isArray(data?.results)) throw new Error(data?.message || 'No styles returned');
        const lines = data.results.slice(0, 10).map(s => `▸ *${s.name}:* ${s.result}`).join('\n');
        const txt = `✨ *FANCY TEXT — "${q}"*\n\n${lines}\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:fantext]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Fancy text failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

/** $fantext2 <text> — show a different set of fancy Unicode text styles */
async function fantext2Command(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, { text: '✨ Usage: $fantext2 <text>\nExample: $fantext2 Hello World' }, { quoted: message });
    await processing(sock, message, chatId, '✨ Generating fancy text v2……');
    try {
        const data = await toolsGet('fancyv2', { text: q });
        if (!data?.success || !Array.isArray(data?.results)) throw new Error(data?.message || 'No styles returned');
        const lines = data.results.slice(0, 10).map(s => `▸ *${s.name}:* ${s.result}`).join('\n');
        const txt = `✨ *FANCY TEXT V2 — "${q}"*\n\n${lines}\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:fantext2]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Fancy text v2 failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── AI Cloth Remover ────────────────────────────────────────────────────────

/** $rc [url] — AI cloth/clothing remover. Works with URL, replied image, or sent image. */

/** Upload a buffer to uguu.se and return a public URL */
async function uploadRcBuffer(buffer) {
    const tmpDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `rc_${Date.now()}.jpg`);
    fs.writeFileSync(tmpPath, buffer);
    try {
        const res = await UploadFileUgu(tmpPath);
        const uploadedUrl = typeof res === 'string' ? res : (res?.url || res?.url_full);
        if (!uploadedUrl) throw new Error('Image upload returned no URL');
        return uploadedUrl;
    } finally {
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch {} }, 3000);
    }
}

async function rcCommand(sock, chatId, message) {
    await processing(sock, message, chatId, '👙 AI cloth removal processing……');
    try {
        // 1. Try URL from command text
        let imageUrl = getQ(message);
        if (imageUrl && !imageUrl.startsWith('http')) imageUrl = null;

        // 2. Try quoted image (reply to image with $rc)
        if (!imageUrl) {
            const ctx    = message.message?.extendedTextMessage?.contextInfo;
            const quoted = ctx?.quotedMessage;
            if (quoted?.imageMessage) {
                const buf = await downloadMediaMessage(
                    { key: ctx.stanzaId, message: quoted },
                    'buffer', {},
                    { reuploadRequest: sock.updateMediaMessage }
                );
                if (buf?.length > 0) imageUrl = await uploadRcBuffer(buf);
            }
        }

        // 3. Try image sent alongside the command (image with caption $rc)
        if (!imageUrl && message.message?.imageMessage) {
            const buf = await downloadMediaMessage(
                { key: message.key, message: message.message },
                'buffer', {},
                { reuploadRequest: sock.updateMediaMessage }
            );
            if (buf?.length > 0) imageUrl = await uploadRcBuffer(buf);
        }

        if (!imageUrl) {
            await react(sock, message, '❌');
            return sock.sendMessage(chatId, {
                text: '👙 *Usage:*\n• Reply to an image with *$rc*\n• Send an image with caption *$rc*\n• *$rc <image url>*',
            }, { quoted: message });
        }

        const data = await toolsGet('rc', { url: imageUrl, prompt: 'remove her clothes' });
        if (!data?.success || !data?.result?.imageUrl) throw new Error(data?.message || 'RC generation failed');
        await sock.sendMessage(chatId, {
            image: { url: data.result.imageUrl },
            caption: `👙 *AI CLOTH REMOVER*\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:rc]', err.message);
        await react(sock, message, '❌');

        const code = err?.response?.status || (err.message.includes('500') ? 500 : 0);
        let msg;
        if (code === 500) {
            msg = '❌ Could not process that image.\n\n_Make sure the image clearly shows a person. Objects, animals, or blurry photos won\'t work._';
        } else if (code === 429) {
            msg = '❌ Too many requests. Wait a moment and try again.';
        } else if (err.message.toLowerCase().includes('upload') || err.message.toLowerCase().includes('network')) {
            msg = '❌ Failed to upload the image. Check your connection and try again.';
        } else {
            msg = `❌ RC failed. Try again with a clearer photo of a person.\n\n_${err.message}_`;
        }

        await sock.sendMessage(chatId, { text: msg }, { quoted: message });
    }
}

// ─── Whois Lookup ────────────────────────────────────────────────────────────

/** $whois <domain> — domain WHOIS registration info */
async function whoisCommand(sock, chatId, message) {
    const q = getQ(message).replace(/^https?:\/\//, '').split('/')[0].trim();
    if (!q) return sock.sendMessage(chatId, {
        text: '🔎 Usage: $whois <domain>\nExample: $whois google.com',
    }, { quoted: message });
    await processing(sock, message, chatId, '🔎 Looking up WHOIS info……');
    try {
        const data = await toolsGet('whois', { domain: q });
        if (!data?.success || !data?.result) throw new Error(data?.message || 'WHOIS lookup failed');
        const r = data.result;
        const created  = r.creationDate   ? new Date(r.creationDate * 1000).toUTCString().slice(0, 16)   : 'N/A';
        const expires  = r.expirationDate ? new Date(r.expirationDate * 1000).toUTCString().slice(0, 16) : 'N/A';
        const updated  = r.updatedDate    ? new Date(r.updatedDate * 1000).toUTCString().slice(0, 16)    : 'N/A';
        const ns = Array.isArray(r.nameServers) ? r.nameServers.slice(0, 3).join(', ') : (r.nameServers || 'N/A');
        const txt =
            `🔎 *WHOIS — ${r.domainName || q}*\n\n` +
            `▸ 🏢 *Owner:* ${r.owner || 'N/A'}\n` +
            `▸ 📋 *Registrar:* ${r.registrar || 'N/A'}\n` +
            `▸ 🌐 *WHOIS Server:* ${r.whoisServer || 'N/A'}\n` +
            `▸ 📅 *Created:* ${created}\n` +
            `▸ ⌛ *Expires:* ${expires}\n` +
            `▸ 🔄 *Updated:* ${updated}\n` +
            `▸ 🔒 *DNSSEC:* ${r.dnssec || 'N/A'}\n` +
            `▸ 🖧 *Name Servers:* ${ns}\n\n` +
            `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:whois]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ WHOIS lookup failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── JS Obfuscator V2 ────────────────────────────────────────────────────────

/** $obfuscate2 <js code> — obfuscate JavaScript code using encryptv2 engine */
async function obfuscate2Command(sock, chatId, message) {
    const q = getQ(message);
    if (!q) return sock.sendMessage(chatId, {
        text: '🔐 Usage: $obfuscate2 <JavaScript code>\nExample: $obfuscate2 console.log("hello")',
    }, { quoted: message });
    await processing(sock, message, chatId, '🔐 Obfuscating code v2……');
    try {
        let result = null;
        // Try GiftedTech API first
        try {
            const data = await toolsGet('encryptv2', { code: q });
            if (data?.success && data?.result?.encrypted_code) {
                result = data.result.encrypted_code;
            } else if (!data?.success) {
                const apiErr = data?.error || data?.message || '';
                if (apiErr) throw new Error(apiErr);
            }
        } catch (apiEx) {
            if (!apiEx.isAxiosError && apiEx.message && !apiEx.code) throw apiEx;
        }
        // Local fallback (javascript-obfuscator package)
        if (!result) result = localObfuscate(q);
        if (!result) throw new Error('Obfuscation failed — try again shortly');
        const txt = `🔐 *JS OBFUSCATOR V2*\n\n\`\`\`\n${result.slice(0, 3000)}${result.length > 3000 ? '\n…(truncated)' : ''}\n\`\`\`\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-tools:obfuscate2]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, { text: `❌ Obfuscation v2 failed.\n\n_${err.message}_` }, { quoted: message });
    }
}

// ─── URL Shorteners ──────────────────────────────────────────────────────────
const SHORTENERS = {
    tinyurl:   { label: 'TinyURL',    cmd: '$tinyurl' },
    cleanuri:  { label: 'CleanURI',   cmd: '$cleanuri' },
    vgd:       { label: 'v.gd',       cmd: '$vgd' },
    rebrandly: { label: 'Rebrandly',  cmd: '$rebrandly' },
    vurl:      { label: 'Vurl',       cmd: '$vurl' },
    adfoc:     { label: 'Adf.ly',     cmd: '$adfoc' },
    ssur:      { label: 'Ssur.cc',    cmd: '$ssur' },
};

// Direct shortener backends (no Gifted API dependency)
async function _shortenDirect(service, url) {
    const axios = require('axios');
    if (service === 'vgd') {
        const resp = await axios.get(
            `https://v.gd/create.php?format=json&url=${encodeURIComponent(url)}`,
            { timeout: 15000, responseType: 'text' }
        );
        // v.gd sends Content-Type: text/javascript so axios won't auto-parse;
        // manually parse the JSON ourselves.
        const parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (parsed?.shorturl) return parsed.shorturl;
        throw new Error(parsed?.errormessage || 'v.gd failed');
    }
    if (service === 'ssur') {
        // ssur.cc has no free API; fall through to tinyurl as reliable fallback
        const { data } = await axios.get(
            `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
            { timeout: 15000 }
        );
        if (typeof data === 'string' && data.startsWith('http')) return data.trim();
        throw new Error('TinyURL fallback failed');
    }
    // Others: tinyurl / cleanuri remain on Gifted API
    const data = await toolsGet(service, { url });
    if (!data?.success || !data?.result) throw new Error(data?.message || 'Failed to shorten URL');
    return data.result;
}

function makeShortener(service) {
    return async function (sock, chatId, message) {
        const q = getQ(message);
        if (!q) return sock.sendMessage(chatId, {
            text: `🔗 Usage: *${SHORTENERS[service].cmd} <url>*\nExample: *${SHORTENERS[service].cmd} https://example.com*`,
        }, { quoted: message });

        await processing(sock, message, chatId, '🔗 Shortening URL……');
        try {
            const shortened = await _shortenDirect(service, q);
            const label = service === 'ssur' ? 'TinyURL (ssur.cc fallback)' : SHORTENERS[service].label;
            const txt = `🔗 *URL SHORTENER — ${label}*\n\n`
                + `📎 Original:\n${q}\n\n`
                + `✂️ Shortened:\n*${shortened}*\n\n_Daratech_ ⚡`;
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
            await react(sock, message, '✅');
        } catch (err) {
            console.error(`[gifted-tools:${service}]`, err.message);
            await react(sock, message, '❌');
            await sock.sendMessage(chatId, { text: `❌ Could not shorten URL. Make sure it starts with https://` }, { quoted: message });
        }
    };
}

const tinyurlCommand   = makeShortener('tinyurl');
const cleanuriCommand  = makeShortener('cleanuri');
const vgdCommand       = makeShortener('vgd');
const rebrandlyCommand = makeShortener('rebrandly');
const vurlCommand      = makeShortener('vurl');
const adfocCommand     = makeShortener('adfoc');
const ssurCommand      = makeShortener('ssur');

module.exports = {
    ttpCommand,
    canvasCommand,
    topdfCommand,
    web2zipCommand,
    proxyCommand,
    obfuscateCommand,
    obfuscate2Command,
    dnsCommand,
    headersCommand,
    servercheckCommand,
    ssphoneCommand,
    sstabCommand,
    sspcCommand,
    fantextCommand,
    fantext2Command,
    rcCommand,
    whoisCommand,
    tinyurlCommand,
    cleanuriCommand,
    vgdCommand,
    rebrandlyCommand,
    vurlCommand,
    adfocCommand,
    ssurCommand,
};
