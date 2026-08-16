'use strict';
/**
 * Manga Command — powered by RUNFLIX API (MangaDex Engine)
 *
 * ── Discovery ──────────────────────────────────────────────
 * $manga <title>                 → search
 * $manga more                    → next page of whichever list was shown last
 * $manga details <#|id>          → full info + latest chapters
 * $manga chapters <#|id> [page]  → chapter list, 30/page (fetched & cached once, paged client-side)
 * $manga home                    → spotlight / new releases / random pick
 * $manga popular [page]          → most-followed of all time
 * $manga trending [page]         → top-rated & most-followed
 * $manga latest [page]           → recently updated
 * $manga new [page]              → recent chapter activity
 * $manga seasonal [year] [page]  → manga from a given year
 * $manga random                  → random pick
 * $manga genres                  → full tag list (grouped)
 * $manga genre <#|name> [page]   → browse by tag (name or number)
 * $manga browse [key=val ...]    → advanced filtered search (try "$manga browse help")
 *
 * ── Reading / downloading ─────────────────────────────────
 * IMPORTANT: run `$manga chapters <#|manga-id>` FIRST — it's what teaches
 * the bot (and you) which chapter numbers/labels actually exist for a
 * title, and it's what read/dl/dls below resolve against. There is no
 * more "$manga read <manga-id> <ch#>" form; a manga-id alone doesn't tell
 * you which chapters exist, so it's chapters-list-first, then act by
 * number.
 *
 * $manga read <#|chapter-id>     → chapter page images (full quality, as pics)
 * $manga dl <#|chapter-id>       → download chapter (asks: ZIP or PDF?)
 * $manga dls <f> <t>             → chapters as separate files (range, max 5)
 * $manga dls <n,n,..>            → chapters as separate files (list, max 5)
 *   (dl/dls target the manga from your last "$manga chapters" call)
 *   (a bare number like `2` grabs every version of that chapter if it has
 *    2a/2b/... splits; a specific label like `2a` grabs just that one)
 *
 * ── People & groups ────────────────────────────────────────
 * $manga author <name|#|id>      → search authors, or profile + works
 * $manga group <name|#|id>       → search groups, or profile + chapters
 * $manga related <#|manga-id>    → related titles
 *
 * IDs are MangaDex UUIDs (e.g. a77742b1-befd-49a4-bff5-1ad4e6b0ef7b) —
 * get them from search / popular / latest / etc. results. Anywhere <#|id>
 * appears above you can use the number shown in front of the last list
 * posted in the chat instead (e.g. "$manga details 3"), so you don't have
 * to copy/paste the uuid.
 *
 * NOTE: this engine has no built-in "download as zip" endpoint like the
 * old RosyScans one did. Instead we fetch every page ourselves:
 *   - "$manga read" → sent as photo albums (for reading in-chat)
 *   - "$manga dl"   → downloads the pages, then asks "ZIP or PDF?" and
 *     waits for a reply ("1"/"zip" or "2"/"pdf"). Reply as "$manga 1" (or
 *     "$manga zip") always works. A bare "1"/"zip" with no prefix also
 *     works IF the host bot's message router calls the exported
 *     mangaHandlePendingReply() — see that function's comment below.
 *   - "$manga dls"  → same picker, but for up to 5 chapters at once
 *     (range "<from> <to>" or list "n1,n2,n3,..."); each chapter is always
 *     sent as its own separate file, never merged into one archive
 *   File named "Manga Title-Ch. X-DaraTechBot.zip" / "...pdf"
 * Requires the `jszip` package (`npm i jszip`) for the zip path, and
 * `pdfkit` (`npm i pdfkit`) for the PDF path; either one missing falls
 * back gracefully (PDF → ZIP → photo albums).
 */

const axios = require('axios');
let JSZip = null;
try { JSZip = require('jszip'); } catch (_) { /* zip path disabled, batch-pics fallback used */ }
let PDFDocument = null;
try { PDFDocument = require('pdfkit'); } catch (_) { /* pdf path disabled, zip fallback used */ }
let Jimp = null;
try {
    // jimp v1+ uses a named export (`const { Jimp } = require('jimp')`)
    // instead of the old default export — support both so this keeps
    // working whichever major version is installed.
    const jimpMod = require('jimp');
    Jimp = jimpMod?.Jimp || jimpMod?.default || jimpMod;
} catch (_) { /* used only to size PDF pages to each image; falls back to a fixed size */ }

// Same host/key as the movie command — now pointed at the /mangadex engine
const MANGA_BASE = 'https://apimovie.runflix.name.ng/v1/mangadex';
const MANGA_KEY  = process.env.APIMOVIE_KEY || 'dara_f15c322ef56b466994a37d2b';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * mangaFetch — GET from the DaraTech MangaDex API.
 * @param {string} path - API path, e.g. '/search?q=chainsaw+man'
 */
async function mangaFetch(path) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${MANGA_BASE}${path}${sep}apikey=${MANGA_KEY}`;
    try {
        const { data } = await axios.get(url, {
            headers: {
                'Accept':          'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            },
            timeout: 20000,
            maxRedirects: 5,
        });
        if (data && data.success === false) {
            throw new Error(data.error || 'API returned success:false');
        }
        return data;
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.response?.data?.message || err.message || `HTTP ${status || 'timeout'}`;
        throw new Error(msg);
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUuid(str) {
    return typeof str === 'string' && UUID_RE.test(str.trim());
}

function langEmoji(lang) {
    if (!lang) return '📖';
    const l = lang.toLowerCase();
    if (l === 'ko') return '🇰🇷';
    if (l === 'zh' || l === 'zh-hk') return '🇨🇳';
    if (l === 'ja') return '🇯🇵';
    return '📖';
}

function statusEmoji(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s.includes('ongoing'))   return '🟢';
    if (s.includes('completed')) return '✅';
    if (s.includes('hiatus'))    return '⏸️';
    if (s.includes('cancel'))    return '🛑';
    return '📌';
}

function truncate(str, max = 300) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
}

function titleOf(m) {
    if (!m) return 'Untitled';
    if (m.title) return m.title;
    const en = Array.isArray(m.altTitles) ? m.altTitles.find(t => t.lang === 'en') : null;
    return en?.title || 'Untitled';
}

function personName(p) {
    if (!p) return null;
    return typeof p === 'string' ? p : (p.name || null);
}

function tagNames(tags) {
    if (!Array.isArray(tags) || !tags.length) return 'N/A';
    return tags.map(t => t.name || t).join(', ');
}

function ratingOf(m) {
    const r = m?.statistics?.rating;
    if (!r) return null;
    const v = r.bayesian ?? r.average;
    return typeof v === 'number' ? v.toFixed(2) : null;
}

// ─── Result tracking (numbered shortcuts + $manga more) ───────────────────
//
// Every numbered list we print (search / popular / trending / latest / new /
// seasonal / genre / browse / related / author / group / chapters) stores
// its entries here so the person can type the number in front of a result
// instead of copying the id, and so "$manga more" can continue paging.
//
// Numbering carries on from the previous page (page 1 shows 1-10, page 2
// shows 11-20, etc.) so a number seen on an earlier page still resolves
// correctly even after paging further — no need to scroll back up first.
// The accumulated list resets whenever a brand-new list starts (page 1).
//
// Caches are kept SEPARATE per "kind" (entity/tag/author/group/chapter) —
// not one shared list — so e.g. viewing a chapter list doesn't clobber the
// manga-id numbers from an earlier search. Each command resolves its number
// against only the kind it actually expects:
//   'entity'  → manga (search/popular/browse/genre-results/related results)
//   'tag'     → genre tags ($manga genres)
//   'author'  → author search results
//   'group'   → scanlation group search results
//   'chapter' → a manga's chapter list ($manga chapters <id>)
//
// entityCaches: chatId -> { entity: [...], tag: [...], author: [...], group: [...], chapter: [...] }
// pageContext:  chatId -> { page, run(nextPage) } (how to fetch the next page — kind-agnostic, always "whatever was shown last")

const entityCaches = new Map();
const pageContext = new Map();

// The manga behind the last "$manga chapters <id>" list shown in this chat.
// read/dl/dls no longer take a manga-id argument — they act on whichever
// manga's chapters were most recently listed here.
// chatId -> { mangaId, mangaTitle }
const mangaChapterContext = new Map();

function getKindList(chatId, kind) {
    return entityCaches.get(chatId)?.[kind] || [];
}

function setKindList(chatId, kind, entries) {
    let store = entityCaches.get(chatId);
    if (!store) { store = {}; entityCaches.set(chatId, store); }
    store[kind] = entries;
}

// Appends this page's entries onto the running list for this kind (or starts
// a fresh one when page === 1) and returns the numbering offset to start
// counting from. Each entry gets a `label` used for lookup — normally the
// plain running count ("1", "2", "3", ...), but a caller can supply its own
// label per entry (e.g. chapter lists use "2a"/"2b" for same-number
// duplicates) by including `label` on the entry object already.
function trackPaged(chatId, kind, entries, page, runNext) {
    const existing = page === 1 ? [] : getKindList(chatId, kind);
    const offset = existing.length;
    const labeled = entries.map((e, i) => ({
        id: e.id,
        title: e.title,
        label: e.label != null ? String(e.label) : String(offset + i + 1),
    }));
    setKindList(chatId, kind, existing.concat(labeled));
    pageContext.set(chatId, { page, run: runNext });
    return offset;
}

// Turns a bare number (or number+letter like "2a") typed by the user into
// the id it referred to in the last list of this specific kind shown in
// this chat. Anything else (a real id, a name, etc.) is passed through
// unchanged.
function resolveKind(chatId, kind, rawArg) {
    if (!rawArg) return rawArg;
    const trimmed = String(rawArg).trim();
    if (/^\d+[a-zA-Z]?$/.test(trimmed)) {
        const cached = getKindList(chatId, kind);
        const hit = cached.find(e => e.label.toLowerCase() === trimmed.toLowerCase());
        if (hit) return hit.id;
    }
    return trimmed;
}

async function doMore(sock, chatId, message) {
    const ctx = pageContext.get(chatId);
    if (!ctx) {
        return sock.sendMessage(chatId, {
            text: `⚠️ Nothing to continue — run a search or list command first (e.g. \`$manga <title>\`, \`$manga popular\`).`
        }, { quoted: message });
    }
    return ctx.run(ctx.page + 1);
}

