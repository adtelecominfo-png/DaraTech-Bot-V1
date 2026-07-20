'use strict';
/**
 * Manga Command — powered by RUNFLIX API (RosyScans)
 *
 * $manga <title>               → search
 * $manga details <slug>        → full info + chapter list
 * $manga read <chapter-slug>   → chapter page image URLs
 * $manga dl <chapter-slug>     → single chapter as ZIP (max 30 pages)
 * $manga dls <slug> <from> <to>→ chapter range ZIP (max 3 per request)
 * $manga popular [page]        → popular titles
 * $manga latest [page]         → latest releases
 * $manga genres                → full genre list
 * $manga genre <slug> [page]   → browse by genre
 * $manga home                  → homepage (popularToday, latestUpdates)
 * $manga browse [opts]         → advanced filter (genre,status,type,order,page)
 */

const axios = require('axios');

const MANGA_BASE = 'https://runflix-api-v-3263--trumpmax.replit.app/api/v3/manga';

// Cloudflare codes that mean the origin (Replit) is sleeping / starting up
const SLEEP_CODES = new Set([520, 521, 522, 523, 524]);

/**
 * mangaFetch — fetch from the Replit-hosted manga API.
 * @param {string} path          - API path, e.g. '/search/boruto'
 * @param {object} [opts]
 * @param {Function} [opts.onSleep] - called once when a sleep code is detected,
 *                                    so the caller can notify the user to wait.
 */
async function mangaFetch(path, { onSleep } = {}) {
    const url = `${MANGA_BASE}${path}`;
    let lastErr;
    let wakeNotified = false;

    // Up to 4 retries — Replit repls can take 20-30 s to wake from sleep
    const MAX_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
            const { data } = await axios.get(url, {
                headers: {
                    'Accept':          'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
                timeout: 30000,
                maxRedirects: 5,
            });
            return data;
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;
            const isSleeping = SLEEP_CODES.has(status);
            const isRetryable = isSleeping || !status || status >= 500 || err.code === 'ECONNABORTED';

            if (!isRetryable) break; // 4xx — no point retrying

            if (isSleeping && !wakeNotified) {
                wakeNotified = true;
                try { onSleep && await onSleep(); } catch { /* non-fatal */ }
            }

            if (attempt < MAX_ATTEMPTS - 1) {
                // Sleep codes need a long wait (repl cold-start); other 5xx use short wait
                const delay = isSleeping ? 10000 : 2000 * (attempt + 1);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    const status = lastErr.response?.status;
    if (SLEEP_CODES.has(status)) {
        throw new Error('Manga service is still waking up — please try again in a moment.');
    }
    if (status === 503 || status === 502) {
        throw new Error('Manga service is temporarily unavailable. Please try again shortly.');
    }
    const msg = lastErr.response?.data?.message || lastErr.message || `HTTP ${status || 'timeout'}`;
    throw new Error(msg);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function typeEmoji(type) {
    if (!type) return '📖';
    const t = type.toLowerCase();
    if (t.includes('manhwa')) return '🇰🇷';
    if (t.includes('manhua')) return '🇨🇳';
    return '📖'; // manga
}

function statusEmoji(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('ongoing'))   return '🟢';
    if (s.includes('completed')) return '✅';
    if (s.includes('hiatus'))    return '⏸️';
    return '📌';
}

function truncate(str, max = 300) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function handleSearch(sock, chatId, message, query) {
    await sock.sendMessage(chatId, { text: `🔍 Searching manga for: *${query}*…` }, { quoted: message });
    const data = await mangaFetch(`/search?q=${encodeURIComponent(query)}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    const results = data?.results || data?.data || [];
    if (!results.length) {
        return sock.sendMessage(chatId, { text: `❌ No results found for *${query}*.` }, { quoted: message });
    }

    const lines = results.slice(0, 10).map((m, i) => {
        const emoji  = typeEmoji(m.type);
        const slug   = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
        const status = m.status ? ` • ${statusEmoji(m.status)} ${m.status}` : '';
        const chaps  = m.chapters ? ` • ${m.chapters} ch` : '';
        return `${i + 1}. ${emoji} *${m.title || m.name}*${status}${chaps}\n   🔑 \`${slug}\``;
    });

    const text =
        `╭━═『 🔍 MANGA SEARCH 』═━╮\n` +
        `┃ Query: *${query}*\n` +
        `┃ Found: ${results.length > 10 ? '10+' : results.length} results\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        lines.join('\n\n') +
        `\n\n📖 _Use_ \`$manga details <slug>\` _for full info_`;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Details ─────────────────────────────────────────────────────────────────

async function handleDetails(sock, chatId, message, slug) {
    await sock.sendMessage(chatId, { text: `📖 Loading manga details for: \`${slug}\`…` }, { quoted: message });
    const data = await mangaFetch(`/details/${encodeURIComponent(slug)}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    // API may return the manga under any of these keys
    const m = data?.result || data?.results || data?.data || data;
    if (!m || typeof m !== 'object' || (!m.title && !m.name)) {
        return sock.sendMessage(chatId, { text: `❌ Manga not found for slug: \`${slug}\`\n\n_Tip: copy the slug exactly as shown in search/home results._` }, { quoted: message });
    }

    const title   = m.title || m.name;
    const genres  = Array.isArray(m.genres)  ? m.genres.map(g => g.name || g).join(', ')  : (m.genres  || 'N/A');
    const authors = Array.isArray(m.authors) ? m.authors.map(a => a.name || a).join(', ') : (m.authors || 'N/A');

    // Chapter list (latest 10)
    const chapters = Array.isArray(m.chapters) ? m.chapters : [];
    const chapterLines = chapters.slice(0, 10).map(c => {
        const label = c.chapter || c.number || c.num || '?';
        // Slug may be explicit, or must be extracted from the chapter URL.
        // e.g. https://rosyscans.id/accidental-love-chapter-88-daddy/ → accidental-love-chapter-88-daddy
        const cSlug = c.slug || c.id ||
            c.url?.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '') || '';
        return `  • *${label}*${cSlug ? `\n    \`${cSlug}\`` : ''}`;
    }).join('\n');

    const text =
        `╭━═『 ${typeEmoji(m.type)} MANGA DETAILS 』═━╮\n` +
        `┃ 📌 *${title}*\n` +
        (m.type    ? `┃ 📂 Type:   ${m.type}\n`                       : '') +
        (m.status  ? `┃ ${statusEmoji(m.status)} Status: ${m.status}\n` : '') +
        (authors !== 'N/A' ? `┃ ✍️ Author: ${authors}\n`               : '') +
        (genres  !== 'N/A' ? `┃ 🏷️ Genres: ${genres}\n`               : '') +
        (m.rating  ? `┃ ⭐ Rating: ${m.rating}\n`                      : '') +
        (chapters.length   ? `┃ 📚 Chapters: ${chapters.length}\n`     : '') +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
        (m.synopsis || m.description ? `\n📝 ${truncate(m.synopsis || m.description, 400)}\n` : '') +
        (chapterLines ? `\n📋 *Latest chapters:*\n${chapterLines}\n` : '') +
        (chapters.length > 10 ? `  _…and ${chapters.length - 10} more_\n` : '') +
        `\n📖 _Read by number:_ \`$manga read ${slug} <N>\`\n` +
        `💾 _Download by number:_ \`$manga dl ${slug} <N>\`\n` +
        `_Example: $manga read ${slug} ${
            (() => {
                const first = chapters[0];
                return first ? parseInt((first.chapter || first.number || '1').toString().replace(/\D/g,'')) || 1 : 1;
            })()
        }_`;

    // Try to send with poster image
    const poster = m.cover || m.image || m.thumbnail;
    if (poster) {
        try {
            await sock.sendMessage(chatId, {
                image: { url: poster },
                caption: text,
            }, { quoted: message });
            return;
        } catch (_) { /* fall through to text */ }
    }
    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Chapter number → slug resolver ──────────────────────────────────────────
// Fetches the manga details to find the chapter URL for a given chapter number.
// API returns all chapters in details.results.chapters[], even when details
// only displays the top 10 — so every chapter is reachable by number.

async function resolveChapterSlug(mangaSlug, chapterNum) {
    const data = await mangaFetch(`/details/${encodeURIComponent(mangaSlug)}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });
    const m = data?.result || data?.results || data?.data || data;
    const chapters = Array.isArray(m?.chapters) ? m.chapters : [];
    if (!chapters.length) throw new Error(`No chapters found for \`${mangaSlug}\`. Check the manga slug.`);

    const target = parseInt(chapterNum);
    const found  = chapters.find(c => {
        const raw    = (c.chapter || c.number || c.num || '').toString();
        const parsed = parseInt(raw.replace(/\D/g, ''));
        return parsed === target;
    });

    if (!found) {
        // Show a sample of what numbers exist so user can self-correct
        const nums = chapters
            .map(c => parseInt((c.chapter || c.number || '').toString().replace(/\D/g, '')))
            .filter(n => !isNaN(n))
            .sort((a, b) => b - a)
            .slice(0, 6)
            .join(', ');
        throw new Error(`Chapter ${chapterNum} not found in \`${mangaSlug}\`.\nAvailable (latest): ${nums}…`);
    }

    // Prefer explicit slug/id, otherwise extract from chapter URL
    const slug = found.slug || found.id ||
        found.url?.replace(/^https?:\/\/[^/]+\//, '').replace(/\/$/, '');
    if (!slug) throw new Error(`Could not determine slug for chapter ${chapterNum}.`);
    return slug;
}

// ─── Read (chapter page URLs) ─────────────────────────────────────────────────

async function fetchImageBuffer(url) {
    const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'Referer':    'https://rosyscans.id/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        },
    });
    return Buffer.from(resp.data);
}