// ─── Search ──────────────────────────────────────────────────────────────────

async function handleSearch(sock, chatId, message, query, page = 1) {
    await sock.sendMessage(chatId, { text: `🔍 Searching manga for: *${query}*…${page > 1 ? ` (page ${page})` : ''}` }, { quoted: message });
    const data = await mangaFetch(`/search?q=${encodeURIComponent(query)}&limit=10&page=${page}`);

    const results = data?.results || [];
    if (!results.length) {
        if (page > 1) {
            return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        }
        return sock.sendMessage(chatId, { text: `❌ No results found for *${query}*.` }, { quoted: message });
    }

    const p = data?.pagination || {};

    const offset = trackPaged(
        chatId,
        'entity',
        results.map(m => ({ id: m.id, title: titleOf(m) })),
        page,
        (nextPage) => handleSearch(sock, chatId, message, query, nextPage)
    );

    const lines = results.map((m, i) => {
        const status = m.status ? ` • ${statusEmoji(m.status)} ${m.status}` : '';
        return `${offset + i + 1}. ${langEmoji(m.originalLanguage)} *${titleOf(m)}*${status}\n   🔑 \`${m.id}\``;
    });

    const text =
        `╭━═『 🔍 MANGA SEARCH 』═━╮\n` +
        `┃ Query: *${query}*\n` +
        `┃ Found: ${p.total ?? results.length} results${p.totalPages > 1 ? ` (page ${p.page}/${p.totalPages})` : ''}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        lines.join('\n\n') +
        (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
        `\n📖 Use \`$manga details <#>\` for full info (number or id)`;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Details ─────────────────────────────────────────────────────────────────

async function handleDetails(sock, chatId, message, id) {
    if (!isUuid(id)) {
        return sock.sendMessage(chatId, { text: `❌ \`${id}\` doesn't look like a manga id.\nGet ids from \`$manga <search>\`, \`$manga popular\`, etc.` }, { quoted: message });
    }
    await sock.sendMessage(chatId, { text: `📖 Loading manga details…` }, { quoted: message });

    const [detailsData, allChapters] = await Promise.all([
        mangaFetch(`/manga/${id}`),
        getAllChapters(id).catch(() => []),
    ]);

    const m = detailsData;
    if (!m || !m.id) {
        return sock.sendMessage(chatId, { text: `❌ Manga not found for id: \`${id}\`` }, { quoted: message });
    }

    const authorName = personName(m.author);
    const artistName  = personName(m.artist);
    const creators = [authorName, artistName].filter(Boolean);
    const uniqueCreators = [...new Set(creators)];

    const chapters = allChapters;
    const chapterTotal = chapters.length || m.lastChapter || 0;

    const chapterLines = chapters.slice(0, 10).map(c => {
        const label = c.chapter || '?';
        return `  • *Ch. ${label}*${c.title ? ` — ${c.title}` : ''}\n    \`${c.id}\``;
    }).join('\n');

    const rating = ratingOf(m);

    const text =
        `╭━═『 ${langEmoji(m.originalLanguage)} MANGA DETAILS 』═━╮\n` +
        `┃ 📌 *${titleOf(m)}*\n` +
        (m.status  ? `┃ ${statusEmoji(m.status)} Status: ${m.status}\n` : '') +
        (uniqueCreators.length ? `┃ ✍️ Author: ${uniqueCreators.join(', ')}\n` : '') +
        (m.tags?.length ? `┃ 🏷️ Genres: ${truncate(tagNames(m.tags), 200)}\n` : '') +
        (rating ? `┃ ⭐ Rating: ${rating}\n` : '') +
        (m.statistics?.follows ? `┃ 👥 Follows: ${m.statistics.follows.toLocaleString()}\n` : '') +
        (chapterTotal ? `┃ 📚 Chapters: ${chapterTotal}\n` : '') +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
        (m.description ? `\n📝 ${truncate(m.description, 400)}\n` : '') +
        (chapterLines ? `\n📋 *Latest chapters:*\n${chapterLines}\n` : '') +
        `\n📋 See full chapter list & numbers: \`$manga chapters ${id}\`\n` +
        `   (then read/dl/dls by number, e.g. \`$manga read 5\`, \`$manga dl 5\`, \`$manga dls 1 5\`)\n` +
        `🔗 _Related:_ \`$manga related ${id}\``;

    const poster = m.coverUrl || m.coverUrlSmall;
    if (poster) {
        try {
            await sock.sendMessage(chatId, { image: { url: poster }, caption: text }, { quoted: message });
            return;
        } catch (_) { /* fall through to text */ }
    }
    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Full chapter list ─────────────────────────────────────────────────────

// Chapter number → letter suffix, for when the same chapter number appears
// more than once on a page (different scanlation groups/languages/versions).
// "Ch. 2" appearing twice becomes labels "2a"/"2b" instead of two unrelated
// sequential numbers, so it's clear at a glance they're the same chapter.
// A chapter number that appears only once keeps a plain label ("8", not "8a").
function labelChaptersWithDuplicates(chapters) {
    const counts = {};
    for (const c of chapters) {
        const key = String(c.chapter ?? '?');
        counts[key] = (counts[key] || 0) + 1;
    }
    const seen = {};
    return chapters.map(c => {
        const key = String(c.chapter ?? '?');
        if (counts[key] > 1) {
            const n = (seen[key] = (seen[key] || 0) + 1);
            return { ...c, label: `${key}${String.fromCharCode(96 + n)}` }; // 1→a, 2→b, ...
        }
        return { ...c, label: key };
    });
}

// ─── Chapters fetching / caching ────────────────────────────────────────────
//
// The chapters endpoint returns EVERY chapter for a manga in one response —
// there's no real server-side page/offset support (a `page` param is
// silently ignored, which is why paginating via repeated `page=N` requests
// used to just return the same first batch every time). So we fetch once,
// cache briefly, and paginate client-side instead — same pattern as
// genres/tags below.

const _chaptersCache = new Map(); // key: `${mangaId}:${lang}` -> { chapters, at }
const CHAPTERS_CACHE_TTL = 5 * 60 * 1000; // 5 min — chapters can get new releases

async function getAllChapters(mangaId, lang = 'en') {
    const key = `${mangaId}:${lang}`;
    const now = Date.now();
    const cached = _chaptersCache.get(key);
    if (cached && (now - cached.at) < CHAPTERS_CACHE_TTL) {
        return cached.chapters;
    }
    const data = await mangaFetch(`/manga/${mangaId}/chapters?lang=${lang}`);
    const chapters = data?.chapters || [];
    if (_chaptersCache.size > 100) {
        _chaptersCache.delete(_chaptersCache.keys().next().value); // simple cap, evict oldest
    }
    _chaptersCache.set(key, { chapters, at: now });
    return chapters;
}

const CHAPTERS_PAGE_SIZE = 30;

async function handleChapterList(sock, chatId, message, id, page = 1, mangaTitle = null) {
    if (!isUuid(id)) {
        return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga chapters <#|manga-id> [page]\`` }, { quoted: message });
    }

    if (mangaTitle === null) {
        try {
            const m = await mangaFetch(`/manga/${id}`);
            mangaTitle = titleOf(m);
        } catch (_) { mangaTitle = ''; /* non-fatal — falls back to generic header below */ }
    }
    const label = mangaTitle ? `*${mangaTitle}*` : 'manga';

    await sock.sendMessage(chatId, { text: `📋 Loading ${label} chapters…` }, { quoted: message });

    const rawChapters = await getAllChapters(id);
    if (!rawChapters.length) {
        return sock.sendMessage(chatId, { text: `❌ No chapters found.` }, { quoted: message });
    }

    // Label duplicates (2a/2b/...) across the FULL list, not per-page, so a
    // number's versions are labeled consistently no matter which page
    // they'd fall on.
    const allChapters = labelChaptersWithDuplicates(rawChapters);
    const totalPages = Math.ceil(allChapters.length / CHAPTERS_PAGE_SIZE);
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const chapters = allChapters.slice((clampedPage - 1) * CHAPTERS_PAGE_SIZE, clampedPage * CHAPTERS_PAGE_SIZE);

    if (!chapters.length) {
        return sock.sendMessage(chatId, { text: `📭 No more chapters — that was the last page.` }, { quoted: message });
    }

    trackPaged(
        chatId,
        'chapter',
        chapters.map(c => ({ id: c.id, title: `Ch. ${c.chapter || '?'}`, label: c.label })),
        clampedPage,
        (nextPage) => handleChapterList(sock, chatId, message, id, nextPage, mangaTitle)
    );

    // Remember which manga this chapter list belongs to, so read/dl/dls can
    // be called with just a number/label afterward — no manga-id needed.
    mangaChapterContext.set(chatId, { mangaId: id, mangaTitle });

    const lines = chapters.map(c => {
        const pageInfo = c.pages ? ` • ${c.pages}p` : '';
        return `${c.label}. *Ch. ${c.chapter || '?'}*${c.title ? ` — ${c.title}` : ''}${pageInfo}\n    \`${c.id}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 📋 CHAPTERS 』═━╮\n` +
            (mangaTitle ? `┃ *${mangaTitle}*\n` : '') +
            `┃ Page ${clampedPage}/${totalPages} (${allChapters.length} total)\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n') +
            (clampedPage < totalPages ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n\n👁️ _Read:_ \`$manga read <#>\`\n` +
            `💾 _Download:_ \`$manga dl <#>\`\n` +
            `📦 _Bulk download:_ \`$manga dls <n,n,..>\` _or_ \`$manga dls <from> <to>\` _(max 5 files)_\n` +
            `Use a letter suffix (e.g. \`2a\`) if a number repeats. For \`dls\`, a bare number like \`2\` grabs *every* version (2a, 2b, ...); a specific label like \`2a\` grabs just that one.\n\n` +
            `💡 Save a chapter-id (the code under each line) if you want that exact chapter back later — the number/label cache clears after a while, but \`$manga read <id>\` and \`$manga dl <id>\` always work directly off the id, no re-listing needed.`
    }, { quoted: message });
}

// ─── Chapter number → chapter object resolver ──────────────────────────────
// Scans a manga's chapter list (paginated) to find the chapter matching a
// given number, preferring an entry that actually has readable pages
// (pages > 0, no externalUrl). Returns the full chapter object (id, chapter
// number, title, ...) so callers can build a proper "Manga - Ch. X" label
// without a second round trip.

// The chapters-list endpoint's `externalUrl`/`pages` metadata isn't always
// accurate — a chapter can be flagged as external-only there yet still have
// real pages on the images endpoint. So metadata is only used to decide
// scan order; nothing is rejected as "external only" without actually
// probing /chapter/{id}/images first.
async function probeChapterHasPages(chapter) {
    try {
        const { full } = await fetchChapterImages(chapter.id);
        return full.length > 0;
    } catch (_) {
        return false;
    }
}

// Returns EVERY readable match for a chapter number (there can be more than
// one — different scanlation groups/languages/versions sharing the same
// chapter number) — used by "$manga dls" so that a bare number grabs every
// version and sends each as its own separate file.
async function resolveAllChaptersForNumber(mangaId, chapterNum, lang = 'en') {
    const target = parseFloat(chapterNum);
    // The chapters endpoint returns everything for the manga in one shot —
    // no real server-side paging — so just fetch (cached) once and filter,
    // same as handleChapterList.
    const allChapters = await getAllChapters(mangaId, lang);
    const candidates = allChapters.filter(c => parseFloat(c.chapter) === target);

    // The chapters-list metadata isn't always accurate — a chapter flagged
    // external can still have real hosted pages — so verify anything not
    // already obviously readable against the images endpoint before
    // dropping it, instead of trusting the flag.
    const matches = [];
    const suspects = [];
    for (const c of candidates) {
        if (!c.externalUrl && c.pages > 0) {
            matches.push(c);
        } else if (await probeChapterHasPages(c)) {
            matches.push(c);
        } else {
            suspects.push(c);
        }
    }

    if (matches.length) return matches;
    const bestExternalOnly = suspects.find(c => c.externalUrl);
    if (bestExternalOnly) {
        throw new Error(`Chapter ${chapterNum} only has an external link (not hosted here): ${bestExternalOnly.externalUrl}`);
    }
    throw new Error(`Chapter ${chapterNum} not found for this manga. Check \`$manga chapters <id>\` for available numbers.`);
}


// Builds a human-readable "Manga Title" + "Ch. X - Title" pair for captions
// and filenames, instead of a raw chapter uuid.
//
// knownMeta (optional), used when we already have it from the caller
// (e.g. the "$manga read <manga-id> <ch#>" form already knows both):
//   { mangaId, mangaTitle, chapterNum, chapterTitle }
//
// When nothing is known (a bare "$manga read <chapter-id>"), this tries a
// direct chapter-detail lookup so the label still resolves; if that endpoint
// isn't available on this API, it degrades to a short id instead of the
// full uuid rather than failing.
async function resolveChapterLabel(chapterId, knownMeta = null) {
    let mangaTitle = knownMeta?.mangaTitle ?? null;
    let chapterNum = knownMeta?.chapterNum ?? null;
    let chapterTitle = knownMeta?.chapterTitle ?? null;
    const mangaId = knownMeta?.mangaId ?? null;

    if (mangaId && !mangaTitle) {
        try {
            const m = await mangaFetch(`/manga/${mangaId}`);
            mangaTitle = titleOf(m);
        } catch (_) { /* non-fatal — fall back to generic label below */ }
    }

    if (!mangaTitle || (chapterNum === null && !chapterTitle)) {
        try {
            const c = await mangaFetch(`/chapter/${encodeURIComponent(chapterId)}`);
            if (c) {
                chapterNum = chapterNum ?? c.chapter ?? null;
                chapterTitle = chapterTitle ?? c.title ?? null;
                if (!mangaTitle) {
                    if (c.manga) mangaTitle = titleOf(c.manga);
                    else if (c.mangaId) {
                        const m = await mangaFetch(`/manga/${c.mangaId}`).catch(() => null);
                        if (m) mangaTitle = titleOf(m);
                    }
                }
            }
        } catch (_) { /* chapter-detail endpoint unavailable — degrade below */ }
    }

    const chapterPart = chapterNum !== null && chapterNum !== undefined
        ? `Ch. ${chapterNum}${chapterTitle ? ` - ${chapterTitle}` : ''}`
        : (chapterTitle || `Chapter ${chapterId.slice(0, 8)}`);

    return { mangaTitle: mangaTitle || 'Manga', chapterPart };
}

function buildMangaFileName(mangaTitle, chapterPart, ext = 'zip') {
    const safe = str => (str || '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '.');
    return [safe(mangaTitle) || 'Manga', safe(chapterPart) || 'Chapter', 'DaraTechBot'].filter(Boolean).join('-') + `.${ext}`;
}

// ─── Image download helpers ────────────────────────────────────────────────

async function fetchImageBuffer(url) {
    const resp = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'Referer':    'https://mangadex.org/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        },
    });
    return Buffer.from(resp.data);
}

// Download up to `limit` URLs concurrently, returning [{buf, filename}] (buf null on failure)
async function downloadConcurrent(pages, limit = 3) {
    const results = new Array(pages.length).fill(null);
    let cursor = 0;

    async function worker() {
        while (cursor < pages.length) {
            const i = cursor++;
            const url      = pages[i]?.url || (typeof pages[i] === 'string' ? pages[i] : '');
            const filename = pages[i]?.filename || `page-${i + 1}.jpg`;
            if (!url) continue;
            try {
                results[i] = { buf: await fetchImageBuffer(url), filename };
            } catch (_) {
                results[i] = null;
            }
        }
    }

    await Promise.all(Array.from({ length: limit }, worker));
    return results;
}

async function fetchChapterImages(chapterId) {
    const data = await mangaFetch(`/chapter/${encodeURIComponent(chapterId)}/images`);
    return {
        full:      data?.pages || [],
        dataSaver: data?.pagesDataSaver || data?.pages || [],
    };
}

// Send a set of downloaded pages as WhatsApp photo albums (2×2 auto-grouping)
async function sendAsAlbums(sock, chatId, message, downloaded, label) {
    const total = downloaded.length;
    const ALBUM_SIZE = 10;
    const numAlbums = Math.ceil(total / ALBUM_SIZE);
    let totalSent = 0;

    for (let a = 0; a < numAlbums; a++) {
        const batch = downloaded.slice(a * ALBUM_SIZE, (a + 1) * ALBUM_SIZE);
        for (let i = 0; i < batch.length; i++) {
            const entry = batch[i];
            const absIdx = a * ALBUM_SIZE + i;
            if (!entry || !entry.buf) {
                await sock.sendMessage(chatId, { text: `⚠️ Page ${absIdx + 1}/${total} failed. Skipping.` }, { quoted: message });
                continue;
            }
            try {
                await sock.sendMessage(chatId, { image: entry.buf }, { quoted: message });
                totalSent++;
                if (absIdx < total - 1) await new Promise(r => setTimeout(r, 150));
            } catch (err) {
                await sock.sendMessage(chatId, { text: `⚠️ Page ${absIdx + 1} send failed: ${err.message}` }, { quoted: message });
            }
        }
        if (a < numAlbums - 1) await new Promise(r => setTimeout(r, 2000));
    }

    await sock.sendMessage(chatId, {
        text: totalSent
            ? `✅ *${totalSent}/${total} pages sent!* (${label})`
            : `❌ All pages failed to send.`
    }, { quoted: message });
}

// Zip downloaded pages in-memory and send as a document
async function sendAsZip(sock, chatId, message, downloaded, filename, caption) {
    if (!JSZip) {
        await sock.sendMessage(chatId, {
            text: `⚠️ ZIP support isn't installed on this bot (\`npm i jszip\`). Sending as photo albums instead…`
        }, { quoted: message });
        return sendAsAlbums(sock, chatId, message, downloaded, 'fallback — zip unavailable');
    }

    const zip = new JSZip();
    let included = 0;
    downloaded.forEach((entry, i) => {
        if (entry && entry.buf) {
            zip.file(entry.filename || `page-${String(i + 1).padStart(3, '0')}.jpg`, entry.buf);
            included++;
        }
    });

    if (!included) {
        return sock.sendMessage(chatId, { text: `❌ All pages failed to download — nothing to zip.` }, { quoted: message });
    }

    // Level 6 is the default zlib tradeoff — level 4 trims noticeably more
    // CPU time for very little size difference, which matters on smaller
    // hosting where heavy compression can stall the event loop long enough
    // to disrupt the WhatsApp connection.
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 4 } });
    const safeFilename = filename.replace(/[^\w\-.]/g, '_');

    await sock.sendMessage(chatId, {
        document: buffer,
        fileName: safeFilename,
        mimetype: 'application/zip',
        caption: `📦 ${caption}\nPages: ${included}/${downloaded.length}\nSize: ${(buffer.length / 1024).toFixed(1)} KB`,
    }, { quoted: message });
}