// Download up to `limit` URLs concurrently, returning [{buf, idx}] for successes
async function downloadConcurrent(urls, limit = 5) {
    const results = new Array(urls.length).fill(null);
    let cursor = 0;

    async function worker() {
        while (cursor < urls.length) {
            const i = cursor++;
            const url = typeof urls[i] === 'string' ? urls[i] : (urls[i]?.url || urls[i]?.src || urls[i]?.image || '');
            if (!url) continue;
            try {
                results[i] = await fetchImageBuffer(url);
            } catch (_) {
                results[i] = null; // failed page — will be reported later
            }
        }
    }

    await Promise.all(Array.from({ length: limit }, worker));
    return results;
}

async function handleRead(sock, chatId, message, chapterSlug) {
    await sock.sendMessage(chatId, { text: `📖 Loading chapter: \`${chapterSlug}\`…` }, { quoted: message });
    const data = await mangaFetch(`/chapter/${encodeURIComponent(chapterSlug)}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    // API returns: data.results.images[] (array of URL strings)
    const pages = data?.results?.images || data?.results?.pages || data?.pages || data?.images || data?.data || [];
    if (!pages.length) {
        return sock.sendMessage(chatId, { text: `❌ No pages found for chapter: \`${chapterSlug}\`\n\n_Try_ \`$manga dl ${chapterSlug}\` _to download as ZIP instead._` }, { quoted: message });
    }

    const total     = pages.length;
    // WhatsApp groups rapidly-sent images into an album grid (shows 2×2 + "+N").
    // We send in albums of 10 — no captions on individual pages so WA can group them.
    const ALBUM_SIZE = 10;
    const numAlbums  = Math.ceil(total / ALBUM_SIZE);

    await sock.sendMessage(chatId, {
        text:
            `╭━═『 📖 CHAPTER READER 』═━╮\n` +
            `┃ Chapter: \`${chapterSlug}\`\n` +
            `┃ Pages: ${total}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `_Sending all ${total} pages as photo albums — please wait…_`
    }, { quoted: message });

    let totalSent = 0;

    for (let a = 0; a < numAlbums; a++) {
        const albumPages = pages.slice(a * ALBUM_SIZE, (a + 1) * ALBUM_SIZE);
        const albumStart = a * ALBUM_SIZE;

        // Download all pages in this album concurrently (5 at a time)
        const buffers = await downloadConcurrent(albumPages, 5);

        // Send pages in rapid succession with no individual captions so
        // WhatsApp auto-groups them into an album grid (2×2 with "+N" overflow)
        for (let i = 0; i < buffers.length; i++) {
            const buf    = buffers[i];
            const absIdx = albumStart + i;
            const isLast = absIdx === total - 1;

            if (!buf) {
                // Download failed — send a short notice and continue
                await sock.sendMessage(chatId, { text: `⚠️ Page ${absIdx + 1}/${total} failed. Skipping.` }, { quoted: message });
                continue;
            }

            try {
                // No caption on any page → WhatsApp groups consecutive no-caption images into albums
                await sock.sendMessage(chatId, { image: buf }, { quoted: message });
                totalSent++;
                // 150 ms between pages keeps them in the same album group
                if (!isLast) await new Promise(r => setTimeout(r, 150));
            } catch (err) {
                await sock.sendMessage(chatId, { text: `⚠️ Page ${absIdx + 1} send failed: ${err.message}` }, { quoted: message });
            }
        }

        // 2 s gap between album groups so WA closes one album before starting the next
        if (a < numAlbums - 1) await new Promise(r => setTimeout(r, 2000));
    }

    if (totalSent === 0) {
        await sock.sendMessage(chatId, {
            text: `❌ All pages failed to download. Try \`$manga dl ${chapterSlug}\` instead.`
        }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, {
            text:
                `✅ *${totalSent}/${total} pages sent!*\n\n` +
                `💾 Download ZIP: \`$manga dl ${chapterSlug}\``
        }, { quoted: message });
    }
}