// Build a PDF (one page per image) from downloaded chapter pages.
// Yields back to the event loop after every page: Jimp's decode + pdfkit's
// image embed are CPU-heavy, and running them back-to-back for a whole
// chapter without ever yielding can block Node long enough to miss
// WhatsApp's websocket keepalive ping — which is what was closing the
// connection (statusCode 408) during downloads on constrained hosting.
async function buildPdfBuffer(downloaded) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        (async () => {
            for (const entry of downloaded) {
                if (!entry?.buf) continue;
                let width = 1240, height = 1754; // A4-ish fallback if we can't read dimensions
                if (Jimp) {
                    try {
                        const img = await Jimp.read(entry.buf);
                        width = img.bitmap.width;
                        height = img.bitmap.height;
                    } catch (_) { /* keep fallback size */ }
                }
                doc.addPage({ size: [width, height], margin: 0 });
                try {
                    doc.image(entry.buf, 0, 0, { width, height });
                } catch (_) { /* skip a page that fails to embed rather than aborting the pdf */ }
                // Give the event loop (and Baileys' ws ping/pong) a chance to
                // run between pages instead of hogging it for the whole loop.
                await new Promise((r) => setImmediate(r));
            }
            doc.end();
        })();
    });
}

// Combine downloaded pages into a single PDF and send as a document
async function sendAsPdf(sock, chatId, message, downloaded, filename, caption) {
    if (!PDFDocument) {
        await sock.sendMessage(chatId, {
            text: `⚠️ PDF support isn't installed on this bot (\`npm i pdfkit\`). Sending as a ZIP instead…`
        }, { quoted: message });
        return sendAsZip(sock, chatId, message, downloaded, filename.replace(/\.pdf$/i, '.zip'), caption);
    }

    const included = downloaded.filter(d => d?.buf).length;
    if (!included) {
        return sock.sendMessage(chatId, { text: `❌ All pages failed to download — nothing to build a PDF from.` }, { quoted: message });
    }

    const buffer = await buildPdfBuffer(downloaded);
    const safeFilename = filename.replace(/[^\w\-.]/g, '_');

    await sock.sendMessage(chatId, {
        document: buffer,
        fileName: safeFilename,
        mimetype: 'application/pdf',
        caption: `📄 ${caption}\nPages: ${included}/${downloaded.length}\nSize: ${(buffer.length / 1024).toFixed(1)} KB`,
    }, { quoted: message });
}

// ─── DL format picker (ZIP vs PDF) ─────────────────────────────────────────
//
// "$manga dl" (single chapter) and "$manga dls" (up to 5 chapters, by range
// or explicit list) both download pages up front, then ask which format to
// send in and wait for a reply instead of always zipping. For "dls" the
// picker is asked once for the whole batch, but each chapter is still sent
// as its own separate file. Two ways the reply reaches us:
//   1. "$manga 1" / "$manga zip" — handled inside mangaCommand() below,
//      works with no changes anywhere else.
//   2. A bare "1" / "2" / "zip" / "pdf" with no "$manga" prefix — only
//      works if the host bot's message router calls the exported
//      mangaHandlePendingReply() for plain incoming text. See that
//      function's comment for the one line to add.

const pendingDownloads = new Map(); // chatId -> { mangaTitle, items: [{chapterPart, downloaded}], expiresAt }
const PICK_TTL_MS = 5 * 60 * 1000; // choice expires after 5 minutes

function hasPendingDownload(chatId) {
    const p = pendingDownloads.get(chatId);
    if (!p) return false;
    if (Date.now() > p.expiresAt) {
        pendingDownloads.delete(chatId);
        return false;
    }
    return true;
}

function parseFormatChoice(text) {
    const t = (text || '').trim().toLowerCase().replace(/[️⃣]/g, '');
    if (t === '1' || t === 'zip') return 'zip';
    if (t === '2' || t === 'pdf') return 'pdf';
    return null;
}

// items: [{ chapterPart, downloaded }, ...] — one entry per chapter. A single
// entry behaves like before; more than one asks once but sends each chapter
// as its own separate file once answered.
async function presentDownloadPicker(sock, chatId, message, { mangaTitle, items }) {
    pendingDownloads.set(chatId, { mangaTitle, items, expiresAt: Date.now() + PICK_TTL_MS });

    const isBatch = items.length > 1;
    const label = isBatch
        ? `${items.length} chapters (${items.map(i => i.chapterPart.replace(/^Ch\.\s*/, '')).join(', ')})`
        : (items[0]?.chapterPart || 'Chapter');

    return sock.sendMessage(chatId, {
        text:
            `📦 *${label} ${isBatch ? 'are' : 'is'} ready!*\n\n` +
            `How would you like to receive ${isBatch ? 'them' : 'it'}?\n\n` +
            `🗜️ *ZIP* — Original chapter files packaged together\n` +
            `📄 *PDF* — Easy to read on your phone\n\n` +
            (isBatch ? `_Each chapter will be sent as its own file._\n\n` : '') +
            `👇 Please choose your preferred format:\n\n` +
            `1️⃣ ZIP\n` +
            `2️⃣ PDF`
    }, { quoted: message });
}

async function resolveDownloadChoice(sock, chatId, message, choice) {
    const pending = pendingDownloads.get(chatId);
    if (!pending || Date.now() > pending.expiresAt) {
        pendingDownloads.delete(chatId);
        return sock.sendMessage(chatId, { text: `⚠️ That download request expired — run \`$manga dl\` again.` }, { quoted: message });
    }
    pendingDownloads.delete(chatId);

    const { mangaTitle, items } = pending;
    const ext = choice === 'pdf' ? 'pdf' : 'zip';
    const sender = choice === 'pdf' ? sendAsPdf : sendAsZip;
    const isBatch = items.length > 1;

    if (isBatch) {
        await sock.sendMessage(chatId, { text: `📤 Sending ${items.length} chapters as separate ${ext.toUpperCase()} files…` }, { quoted: message });
    }

    let sent = 0;
    for (const item of items) {
        const filename = buildMangaFileName(mangaTitle, item.chapterPart, ext);
        const caption = `*${mangaTitle}*\n${item.chapterPart}`;
        try {
            await sender(sock, chatId, message, item.downloaded, filename, caption);
            sent++;
        } catch (err) {
            await sock.sendMessage(chatId, { text: `⚠️ Failed to send ${item.chapterPart}: ${err.message}` }, { quoted: message });
        }
        if (isBatch) await new Promise(r => setTimeout(r, 1200));
    }

    if (isBatch) {
        await sock.sendMessage(chatId, { text: `✅ Sent ${sent}/${items.length} chapters as ${ext.toUpperCase()} files.` }, { quoted: message });
    }
}

// Exported for the host bot's message router: call this for any plain
// incoming text (one not already handled as a "$manga ..." command) so a
// bare "1" / "2" / "zip" / "pdf" reply can resolve a pending dl picker.
// Returns true if the message was consumed, false if there's nothing
// pending (in which case the caller should continue normal handling).
//   Example wiring in your main message handler:
//     if (await manga.mangaHandlePendingReply(sock, chatId, message, text)) return;
async function mangaHandlePendingReply(sock, chatId, message, text) {
    if (!hasPendingDownload(chatId)) return false;
    const choice = parseFormatChoice(text);
    if (!choice) return false;
    await resolveDownloadChoice(sock, chatId, message, choice);
    return true;
}

// ─── Read (chapter page images, full quality) ──────────────────────────────