// ─── Download single chapter ZIP ──────────────────────────────────────────────

async function handleDownload(sock, chatId, message, chapterSlug) {
    await sock.sendMessage(chatId, { text: `💾 Preparing ZIP for chapter: \`${chapterSlug}\`…\n_Max 30 pages. This may take a moment._` }, { quoted: message });

    const url = `${MANGA_BASE}/chapter/${encodeURIComponent(chapterSlug)}/download`;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 60000,
            maxRedirects: 5,
        });

        const buffer = Buffer.from(response.data);
        const filename = `manga-${chapterSlug}.zip`.replace(/[^\w\-.]/g, '_');

        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: filename,
            mimetype: 'application/zip',
            caption: `📦 *Chapter ZIP*\nSlug: \`${chapterSlug}\`\nSize: ${(buffer.length / 1024).toFixed(1)} KB`,
        }, { quoted: message });
    } catch (err) {
        // If ZIP fails, fall back to page URLs
        await sock.sendMessage(chatId, {
            text: `⚠️ ZIP download failed: ${err.message}\n\n_Falling back to page URLs…_`
        }, { quoted: message });
        await handleRead(sock, chatId, message, chapterSlug);
    }
}

// ─── Download chapter range ZIP ───────────────────────────────────────────────

async function handleRangeDownload(sock, chatId, message, slug, from, to) {
    const fromN = parseInt(from);
    const toN   = parseInt(to);
    if (isNaN(fromN) || isNaN(toN) || fromN < 1 || toN < fromN) {
        return sock.sendMessage(chatId, {
            text: `❌ Invalid range.\nUsage: \`$manga dls <slug> <from> <to>\`\nExample: \`$manga dls one-piece 1 3\`\n\n_Max 3 chapters per request._`
        }, { quoted: message });
    }
    if (toN - fromN + 1 > 3) {
        return sock.sendMessage(chatId, {
            text: `⚠️ Max 3 chapters per request. You requested ${toN - fromN + 1}.\nSplit into smaller ranges.`
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `💾 Preparing ZIP for *${slug}* chapters ${fromN}–${toN}…\n_This may take a moment._`
    }, { quoted: message });

    const url = `${MANGA_BASE}/download/${encodeURIComponent(slug)}?from=${fromN}&to=${toN}`;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            timeout: 90000,
            maxRedirects: 5,
        });

        const buffer   = Buffer.from(response.data);
        const filename = `manga-${slug}-ch${fromN}-${toN}.zip`.replace(/[^\w\-.]/g, '_');

        await sock.sendMessage(chatId, {
            document: buffer,
            fileName: filename,
            mimetype: 'application/zip',
            caption: `📦 *Chapter Range ZIP*\nTitle: \`${slug}\`\nChapters: ${fromN}–${toN}\nSize: ${(buffer.length / 1024).toFixed(1)} KB`,
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ Range ZIP failed: ${err.message}\n\nTry individual chapters:\n\`$manga dl <chapter-slug>\``
        }, { quoted: message });
    }
}

// ─── Popular ──────────────────────────────────────────────────────────────────