async function handleRead(sock, chatId, message, chapterId, knownMeta = null) {
    if (!isUuid(chapterId)) {
        return sock.sendMessage(chatId, { text: `❌ Usage:\n  *$manga read <#|manga-id> <chapter-number>*\n  *$manga read <chapter-id>*` }, { quoted: message });
    }
    await sock.sendMessage(chatId, { text: `📖 Loading chapter pages…` }, { quoted: message });

    let full = [];
    try {
        ({ full } = await fetchChapterImages(chapterId));
    } catch (_) {
        // The images endpoint can error outright (not just return empty)
        // when the id given isn't actually a chapter — treat that the same
        // as "no pages" below rather than surfacing a raw API error.
        full = [];
    }
    if (!full.length) {
        // Chapter fetch came back empty — likely this uuid is actually a
        // MANGA id (no chapter number given), so show its chapter
        // list/picker right away instead of a generic error. This also
        // means a manga with 0 chapters is immediately obvious.
        const asManga = await mangaFetch(`/manga/${chapterId}`).catch(() => null);
        if (asManga?.id) {
            await sock.sendMessage(chatId, {
                text: `📖 *Manga ID detected* — showing chapter list:`
            }, { quoted: message });
            return await handleChapterList(sock, chatId, message, chapterId, 1, titleOf(asManga));
        }
        return sock.sendMessage(chatId, { text: `❌ No pages found for chapter: \`${chapterId}\`\n\nTry \`$manga dl ${chapterId}\` to download instead.` }, { quoted: message });
    }

    const { mangaTitle, chapterPart } = await resolveChapterLabel(chapterId, knownMeta);
    const shortLabel = `${mangaTitle} - ${chapterPart}`;

    await sock.sendMessage(chatId, {
        text:
            `╭━═『 📖 CHAPTER READER 』═━╮\n` +
            `┃ 📌 *${mangaTitle}*\n` +
            `┃ ${chapterPart}\n` +
            `┃ Pages: ${full.length}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `_Sending all ${full.length} pages as photo albums — please wait…_`
    }, { quoted: message });

    const downloaded = await downloadConcurrent(full, 3);
    return sendAsAlbums(sock, chatId, message, downloaded, shortLabel);
}

// ─── Download: single chapter (always ZIP) ─────────────────────────────────

async function handleDownload(sock, chatId, message, chapterId, knownMeta = null) {
    if (!isUuid(chapterId)) {
        return sock.sendMessage(chatId, { text: `❌ Usage:\n  *$manga dl <#|manga-id> <chapter-number>*\n  *$manga dl <chapter-id>*` }, { quoted: message });
    }
    await sock.sendMessage(chatId, { text: `💾 Preparing chapter…` }, { quoted: message });

    let dataSaver = [];
    try {
        ({ dataSaver } = await fetchChapterImages(chapterId));
    } catch (_) {
        // Same as handleRead: an outright error here (not just empty pages)
        // usually means this id isn't actually a chapter — fall through to
        // the manga-id check below instead of surfacing a raw API error.
        dataSaver = [];
    }
    if (!dataSaver.length) {
        // Chapter fetch came back empty — a common cause is that this uuid is
        // actually a MANGA id (no chapter number given), so show its chapter
        // list/picker right away instead of a generic error. This also means
        // a manga with 0 chapters is immediately obvious, rather than dl
        // failing with a vague "no pages found".
        const asManga = await mangaFetch(`/manga/${chapterId}`).catch(() => null);
        if (asManga?.id) {
            await sock.sendMessage(chatId, {
                text: `📖 *Manga ID detected* — showing chapter list:`
            }, { quoted: message });
            return await handleChapterList(sock, chatId, message, chapterId, 1, titleOf(asManga));
        }
        return sock.sendMessage(chatId, { text: `❌ No pages found for chapter: \`${chapterId}\`` }, { quoted: message });
    }

    const { mangaTitle, chapterPart } = await resolveChapterLabel(chapterId, knownMeta);
    const downloaded = await downloadConcurrent(dataSaver, 3);
    return presentDownloadPicker(sock, chatId, message, { mangaTitle, items: [{ chapterPart, downloaded }] });
}

// ─── Download: multiple chapters — range or explicit list (max 5, picker) ─

// Splits a dls selector like "2", "2a", "10b" into its number and optional
// version-letter suffix.
function parseChapterSelector(sel) {
    const m = /^(\d+(?:\.\d+)?)([a-zA-Z])?$/.exec(String(sel).trim());
    if (!m) return null;
    return { num: m[1], variant: m[2] ? m[2].toLowerCase() : null };
}

// selectors: array of strings, each either a bare chapter number ("2" — grabs
// EVERY version of that chapter if it has 2a/2b/... splits) or a specific
// versioned label ("2a" — grabs just that one, resolved against the
// 'chapter' cache from the last "$manga chapters" call in this chat).
async function handleRangeDownload(sock, chatId, message, mangaId, selectors, mangaTitleHint = null) {
    if (!isUuid(mangaId)) {
        return sock.sendMessage(chatId, {
            text: `❌ Run \`$manga chapters <manga-id>\` first so I know which manga you mean, then \`$manga dls <n1,n2,...>\` or \`$manga dls <from> <to>\`.`
        }, { quoted: message });
    }
    if (!selectors.length) {
        return sock.sendMessage(chatId, { text: `❌ No chapter numbers given.` }, { quoted: message });
    }
    if (selectors.length > 5) {
        return sock.sendMessage(chatId, { text: `⚠️ Max 5 chapters per request. You gave ${selectors.length}.` }, { quoted: message });
    }

    await sock.sendMessage(chatId, {
        text: `💾 Resolving & preparing ${selectors.length} chapter${selectors.length > 1 ? 's' : ''} (${selectors.join(', ')})…\n_This may take a moment._`
    }, { quoted: message });

    let mangaTitle = mangaTitleHint || 'Manga';
    if (!mangaTitleHint) {
        try {
            const m = await mangaFetch(`/manga/${mangaId}`);
            mangaTitle = titleOf(m);
        } catch (_) { /* non-fatal — falls back to generic filename below */ }
    }

    const items = [];
    const failedChapters = [];

    for (const sel of selectors) {
        const parsed = parseChapterSelector(sel);
        if (!parsed) { failedChapters.push(`${sel} (invalid)`); continue; }

        try {
            let matches;
            if (parsed.variant) {
                // A specific version was asked for (e.g. "2a") — resolve it
                // exactly against the labeled chapter cache instead of
                // guessing by array position.
                const cachedId = resolveKind(chatId, 'chapter', sel);
                if (!isUuid(cachedId)) {
                    failedChapters.push(`${sel} (unknown — run \`$manga chapters ${mangaId}\` and use a label shown there)`);
                    continue;
                }
                matches = [{ id: cachedId, chapter: parsed.num, title: null }];
            } else {
                // Bare number — grab every readable version of it.
                matches = await resolveAllChaptersForNumber(mangaId, parsed.num);
            }

            let addedForThisNumber = 0;
            for (let vi = 0; vi < matches.length; vi++) {
                const chapter = matches[vi];
                const { dataSaver } = await fetchChapterImages(chapter.id);
                if (!dataSaver.length) continue;

                const downloaded = await downloadConcurrent(dataSaver, 3);
                const chapterPart = matches.length > 1
                    ? `Ch. ${parsed.num} (${vi + 1}/${matches.length})${chapter.title ? ` - ${chapter.title}` : ''}`
                    : `Ch. ${chapter.chapter || parsed.num}${chapter.title ? ` - ${chapter.title}` : ''}`;
                items.push({ chapterPart, downloaded });
                addedForThisNumber++;
            }

            if (!addedForThisNumber) {
                failedChapters.push(`${sel} (no pages)`);
            }
        } catch (err) {
            failedChapters.push(`${sel} (${err.message})`);
        }
    }

    if (!items.length) {
        return sock.sendMessage(chatId, {
            text: `❌ Couldn't fetch any of those chapters.\n${failedChapters.length ? `Issues: ${failedChapters.join('; ')}` : ''}`
        }, { quoted: message });
    }

    if (failedChapters.length) {
        await sock.sendMessage(chatId, { text: `⚠️ Some chapters were skipped: ${failedChapters.join('; ')}` }, { quoted: message });
    }

    return presentDownloadPicker(sock, chatId, message, { mangaTitle, items });
}

// ─── Generic paginated manga list (popular/trending/latest/new/seasonal) ──

async function handleMangaList(sock, chatId, message, { endpoint, page = 1, extraQuery = '', headerEmoji, headerTitle, cmdName, cmdExtra = '' }) {
    await sock.sendMessage(chatId, { text: `${headerEmoji} Loading ${headerTitle.toLowerCase()} (page ${page})…` }, { quoted: message });
    const data = await mangaFetch(`/${endpoint}?limit=12&page=${page}${extraQuery}`);

    const results = data?.results || [];
    if (!results.length) {
        if (page > 1) return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        return sock.sendMessage(chatId, { text: `❌ No ${headerTitle.toLowerCase()} found.` }, { quoted: message });
    }

    const p = data.pagination || {};

    const offset = trackPaged(
        chatId,
        'entity',
        results.map(m => ({ id: m.id, title: titleOf(m) })),
        page,
        (nextPage) => handleMangaList(sock, chatId, message, { endpoint, page: nextPage, extraQuery, headerEmoji, headerTitle, cmdName, cmdExtra })
    );

    const lines = results.map((m, i) => {
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        const chap   = m.lastChapter ? ` • ch.${m.lastChapter}` : '';
        return `${offset + i + 1}. ${langEmoji(m.originalLanguage)} *${titleOf(m)}*${status}${chap}\n   \`${m.id}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 ${headerEmoji} ${headerTitle.toUpperCase()} 』═━╮\n` +
            `┃ Page ${p.page || page}${p.totalPages ? `/${p.totalPages}` : ''}${data.year ? ` • Year ${data.year}` : ''}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n📖 _Details:_ \`$manga details <#>\``
    }, { quoted: message });
}

// ─── Random ─────────────────────────────────────────────────────────────────

async function handleRandom(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: `🎲 Picking a random manga…` }, { quoted: message });
    const data = await mangaFetch('/random');
    const m = data?.result;
    if (!m || !m.id) {
        return sock.sendMessage(chatId, { text: `❌ Couldn't fetch a random pick right now.` }, { quoted: message });
    }
    return handleDetails(sock, chatId, message, m.id);
}

// ─── Genres (tags) ───────────────────────────────────────────────────────────
//
// The full tag list is fetched once and cached briefly, then paginated
// client-side so long lists don't get cut off, and matched by name so
// people don't have to copy/paste tag uuids.

let _tagsCache = null;
let _tagsCacheAt = 0;
const TAGS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function getTagsFlat() {
    const now = Date.now();
    if (!_tagsCache || (now - _tagsCacheAt) > TAGS_CACHE_TTL) {
        const data = await mangaFetch('/tags');
        const groups = data?.groups || {};
        const flat = [];
        for (const g of Object.keys(groups)) {
            for (const t of groups[g]) flat.push({ id: t.id, name: t.name, group: g });
        }
        _tagsCache = flat;
        _tagsCacheAt = now;
    }
    return _tagsCache;
}

function findTagByName(tags, name) {
    const q = name.trim().toLowerCase();
    return (
        tags.find(t => t.name.toLowerCase() === q) ||
        tags.find(t => t.name.toLowerCase().startsWith(q)) ||
        tags.find(t => t.name.toLowerCase().includes(q)) ||
        null
    );
}