async function handlePopular(sock, chatId, message, page = 1) {
    await sock.sendMessage(chatId, { text: `🔥 Loading popular manga (page ${page})…` }, { quoted: message });
    const data = await mangaFetch(`/popular?page=${page}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    const results = data?.results?.results || data?.results || data?.data || [];
    if (!results.length) {
        return sock.sendMessage(chatId, { text: `❌ No popular manga found.` }, { quoted: message });
    }

    const lines = results.slice(0, 12).map((m, i) => {
        const slug   = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        const chaps  = m.chapters ? ` • ${m.chapters} ch` : '';
        return `${i + 1}. ${typeEmoji(m.type)} *${m.title || m.name}*${status}${chaps}\n   \`${slug}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🔥 POPULAR MANGA 』═━╮\n` +
            `┃ Page ${page}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            `\n\n📄 _Next page:_ \`$manga popular ${page + 1}\`\n` +
            `📖 _Details:_ \`$manga details <slug>\``
    }, { quoted: message });
}

// ─── Latest ───────────────────────────────────────────────────────────────────

async function handleLatest(sock, chatId, message, page = 1) {
    await sock.sendMessage(chatId, { text: `🆕 Loading latest manga (page ${page})…` }, { quoted: message });
    const data = await mangaFetch(`/latest?page=${page}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    const results = data?.results?.results || data?.results || data?.data || [];
    if (!results.length) {
        return sock.sendMessage(chatId, { text: `❌ No latest manga found.` }, { quoted: message });
    }

    const lines = results.slice(0, 12).map((m, i) => {
        const slug     = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
        const lastChap = m.latestChapter || m.latest_chapter || m.chapter || '';
        const chStr    = lastChap ? ` • ${lastChap}` : '';
        return `${i + 1}. ${typeEmoji(m.type)} *${m.title || m.name}*${chStr}\n   \`${slug}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🆕 LATEST MANGA 』═━╮\n` +
            `┃ Page ${page}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            `\n\n📄 _Next page:_ \`$manga latest ${page + 1}\`\n` +
            `📖 _Details:_ \`$manga details <slug>\``
    }, { quoted: message });
}

// ─── Genres ───────────────────────────────────────────────────────────────────

async function handleGenres(sock, chatId, message) {
    const data = await mangaFetch('/genres', {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });
    const list = data?.genres || data?.data || data?.results || [];

    if (!list.length) {
        return sock.sendMessage(chatId, { text: `❌ Could not load genres.` }, { quoted: message });
    }

    const lines = list.map(g => {
        const name = g.name || g;
        const slug = g.slug || g.id || name.toLowerCase().replace(/\s+/g, '-');
        return `• *${name}* → \`${slug}\``;
    }).join('\n');

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🏷️ MANGA GENRES 』═━╮\n` +
            `┃ ${list.length} genres available\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines +
            `\n\n📖 _Browse:_ \`$manga genre <slug>\``
    }, { quoted: message });
}

// ─── Genre browse ─────────────────────────────────────────────────────────────

async function handleGenreBrowse(sock, chatId, message, slug, page = 1) {
    await sock.sendMessage(chatId, { text: `🏷️ Loading *${slug}* manga (page ${page})…` }, { quoted: message });
    const data = await mangaFetch(`/genre/${encodeURIComponent(slug)}?page=${page}`, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    const results = data?.results || data?.data || [];
    if (!results.length) {
        return sock.sendMessage(chatId, { text: `❌ No manga found for genre: *${slug}*` }, { quoted: message });
    }

    const lines = results.slice(0, 12).map((m, i) => {
        const mSlug  = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        return `${i + 1}. ${typeEmoji(m.type)} *${m.title || m.name}*${status}\n   \`${mSlug}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🏷️ ${slug.toUpperCase()} MANGA 』═━╮\n` +
            `┃ Page ${page}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            `\n\n📄 _Next page:_ \`$manga genre ${slug} ${page + 1}\`\n` +
            `📖 _Details:_ \`$manga details <slug>\``
    }, { quoted: message });
}

// ─── Home ─────────────────────────────────────────────────────────────────────

async function handleHome(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: `🏠 Loading manga homepage…` }, { quoted: message });
    const data = await mangaFetch('/home', {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });

    const popularToday  = data?.results?.popularToday  || data?.popularToday  || data?.popular_today  || [];
    const latestUpdates = data?.results?.latestUpdates || data?.latestUpdates || data?.latest_updates || data?.latest || [];
    const projectUpdateRaw = data?.results?.projectUpdate || data?.projectUpdate || data?.project_update || '';

    // projectUpdate may be an array of update objects or a plain string
    let projectUpdateText = '';
    if (Array.isArray(projectUpdateRaw) && projectUpdateRaw.length) {
        projectUpdateText = projectUpdateRaw.slice(0, 8).map((u, i) => {
            const title = u.title || u.name || (typeof u === 'string' ? u : '');
            const slug  = u.slug || u.id || u.url?.split('/manga/')[1]?.replace(/\/$/, '') || '';
            return `  ${i + 1}. *${title}*${slug ? ` \`${slug}\`` : ''}`;
        }).join('\n');
    } else if (typeof projectUpdateRaw === 'string' && projectUpdateRaw.trim()) {
        projectUpdateText = truncate(projectUpdateRaw, 300);
    }

    let text = `╭━═『 🏠 MANGA HOME 』═━╮\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;

    if (projectUpdateText) text += `\n📢 *Update:*\n${projectUpdateText}\n`;

    if (popularToday.length) {
        text += `\n🔥 *Popular Today:*\n`;
        text += popularToday.slice(0, 5).map((m, i) => {
            const slug = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
            return `  ${i + 1}. *${m.title || m.name}* \`${slug}\``;
        }).join('\n') + '\n';
    }

    if (latestUpdates.length) {
        text += `\n🆕 *Latest Updates:*\n`;
        text += latestUpdates.slice(0, 8).map((m, i) => {
            const slug = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
            const chap = m.latestChapter || m.latest_chapter || m.chapter || '';
            return `  ${i + 1}. *${m.title || m.name}*${chap ? ` ${chap}` : ''} \`${slug}\``;
        }).join('\n') + '\n';
    }

    text += `\n📖 _Details:_ \`$manga details <slug>\`\n🔥 _Popular:_ \`$manga popular\`\n🆕 _Latest:_ \`$manga latest\``;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Browse (advanced filter) ─────────────────────────────────────────────────

async function handleBrowse(sock, chatId, message, args) {
    // Parse: $manga browse [genre=action] [status=ongoing] [type=manhwa] [order=popular] [page=1]
    const params = {};
    for (const arg of args) {
        if (arg.includes('=')) {
            const [k, v] = arg.split('=');
            params[k.trim()] = v.trim();
        }
    }

    const qs = new URLSearchParams(params).toString();
    const path = `/browse${qs ? '?' + qs : ''}`;

    await sock.sendMessage(chatId, {
        text: `🔎 Browsing manga${qs ? ` (${qs})` : ''}…`
    }, { quoted: message });

    const data = await mangaFetch(path, {
        onSleep: () => sock.sendMessage(chatId, { text: '😴 Manga service is waking up, please wait a moment…' }, { quoted: message })
    });
    const results = data?.results || data?.data || [];

    if (!results.length) {
        return sock.sendMessage(chatId, {
            text: `❌ No results.\n\nUsage: \`$manga browse genre=action status=ongoing type=manhwa order=popular page=1\``
        }, { quoted: message });
    }

    const lines = results.slice(0, 12).map((m, i) => {
        const mSlug  = m.slug || m.id || m.url?.split('/manga/')[1]?.replace(/\/$/, '');
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        return `${i + 1}. ${typeEmoji(m.type)} *${m.title || m.name}*${status}\n   \`${mSlug}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🔎 MANGA BROWSE 』═━╮\n` +
            `┃ ${qs || 'All'}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            `\n\n📖 _Details:_ \`$manga details <slug>\``
    }, { quoted: message });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

async function mangaCommand(sock, chatId, message, userMessage) {
    const body  = userMessage.slice('$manga'.length).trim();
    const parts = body.split(/\s+/);
    const sub   = parts[0]?.toLowerCase() || '';
    const rest  = parts.slice(1);

    try {
        // No subcommand → show help
        if (!body) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━═『 📖 MANGA COMMANDS 』═━╮\n\n` +
                    `🔍 *$manga <title>*            — search\n` +
                    `📖 *$manga details <slug>*     — full info + chapters\n` +
                    `👁️ *$manga read <ch-slug>*     — chapter page URLs\n` +
                    `💾 *$manga dl <ch-slug>*       — chapter as ZIP\n` +
                    `📦 *$manga dls <slug> <f> <t>* — chapter range ZIP\n` +
                    `🔥 *$manga popular [page]*     — popular titles\n` +
                    `🆕 *$manga latest [page]*      — latest releases\n` +
                    `🏷️ *$manga genres*             — genre list\n` +
                    `🏷️ *$manga genre <slug> [pg]*  — browse by genre\n` +
                    `🏠 *$manga home*               — homepage\n` +
                    `🔎 *$manga browse [filters]*   — advanced filter\n\n` +
                    `_Example: $manga Jujutsu Kaisen_\n` +
                    `_Example: $manga browse genre=action status=ongoing_\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: message });
        }

        if (sub === 'home') {
            return await handleHome(sock, chatId, message);
        }

        if (sub === 'popular') {
            const page = parseInt(rest[0]) || 1;
            return await handlePopular(sock, chatId, message, page);
        }

        if (sub === 'latest') {
            const page = parseInt(rest[0]) || 1;
            return await handleLatest(sock, chatId, message, page);
        }

        if (sub === 'genres') {
            return await handleGenres(sock, chatId, message);
        }

        if (sub === 'genre') {
            const slug = rest[0];
            if (!slug) {
                return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga genre <slug> [page]\`\nGet slugs with \`$manga genres\`` }, { quoted: message });
            }
            const page = parseInt(rest[1]) || 1;
            return await handleGenreBrowse(sock, chatId, message, slug, page);
        }

        if (sub === 'details' || sub === 'info') {
            const slug = rest.join('-') || '';
            if (!slug) {
                return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga details <slug>\`\nGet slugs from \`$manga <search>\`` }, { quoted: message });
            }
            return await handleDetails(sock, chatId, message, slug);
        }

        if (sub === 'read') {
            if (!rest.length) {
                return sock.sendMessage(chatId, {
                    text:
                        `❌ Usage:\n` +
                        `  *$manga read <manga-slug> <chapter-number>*\n` +
                        `  *$manga read <chapter-slug>*\n\n` +
                        `Example: *$manga read accidental-love 88*`
                }, { quoted: message });
            }
            // If the last token is a plain number → number-based lookup mode
            const lastToken = rest[rest.length - 1];
            if (/^\d+$/.test(lastToken) && rest.length >= 2) {
                const mangaSlug = rest.slice(0, -1).join('-');
                await sock.sendMessage(chatId, {
                    text: `🔍 Looking up chapter *${lastToken}* of \`${mangaSlug}\`…`
                }, { quoted: message });
                const chSlug = await resolveChapterSlug(mangaSlug, lastToken);
                return await handleRead(sock, chatId, message, chSlug);
            }
            return await handleRead(sock, chatId, message, rest.join('-'));
        }

        if (sub === 'dl' || sub === 'download') {
            if (!rest.length) {
                return sock.sendMessage(chatId, {
                    text:
                        `❌ Usage:\n` +
                        `  *$manga dl <manga-slug> <chapter-number>*\n` +
                        `  *$manga dl <chapter-slug>*\n\n` +
                        `Example: *$manga dl accidental-love 88*`
                }, { quoted: message });
            }
            // If the last token is a plain number → number-based lookup mode
            const lastTok = rest[rest.length - 1];
            if (/^\d+$/.test(lastTok) && rest.length >= 2) {
                const mangaSlug = rest.slice(0, -1).join('-');
                await sock.sendMessage(chatId, {
                    text: `🔍 Looking up chapter *${lastTok}* of \`${mangaSlug}\`…`
                }, { quoted: message });
                const chSlug = await resolveChapterSlug(mangaSlug, lastTok);
                return await handleDownload(sock, chatId, message, chSlug);
            }
            return await handleDownload(sock, chatId, message, rest.join('-'));
        }

        if (sub === 'dls') {
            const slug = rest[0];
            const from = rest[1];
            const to   = rest[2];
            if (!slug || !from || !to) {
                return sock.sendMessage(chatId, {
                    text: `❌ Usage: \`$manga dls <slug> <from-chapter> <to-chapter>\`\nExample: \`$manga dls one-piece 1 3\`\n\n_Max 3 chapters per request._`
                }, { quoted: message });
            }
            return await handleRangeDownload(sock, chatId, message, slug, from, to);
        }

        if (sub === 'browse') {
            return await handleBrowse(sock, chatId, message, rest);
        }

        // Default: treat entire body as a search query
        return await handleSearch(sock, chatId, message, body);

    } catch (err) {
        console.error('[manga]', err.message);
        return sock.sendMessage(chatId, {
            text: `❌ Manga error: ${err.message}`
        }, { quoted: message });
    }
}

module.exports = { mangaCommand };