// Resolves a tag argument that could be: a number from the last list shown,
// a tag uuid, or a tag name/partial name (e.g. "slice of life"). Returns
// { id, name } (name may be null if we can't determine it) or null.
async function resolveTagArg(chatId, rawArg) {
    if (!rawArg) return null;
    const byNumber = resolveKind(chatId, 'tag', rawArg); // only transforms pure-digit input
    const tags = await getTagsFlat();
    if (isUuid(byNumber)) {
        return { id: byNumber, name: tags.find(t => t.id === byNumber)?.name || null };
    }
    if (isUuid(rawArg)) {
        return { id: rawArg, name: tags.find(t => t.id === rawArg)?.name || null };
    }
    const hit = findTagByName(tags, rawArg);
    return hit ? { id: hit.id, name: hit.name } : null;
}

const GENRES_PAGE_SIZE = 20;

async function handleGenres(sock, chatId, message, page = 1) {
    const tags = await getTagsFlat();
    if (!tags.length) {
        return sock.sendMessage(chatId, { text: `❌ Could not load genres.` }, { quoted: message });
    }

    const totalPages = Math.ceil(tags.length / GENRES_PAGE_SIZE);
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const slice = tags.slice((clampedPage - 1) * GENRES_PAGE_SIZE, clampedPage * GENRES_PAGE_SIZE);

    if (!slice.length) {
        return sock.sendMessage(chatId, { text: `📭 No more tags — that was the last page.` }, { quoted: message });
    }

    const offset = trackPaged(
        chatId,
        'tag',
        slice.map(t => ({ id: t.id, title: t.name })),
        clampedPage,
        (nextPage) => handleGenres(sock, chatId, message, nextPage)
    );

    let text = `╭━═『 🏷️ MANGA TAGS 』═━╮\n┃ ${tags.length} tags • page ${clampedPage}/${totalPages}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;
    let currentGroup = null;
    slice.forEach((t, i) => {
        if (t.group !== currentGroup) {
            currentGroup = t.group;
            text += `\n*${currentGroup.toUpperCase()}*\n`;
        }
        text += `${offset + i + 1}. ${t.name}\n`;
    });

    text +=
        (clampedPage < totalPages ? `\n➡️ *$manga more* — Next page\n` : '\n') +
        `📖 _Browse:_ \`$manga genre <#|name>\` _e.g._ \`$manga genre romance\``;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

async function handleGenreBrowse(sock, chatId, message, tagId, page = 1, tagName = null) {
    if (!isUuid(tagId)) {
        return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga genre <#|name|tagId> [page]\`\nSee tag names with \`$manga genres\`` }, { quoted: message });
    }

    if (tagName === null) {
        try {
            const tags = await getTagsFlat();
            tagName = tags.find(t => t.id === tagId)?.name || '';
        } catch (_) { tagName = ''; /* non-fatal — falls back to generic header below */ }
    }
    const label = tagName ? `*${tagName}*` : 'tag';

    await sock.sendMessage(chatId, { text: `🏷️ Loading (${label}) results (page ${page})…` }, { quoted: message });
    const data = await mangaFetch(`/tag/${tagId}?limit=12&page=${page}`);

    const results = data?.results || [];
    if (!results.length) {
        if (page > 1) return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        return sock.sendMessage(chatId, { text: `❌ No manga found for that tag.` }, { quoted: message });
    }

    const p = data.pagination || {};

    const offset = trackPaged(
        chatId,
        'entity',
        results.map(m => ({ id: m.id, title: titleOf(m) })),
        page,
        (nextPage) => handleGenreBrowse(sock, chatId, message, tagId, nextPage, tagName)
    );

    const lines = results.map((m, i) => {
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        return `${offset + i + 1}. ${langEmoji(m.originalLanguage)} *${titleOf(m)}*${status}\n   \`${m.id}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🏷️ TAG RESULTS 』═━╮\n` +
            (tagName ? `┃ *${tagName}*\n` : '') +
            `┃ Page ${p.page || page}/${p.totalPages || 1}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n📖 _Details:_ \`$manga details <#>\``
    }, { quoted: message });
}

// ─── Home ─────────────────────────────────────────────────────────────────────

async function handleHome(sock, chatId, message) {
    await sock.sendMessage(chatId, { text: `🏠 Loading manga homepage…` }, { quoted: message });
    const data = await mangaFetch('/home');

    const spotlight    = data?.spotlight || [];
    const newReleases  = data?.newReleases || [];
    const randomPick   = data?.randomPick;

    let text = `╭━═『 🏠 MANGA HOME 』═━╮\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n`;

    if (spotlight.length) {
        text += `\n🌟 *Spotlight:*\n`;
        text += spotlight.slice(0, 5).map((m, i) => `  ${i + 1}. *${titleOf(m)}* \`${m.id}\``).join('\n') + '\n';
    }
    if (newReleases.length) {
        text += `\n🆕 *New Releases:*\n`;
        text += newReleases.slice(0, 8).map((m, i) => `  ${i + 1}. *${titleOf(m)}* \`${m.id}\``).join('\n') + '\n';
    }
    if (randomPick?.id) {
        text += `\n🎲 *Random Pick:* *${titleOf(randomPick)}*\n  \`${randomPick.id}\`\n`;
    }

    text += `\n📖 _Details:_ \`$manga details <id>\`\n🔥 _Popular:_ \`$manga popular\`\n🆕 _Latest:_ \`$manga latest\``;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

// ─── Browse (advanced filtered search) ─────────────────────────────────────

function browseHelpText() {
    return (
        `╭━═『 🔎 MANGA BROWSE 』═━╮\n` +
        `┃ Advanced filtered search\n` +
        `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `*Usage:* \`$manga browse key=value key=value ...\`\n` +
        `Combine any of these filters (all optional):\n\n` +
        `🔤 *q=<text>*\n   free-text title search, e.g. \`q=dragon\`\n\n` +
        `📌 *status=<value>*\n   \`ongoing\`, \`completed\`, \`hiatus\`, or \`cancelled\`\n\n` +
        `👥 *demographic=<value>*\n   \`shounen\`, \`shoujo\`, \`seinen\`, or \`josei\`\n\n` +
        `🔞 *contentRating=<value>*\n   \`safe\`, \`suggestive\`, or \`erotica\`\n\n` +
        `*Examples:*\n` +
        `  \`$manga browse q=dragon status=ongoing\`\n` +
        `  \`$manga browse demographic=shounen contentRating=safe\`\n` +
        `  \`$manga browse status=completed demographic=seinen\`\n\n` +
        `_Looking for a genre/tag instead? Use \`$manga genres\` to list tags,_\n` +
        `_then \`$manga genre <#|name>\` to browse by one._\n\n` +
        `_Results are numbered — \`$manga details <#>\`, \`$manga more\` for the_\n` +
        `_next page, etc. work the same as any other list._`
    );
}

async function handleBrowse(sock, chatId, message, args, page = 1) {
    if (!args.length || args[0]?.toLowerCase() === 'help') {
        return sock.sendMessage(chatId, { text: browseHelpText() }, { quoted: message });
    }

    const params = {};
    for (const arg of args) {
        if (arg.includes('=')) {
            const [k, ...rest] = arg.split('=');
            params[k.trim()] = rest.join('=').trim();
        }
    }
    if (!params.q) params.q = '';

    const qs = new URLSearchParams(params).toString();
    await sock.sendMessage(chatId, { text: `🔎 Browsing manga (${qs})…${page > 1 ? ` (page ${page})` : ''}` }, { quoted: message });

    const data = await mangaFetch(`/search?${qs}&limit=12&page=${page}`);
    const results = data?.results || [];

    if (!results.length) {
        if (page > 1) return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        return sock.sendMessage(chatId, {
            text: `❌ No results for those filters.\n\n${browseHelpText()}`
        }, { quoted: message });
    }

    const p = data.pagination || {};

    const offset = trackPaged(
        chatId,
        'entity',
        results.map(m => ({ id: m.id, title: titleOf(m) })),
        page,
        (nextPage) => handleBrowse(sock, chatId, message, args, nextPage)
    );

    const lines = results.map((m, i) => {
        const status = m.status ? ` ${statusEmoji(m.status)}` : '';
        return `${offset + i + 1}. ${langEmoji(m.originalLanguage)} *${titleOf(m)}*${status}\n   \`${m.id}\``;
    });

    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🔎 MANGA BROWSE 』═━╮\n┃ ${qs}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            lines.join('\n\n') +
            (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n\n📖 _Details:_ \`$manga details <#>\``
    }, { quoted: message });
}

// ─── Author ───────────────────────────────────────────────────────────────────

async function handleAuthor(sock, chatId, message, query, page = 1) {
    if (isUuid(query)) {
        await sock.sendMessage(chatId, { text: `✍️ Loading author profile…` }, { quoted: message });
        const [profile, works] = await Promise.all([
            mangaFetch(`/author/${query}`),
            mangaFetch(`/author/${query}/manga`).catch(() => null),
        ]);
        if (!profile?.id) {
            return sock.sendMessage(chatId, { text: `❌ Author not found: \`${query}\`` }, { quoted: message });
        }
        const list = works?.results || [];
        const workLines = list.slice(0, 8).map((m, i) => `  ${i + 1}. *${titleOf(m)}* \`${m.id}\``).join('\n');

        return sock.sendMessage(chatId, {
            text:
                `╭━═『 ✍️ AUTHOR 』═━╮\n┃ *${profile.name}*\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                (profile.biography ? `\n📝 ${truncate(profile.biography, 400)}\n` : '') +
                (workLines ? `\n📚 *Works:*\n${workLines}\n` : '') +
                `\n📖 _Details:_ \`$manga details <id>\``
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: `🔍 Searching authors for: *${query}*…${page > 1 ? ` (page ${page})` : ''}` }, { quoted: message });
    const data = await mangaFetch(`/author/search?q=${encodeURIComponent(query)}&limit=10&page=${page}`);
    const results = data?.results || [];
    if (!results.length) {
        if (page > 1) return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        return sock.sendMessage(chatId, { text: `❌ No authors found for *${query}*.` }, { quoted: message });
    }
    const p = data.pagination || {};
    const offset = trackPaged(
        chatId,
        'author',
        results.map(a => ({ id: a.id, title: a.name })),
        page,
        (nextPage) => handleAuthor(sock, chatId, message, query, nextPage)
    );
    const lines = results.map((a, i) => `${offset + i + 1}. *${a.name}*\n   🔑 \`${a.id}\``);
    return sock.sendMessage(chatId, {
        text:
            `╭━═『 ✍️ AUTHOR SEARCH 』═━╮\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${lines.join('\n\n')}` +
            (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n\n👤 _Profile:_ \`$manga author <#>\``
    }, { quoted: message });
}

// ─── Scanlation group ──────────────────────────────────────────────────────

async function handleGroup(sock, chatId, message, query, page = 1) {
    if (isUuid(query)) {
        await sock.sendMessage(chatId, { text: `👥 Loading group profile…` }, { quoted: message });
        const [profile, chapters] = await Promise.all([
            mangaFetch(`/group/${query}`),
            mangaFetch(`/group/${query}/chapters?limit=8&page=1`).catch(() => null),
        ]);
        if (!profile?.id) {
            return sock.sendMessage(chatId, { text: `❌ Group not found: \`${query}\`` }, { quoted: message });
        }
        const list = chapters?.results || chapters?.chapters || [];
        const chapterLines = list.slice(0, 8).map((c, i) => `  ${i + 1}. Ch. ${c.chapter || '?'} \`${c.id}\``).join('\n');

        return sock.sendMessage(chatId, {
            text:
                `╭━═『 👥 SCAN GROUP 』═━╮\n┃ *${profile.name}*\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                (profile.description ? `\n📝 ${truncate(profile.description, 300)}\n` : '') +
                (profile.official ? `✅ Official\n` : '') +
                (chapterLines ? `\n📋 *Recent chapters:*\n${chapterLines}\n` : '')
        }, { quoted: message });
    }

    await sock.sendMessage(chatId, { text: `🔍 Searching groups for: *${query}*…${page > 1 ? ` (page ${page})` : ''}` }, { quoted: message });
    const data = await mangaFetch(`/group?q=${encodeURIComponent(query)}&limit=10&page=${page}`);
    const results = data?.results || [];
    if (!results.length) {
        if (page > 1) return sock.sendMessage(chatId, { text: `📭 No more results — that was the last page.` }, { quoted: message });
        return sock.sendMessage(chatId, { text: `❌ No groups found for *${query}*.` }, { quoted: message });
    }
    const p = data.pagination || {};
    const offset = trackPaged(
        chatId,
        'group',
        results.map(g => ({ id: g.id, title: g.name })),
        page,
        (nextPage) => handleGroup(sock, chatId, message, query, nextPage)
    );
    const lines = results.map((g, i) => `${offset + i + 1}. *${g.name}*${g.official ? ' ✅' : ''}\n   🔑 \`${g.id}\``);
    return sock.sendMessage(chatId, {
        text:
            `╭━═『 👥 GROUP SEARCH 』═━╮\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${lines.join('\n\n')}` +
            (p.hasNextPage ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n\n👥 _Profile:_ \`$manga group <#>\``
    }, { quoted: message });
}

// ─── Related ────────────────────────────────────────────────────────────────
// The related-titles endpoint returns one complete (unpaginated) list, so we
// slice it client-side to keep "$manga more" working consistently with the
// other list commands.

const RELATED_PAGE_SIZE = 10;

async function handleRelated(sock, chatId, message, id, page = 1) {
    if (!isUuid(id)) {
        return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga related <#|manga-id>\`` }, { quoted: message });
    }
    await sock.sendMessage(chatId, { text: `🔗 Loading related titles…` }, { quoted: message });
    const data = await mangaFetch(`/manga/${id}/related`);
    const all = data?.results || [];
    if (!all.length) {
        return sock.sendMessage(chatId, { text: `❌ No related titles found.` }, { quoted: message });
    }

    const totalPages = Math.ceil(all.length / RELATED_PAGE_SIZE);
    const clampedPage = Math.min(Math.max(page, 1), totalPages);
    const results = all.slice((clampedPage - 1) * RELATED_PAGE_SIZE, clampedPage * RELATED_PAGE_SIZE);

    const offset = trackPaged(
        chatId,
        'entity',
        results.map(m => ({ id: m.id, title: titleOf(m) })),
        clampedPage,
        (nextPage) => handleRelated(sock, chatId, message, id, nextPage)
    );
    const lines = results.map((m, i) => `${offset + i + 1}. ${langEmoji(m.originalLanguage)} *${titleOf(m)}*${m.relationType ? ` _(${m.relationType})_` : ''}\n   \`${m.id}\``);
    return sock.sendMessage(chatId, {
        text:
            `╭━═『 🔗 RELATED TITLES 』═━╮\n┃ ${all.length} related${totalPages > 1 ? ` • page ${clampedPage}/${totalPages}` : ''}\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n${lines.join('\n\n')}` +
            (clampedPage < totalPages ? `\n\n➡️ *$manga more* — Next page` : '') +
            `\n\n📖 _Details:_ \`$manga details <#>\``
    }, { quoted: message });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

async function mangaCommand(sock, chatId, message, userMessage) {
    const body  = userMessage.slice('$manga'.length).trim();
    const parts = body.split(/\s+/);
    const sub   = parts[0]?.toLowerCase() || '';
    const rest  = parts.slice(1);

    try {
        // A pending "$manga dl" format choice takes priority over normal
        // command parsing — "$manga 1" / "$manga zip" resolves it directly.
        if (hasPendingDownload(chatId)) {
            const choice = parseFormatChoice(sub) || parseFormatChoice(body);
            if (choice) return await resolveDownloadChoice(sock, chatId, message, choice);
        }

        if (!body) {
            return sock.sendMessage(chatId, {
                text:
                    `╭━═『 📖 MANGA COMMANDS 』═━╮\n\n` +
                    `🔍 *$manga <title>*              — search\n` +
                    `➡️ *$manga more*                 — next page of the last list\n` +
                    `📖 *$manga details <#|id>*       — full info + chapters\n` +
                    `📋 *$manga chapters <#|id> [pg]* — full chapter list (run this first!)\n` +
                    `👁️ *$manga read <#|chapter-id>*  — read chapter\n` +
                    `💾 *$manga dl <#|chapter-id>*    — download chapter (pick ZIP/PDF)\n` +
                    `📦 *$manga dls <f> <t>*          — chapters as separate files (max 5)\n` +
                    `🏠 *$manga home*                 — homepage\n` +
                    `🔥 *$manga popular [pg]*         — most followed\n` +
                    `📈 *$manga trending [pg]*        — top rated\n` +
                    `🆕 *$manga latest [pg]*          — recently updated\n` +
                    `✨ *$manga new [pg]*             — recent activity\n` +
                    `📅 *$manga seasonal [yr] [pg]*   — by year\n` +
                    `🎲 *$manga random*               — random pick\n` +
                    `🏷️ *$manga genres*               — tag list\n` +
                    `🏷️ *$manga genre <#|name> [pg]*  — browse by tag\n` +
                    `🔎 *$manga browse*               — advanced search (\`$manga browse help\`)\n` +
                    `✍️ *$manga author <name|#|id>*   — author search/profile\n` +
                    `👥 *$manga group <name|#|id>*    — group search/profile\n` +
                    `🔗 *$manga related <#|id>*       — related titles\n\n` +
                    `_Wherever you see <#|id>, you can use the number in front of_\n` +
                    `_the last list shown instead of copying the id._\n\n` +
                    `⚠️ *Read/dl/dls now work by chapter number/label only* — run\n` +
                    `\`$manga chapters <#|id>\` first, then use the number shown\n` +
                    `(or a letter like \`2a\`/\`2b\` if a number has multiple versions).\n` +
                    `\`dls\` targets whichever manga's chapters you last listed —\n` +
                    `a bare number grabs *every* version; a label like \`2a\` grabs just that one.\n\n` +
                    `💡 \`$manga chapters\` shows each chapter's id too — save one if you\n` +
                    `want it back later, since the number/label cache clears after a while\n` +
                    `but the id itself always works with read/dl directly.\n\n` +
                    `_Example: $manga Chainsaw Man_\n` +
                    `_Example: $manga chapters 1_\n` +
                    `_Example: $manga read 5_\n` +
                    `_Example: $manga dls 1 5_\n` +
                    `_Example: $manga dls 2,3a,3b,10_\n` +
                    `╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
            }, { quoted: message });
        }

        if (sub === 'home') return await handleHome(sock, chatId, message);
        if (sub === 'random') return await handleRandom(sock, chatId, message);
        if (sub === 'genres') return await handleGenres(sock, chatId, message, parseInt(rest[0]) || 1);

        if (sub === 'genre') {
            if (!rest.length) {
                return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga genre <#|name|tagId> [page]\`\nSee tag names with \`$manga genres\`` }, { quoted: message });
            }
            const tokens = [...rest];
            let pageArg = 1;
            if (tokens.length > 1 && /^\d+$/.test(tokens[tokens.length - 1])) {
                pageArg = parseInt(tokens.pop());
            }
            const rawTag = tokens.join(' ');
            const tag = await resolveTagArg(chatId, rawTag);
            if (!tag) {
                return sock.sendMessage(chatId, { text: `❌ No tag matched \`${rawTag}\`.\nSee names with \`$manga genres\`.` }, { quoted: message });
            }
            return await handleGenreBrowse(sock, chatId, message, tag.id, pageArg, tag.name);
        }

        if (sub === 'popular') return await handleMangaList(sock, chatId, message, {
            endpoint: 'popular', page: parseInt(rest[0]) || 1, headerEmoji: '🔥', headerTitle: 'Popular Manga', cmdName: 'popular',
        });

        if (sub === 'trending') return await handleMangaList(sock, chatId, message, {
            endpoint: 'trending', page: parseInt(rest[0]) || 1, headerEmoji: '📈', headerTitle: 'Trending Manga', cmdName: 'trending',
        });

        if (sub === 'latest') return await handleMangaList(sock, chatId, message, {
            endpoint: 'latest', page: parseInt(rest[0]) || 1, headerEmoji: '🆕', headerTitle: 'Latest Manga', cmdName: 'latest',
        });

        if (sub === 'new') return await handleMangaList(sock, chatId, message, {
            endpoint: 'new', page: parseInt(rest[0]) || 1, headerEmoji: '✨', headerTitle: 'New Activity', cmdName: 'new',
        });

        if (sub === 'seasonal') {
            const yearArg = /^\d{4}$/.test(rest[0]) ? rest[0] : null;
            const page = parseInt(yearArg ? rest[1] : rest[0]) || 1;
            return await handleMangaList(sock, chatId, message, {
                endpoint: 'seasonal', page, extraQuery: yearArg ? `&year=${yearArg}` : '',
                headerEmoji: '📅', headerTitle: 'Seasonal Manga', cmdName: 'seasonal',
                cmdExtra: yearArg ? `${yearArg} ` : '',
            });
        }

        if (sub === 'more') return await doMore(sock, chatId, message);

        if (sub === 'details' || sub === 'info') {
            const id = resolveKind(chatId, 'entity', rest[0]);
            if (!id) return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga details <#|id>\`` }, { quoted: message });
            return await handleDetails(sock, chatId, message, id);
        }

        if (sub === 'chapters') {
            const id = resolveKind(chatId, 'entity', rest[0]);
            if (!id) return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga chapters <#|manga-id> [page]\`` }, { quoted: message });
            return await handleChapterList(sock, chatId, message, id, parseInt(rest[1]) || 1);
        }

        if (sub === 'related') {
            const id = resolveKind(chatId, 'entity', rest[0]);
            if (!id) return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga related <#|manga-id>\`` }, { quoted: message });
            return await handleRelated(sock, chatId, message, id);
        }

        if (sub === 'author') {
            const q = resolveKind(chatId, 'author', rest.join(' '));
            if (!q) return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga author <name|#|id>\`` }, { quoted: message });
            return await handleAuthor(sock, chatId, message, q);
        }

        if (sub === 'group') {
            const q = resolveKind(chatId, 'group', rest.join(' '));
            if (!q) return sock.sendMessage(chatId, { text: `❌ Usage: \`$manga group <name|#|id>\`` }, { quoted: message });
            return await handleGroup(sock, chatId, message, q);
        }

        if (sub === 'read') {
            const readUsage =
                `❌ Usage: *$manga read <#|chapter-id>*\n\n` +
                `Run \`$manga chapters <manga-id>\` first to see chapter numbers/labels ` +
                `(e.g. \`3\`, or \`2a\`/\`2b\` if a number has multiple versions), then \`$manga read <#>\`.`;
            if (!rest.length) {
                return sock.sendMessage(chatId, { text: readUsage }, { quoted: message });
            }
            // rest[0] is resolved against the 'chapter' cache populated by
            // "$manga chapters <id>" (bare number or letter-suffixed label
            // like "2a"). If it isn't in that cache but IS itself a raw
            // chapter/manga uuid, pass it straight through — handleRead()
            // will notice if it's actually a manga id and show that manga's
            // chapter list instead of erroring.
            let resolvedRead = resolveKind(chatId, 'chapter', rest[0]);
            if (!isUuid(resolvedRead)) {
                if (!isUuid(rest[0])) {
                    return sock.sendMessage(chatId, { text: `❌ \`${rest[0]}\` isn't a known chapter number/label.\n\n${readUsage}` }, { quoted: message });
                }
                resolvedRead = rest[0];
                if (rest.length > 1) {
                    // Old syntax "$manga read <manga-id> <ch#>" — that form is
                    // gone, so flag it rather than silently dropping the number.
                    await sock.sendMessage(chatId, {
                        text: `ℹ️ \`$manga read <manga-id> <ch#>\` isn't supported anymore — ignoring \`${rest[1]}\`.`
                    }, { quoted: message });
                }
            }
            return await handleRead(sock, chatId, message, resolvedRead);
        }

        if (sub === 'dl' || sub === 'download') {
            const dlUsage =
                `❌ Usage: *$manga dl <#|chapter-id>*\n\n` +
                `Run \`$manga chapters <manga-id>\` first to see chapter numbers/labels ` +
                `(e.g. \`3\`, or \`2a\`/\`2b\` if a number has multiple versions), then \`$manga dl <#>\`.`;
            if (!rest.length) {
                return sock.sendMessage(chatId, { text: dlUsage }, { quoted: message });
            }
            let resolved = resolveKind(chatId, 'chapter', rest[0]);
            if (!isUuid(resolved)) {
                if (!isUuid(rest[0])) {
                    return sock.sendMessage(chatId, { text: `❌ \`${rest[0]}\` isn't a known chapter number/label.\n\n${dlUsage}` }, { quoted: message });
                }
                resolved = rest[0];
                if (rest.length > 1) {
                    // Old syntax "$manga dl <manga-id> <ch#>" — that form is
                    // gone, so flag it rather than silently dropping the number.
                    await sock.sendMessage(chatId, {
                        text: `ℹ️ \`$manga dl <manga-id> <ch#>\` isn't supported anymore — ignoring \`${rest[1]}\`.`
                    }, { quoted: message });
                }
            }
            return await handleDownload(sock, chatId, message, resolved);
        }

        if (sub === 'dls') {
            const dlsUsage =
                `❌ Usage:\n` +
                `  \`$manga dls <from> <to>\`\n` +
                `  \`$manga dls <n1,n2,n3,...>\`\n\n` +
                `Examples:\n` +
                `  \`$manga dls 1 5\`\n` +
                `  \`$manga dls 2,3a,3b,10\`\n\n` +
                `Run \`$manga chapters <manga-id>\` first so I know which manga you mean.\n` +
                `Max 5 files per request. A bare number (e.g. \`2\`) grabs *every* version of a chapter ` +
                `with 2a/2b/... splits; a specific label (e.g. \`2a\`) grabs just that one.`;

            const ctx = mangaChapterContext.get(chatId);
            if (!ctx) {
                return sock.sendMessage(chatId, { text: dlsUsage }, { quoted: message });
            }

            const selectorArgs = rest;
            if (!selectorArgs.length) {
                return sock.sendMessage(chatId, { text: dlsUsage }, { quoted: message });
            }

            const joined = selectorArgs.join(' ');
            let selectors;

            if (joined.includes(',')) {
                // Selector-list mode: "2,3a,3b,10" (commas and/or spaces)
                selectors = joined.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
            } else if (selectorArgs.length === 2 && /^\d+(\.\d+)?$/.test(selectorArgs[0]) && /^\d+(\.\d+)?$/.test(selectorArgs[1])) {
                // Range mode: "<from> <to>" — bare numbers only (grabs every
                // version of each number along the way).
                const fromN = parseFloat(selectorArgs[0]);
                const toN   = parseFloat(selectorArgs[1]);
                if (toN < fromN) {
                    return sock.sendMessage(chatId, { text: `❌ Invalid range — \`to\` must not be smaller than \`from\`.` }, { quoted: message });
                }
                if (toN - fromN + 1 > 5) {
                    return sock.sendMessage(chatId, { text: `⚠️ Max 5 chapters per request. That range is ${toN - fromN + 1} chapters.` }, { quoted: message });
                }
                selectors = [];
                for (let n = fromN; n <= toN; n++) selectors.push(String(n));
            } else {
                return sock.sendMessage(chatId, { text: dlsUsage }, { quoted: message });
            }

            // Dedupe, validate (number, optionally with a letter suffix), cap, and sort ascending
            selectors = [...new Set(selectors)].filter(s => /^\d+(\.\d+)?[a-zA-Z]?$/.test(s));
            if (!selectors.length) {
                return sock.sendMessage(chatId, { text: `❌ No valid chapter numbers/labels found in \`${joined}\`.` }, { quoted: message });
            }
            if (selectors.length > 5) {
                return sock.sendMessage(chatId, { text: `⚠️ Max 5 chapters per request. You gave ${selectors.length}.` }, { quoted: message });
            }
            selectors.sort((a, b) => parseFloat(a) - parseFloat(b));

            return await handleRangeDownload(sock, chatId, message, ctx.mangaId, selectors, ctx.mangaTitle);
        }

        if (sub === 'browse') return await handleBrowse(sock, chatId, message, rest);

        if (sub === 'search') return await handleSearch(sock, chatId, message, rest.join(' ') || body, 1);

        // Default: treat entire body as a search query
        return await handleSearch(sock, chatId, message, body);

    } catch (err) {
        console.error('[manga]', err.message);
        return sock.sendMessage(chatId, { text: `❌ Manga error: ${err.message}` }, { quoted: message });
    }
}

module.exports = { mangaCommand, mangaHandlePendingReply };
