'use strict';
/**
 * Movie / Entertainment Command — powered by DaraTech Movieapi
 * (apimovie.runflix.name.ng/v1)
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_BASE = 'https://apimovie.runflix.name.ng/v1';
const API_KEY = process.env.APIMOVIE_KEY || '';

const CACHE_FILE = path.join(__dirname, '../data/lastSearches.json');
const CACHE_MAX = 200;

const lastSearches = new Map();
const pageContext = new Map();
const resultCache = new Map();

function extractPage(text) {
    const m = (text || '').match(/\s+page\s+(\d+)\s*$/i);
    if (m) return { text: text.slice(0, m.index).trim(), page: parseInt(m[1], 10) };
    return { text: text || '', page: 1 };
}

const PAGE_SIZE_HINT = 10;

function _loadCache() {
    try {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) lastSearches.set(k, v);
    } catch { /* empty */ }
}

function _saveCache() {
    try {
        const entries = [...lastSearches.entries()];
        const trimmed = entries.slice(-CACHE_MAX);
        const obj = Object.fromEntries(trimmed);
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(obj));
    } catch { /* non-fatal */ }
}

_loadCache();

// ─── Core API fetch ─────────────────────────────────────────────────────────
async function apiFetch(pathAndQuery) {
    const sep = pathAndQuery.includes('?') ? '&' : '?';
    const url = `${API_BASE}${pathAndQuery}${sep}apikey=${API_KEY}`;
    try {
        const { data } = await axios.get(url, {
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Authorization': `Bearer ${API_KEY}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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

// ─── Type registry ──────────────────────────────────────────────────────────
const TYPES = {
    movie: { seg: 'movies', cmd: 'movie', label: 'Movie', emoji: '🎬', hasFeatured: true, hasTrending: true, hasPopular: true, hasTopRated: true, hasNew: true, hasEpisodes: true, hasDownload: true, hasRelatedEp: true },
    tv: { seg: 'tvshows', cmd: 'tv', label: 'TV Show', emoji: '📺', hasFeatured: true, hasNew: true, hasEpisodes: true, hasDownload: true, hasRelatedEp: true },
    anime: { seg: 'anime', cmd: 'anime', label: 'Anime', emoji: '🎌', hasFeatured: true, hasNew: true, hasEpisodes: true, hasDownload: true, hasRelatedEp: true },
    kids: { seg: 'kids', cmd: 'kids', label: 'Kids', emoji: '🧸', hasFeatured: false, hasNew: false, hasEpisodes: true, hasDownload: true, hasRelatedEp: true },
    ugandan: { seg: 'ugandan', cmd: 'ugandan', label: 'Ugandan VJ', emoji: '🇺🇬', hasFeatured: false, hasNew: false, hasEpisodes: true, hasDownload: true, hasRelatedEp: false, hasLatest: true },
};

function formatResult(item, i, cfg) {
    const year = item.year || '';
    const rStr = item.rating ? `  ⭐ ${item.rating}` : '';
    const genre = Array.isArray(item.genres) ? item.genres.slice(0, 3).join(', ') : '';
    const genreStr = genre ? `  🏷 ${genre}` : '';
    const durStr = item.duration ? `  ⏱ ${item.duration}` : '';
    return `${cfg.emoji} *${i + 1}.* ${item.title}\n    📅 ${year || '—'}${rStr}${genreStr}${durStr}\n    🆔 \`${item.id || item.subjectId}\``;
}

function seasonSummaryLine(seasons) {
    return (seasons || []).map(s => `S${s.season}(${s.episodes?.length || 0}ep)`).join('  ');
}

function formatDetail(d, cfg, episodeData, cmdName) {
    const id = d.id || d.subjectId;
    let msg = `${cfg.emoji} *${d.title}*\n`;
    if (d.year) msg += `📅 *Year:* ${d.year}\n`;
    msg += `🎭 *Category:* ${d.category || cfg.label}\n`;
    if (d.rating) msg += `⭐ *IMDb:* ${d.rating}/10\n`;
    if (d.duration) msg += `⏱ *Duration:* ${d.duration}\n`;
    if (d.genres?.length) msg += `🏷 *Genre:* ${d.genres.join(', ')}\n`;
    if (d.country) msg += `🌍 *Country:* ${d.country}\n`;
    if (d.language) msg += `🗣 *Language:* ${d.language}\n`;
    if (d.vjname) msg += `🎙 *VJ:* ${d.vjname}\n`;

    if (episodeData?.seasons?.length) {
        msg += `📺 *Seasons:* ${episodeData.seasons.length}  •  *Total Episodes:* ${episodeData.totalEpisodes || 0}\n`;
        msg += `📋 ${seasonSummaryLine(episodeData.seasons)}\n`;
    }

    if (d.cast?.length) {
        const names = d.cast.slice(0, 5).map(c => c.name).join(', ');
        msg += `🎭 *Cast:* ${names}\n`;
    }
    if (d.description) {
        const desc = d.description.length > 400 ? d.description.slice(0, 400) + '…' : d.description;
        msg += `\n📝 *Synopsis:*\n${desc}\n`;
    }
    msg += `\n🆔 *ID:* \`${id}\`\n`;
    msg += `💡 *$${cmdName} dl ${id}* — Download / Stream\n`;
    if (d.trailer && d.trailer !== 'NONE' && d.trailer.startsWith('http')) {
        msg += `🎬 *$${cmdName}trailer ${id}* — Watch trailer`;
    }
    return msg;
}

function buildFileName(title, epLabel) {
    const safe = str => (str || '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '.');
    const parts = [safe(title) || 'Video'];
    if (epLabel) parts.push(epLabel.replace(/\s+/g, ''));
    parts.push('Daratech');
    return parts.filter(Boolean).join('.') + '.mp4';
}

function renderList(list, cfg, header, hasMore) {
    if (!list.length) return `⚠️ No results found.`;
    const lines = list.slice(0, 15).map((it, i) => formatResult(it, i, cfg)).join('\n\n');
    let msg = `${header}\n\n${lines}\n\n💡 *$${cfg.cmd} details <id>* — Full info`;
    if (hasMore) msg += `\n➡️ *$more* — Next page`;
    return msg;
}

function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return null;
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function probeSize(url) {
    try {
        const resp = await axios.head(url, { timeout: 15000, maxRedirects: 5 });
        const len = parseInt(resp.headers['content-length']);
        return isNaN(len) ? null : len;
    } catch {
        return null;
    }
}

async function downloadToTempFile(url, tag) {
    const tmpPath = path.join(os.tmpdir(), `movie_${tag}_${Date.now()}.mp4`);
    try {
        const resp = await axios.get(url, {
            responseType: 'stream',
            timeout: 300000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(tmpPath);
            resp.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
            resp.data.on('error', reject);
        });
        return tmpPath;
    } catch (err) {
        console.warn('[movie:downloadToTempFile] failed:', err.message);
        try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
        return null;
    }
}

async function downloadBuffer(url) {
    try {
        const resp = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        return {
            buf: Buffer.from(resp.data),
            contentType: (resp.headers['content-type'] || 'video/mp4').split(';')[0].trim().toLowerCase(),
        };
    } catch (err) {
        console.warn('[movie:downloadBuffer] failed:', err.message);
        return null;
    }
}

const BUFFER_THRESHOLD = 100 * 1024 * 1024; // 100 MB

async function sendMedia(sock, chatId, message, dlUrl, title, quality, epLabel, knownSize) {
    const caption = [
        `🎬 *${title || 'Video'}*`,
        epLabel ? `📺 *Episode:* ${epLabel}` : '',
        `🎞 *Quality:* ${quality || 'Unknown'}`,
        ``,
        `_Downloaded by Daratech_ ⚡`,
    ].filter(l => l !== undefined).join('\n').replace(/\n\n\n+/g, '\n\n');

    const fileName = buildFileName(title, epLabel);
    const size = (typeof knownSize === 'number' && knownSize > 0) ? knownSize : await probeSize(dlUrl);
    const isSmallKnown = size !== null && size <= BUFFER_THRESHOLD;

    if (isSmallKnown) {
        const dlResult = await downloadBuffer(dlUrl);
        const buf = dlResult?.buf || null;
        const mimeType = (dlResult?.contentType?.startsWith('video/') ? dlResult.contentType : 'video/mp4');

        if (buf) {
            try {
                await sock.sendMessage(chatId, { video: buf, mimetype: mimeType, caption }, { quoted: message });
                return;
            } catch (err) {
                console.warn('[movie:send] buffered video failed:', err.message);
            }
            try {
                await sock.sendMessage(chatId, { document: buf, mimetype: mimeType, fileName, caption }, { quoted: message });
                return;
            } catch (err) {
                console.warn('[movie:send] buffered document failed:', err.message);
            }
        }
    }

    const tmpPath = await downloadToTempFile(dlUrl, (title || 'video').replace(/[^\w]/g, '_'));
    if (tmpPath) {
        try {
            await sock.sendMessage(chatId, { video: { url: tmpPath }, mimetype: 'video/mp4', caption }, { quoted: message });
            return;
        } catch (err) {
            console.warn('[movie:send] local-file video failed:', err.message);
        } finally {
            fs.unlink(tmpPath, () => { });
        }
    }

    try {
        await sock.sendMessage(chatId, { document: { url: dlUrl }, mimetype: 'video/mp4', fileName, caption }, { quoted: message });
        return;
    } catch (err) {
        console.warn('[movie:send] URL document failed:', err.message);
    }

    await sock.sendMessage(chatId, { text: `🔗 *Direct link:*\n${dlUrl}` }, { quoted: message });
}

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch { /* ignore */ }
}

function renderCachedPage(sock, chatId, message, cfg, headerBase, allItems, page, typeResolver) {
    resultCache.set(chatId, allItems);
    const start = (page - 1) * PAGE_SIZE_HINT;
    const slice = allItems.slice(start, start + PAGE_SIZE_HINT);

    if (!slice.length) {
        return sock.sendMessage(chatId, { text: `📭 No more results — that's everything (${allItems.length} total).` }, { quoted: message });
    }

    lastSearches.set(chatId, slice.map(it => ({ type: typeResolver(it), id: it.id || it.subjectId, title: it.title })));
    _saveCache();

    const hasMore = start + PAGE_SIZE_HINT < allItems.length;
    pageContext.set(chatId, {
        page,
        run: (nextPage) => renderCachedPage(sock, chatId, message, cfg, headerBase, allItems, nextPage, typeResolver),
    });

    const header = `${headerBase}${page > 1 ? ` (page ${page})` : ''}`;
    return sock.sendMessage(chatId, { text: renderList(slice, cfg, header, hasMore) }, { quoted: message });
}

function resolveId(chatId, rawArg) {
    const cached = lastSearches.get(chatId);
    if (!rawArg) {
        if (cached && cached[0]) return cached[0];
        return { id: null, type: null };
    }
    if (/^\d+$/.test(rawArg)) {
        const idx = parseInt(rawArg, 10) - 1;
        if (cached && cached[idx]) return cached[idx];
    }
    return { id: rawArg, type: null };
}

// ─── Universal Detail Fetcher ────────────────────────────────────────────────
async function fetchDetail(id, cfg) {
    try {
        const fullData = await apiFetch(`/detail/${encodeURIComponent(id)}/full`);
        if (fullData && (fullData.title || fullData.id || fullData.subjectId)) {
            return fullData;
        }
    } catch { /* fallback below */ }

    try {
        const uniData = await apiFetch(`/detail/${encodeURIComponent(id)}`);
        if (uniData && (uniData.title || uniData.id || uniData.subjectId)) {
            return uniData;
        }
    } catch { /* fallback below */ }

    if (cfg && cfg.seg) {
        try {
            const segData = await apiFetch(`/${cfg.seg}/detail/${encodeURIComponent(id)}`);
            if (segData && (segData.title || segData.id || segData.subjectId)) {
                return segData;
            }
        } catch { /* fallback below */ }
    }

    for (const c of Object.values(TYPES)) {
        if (cfg && c.seg === cfg.seg) continue;
        try {
            const d = await apiFetch(`/${c.seg}/detail/${encodeURIComponent(id)}`);
            if (d && (d.title || d.id || d.subjectId)) return d;
        } catch {}
    }
    throw new Error('Title details not found.');
}

// ─── Core Commands ──────────────────────────────────────────────────────────

async function doSearch(sock, chatId, message, rawQuery, typeKey, pageOverride) {
    if (!rawQuery) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey} <title>*` }, { quoted: message });
    const { text: query, page: parsedPage } = extractPage(rawQuery);
    const page = pageOverride || parsedPage;
    if (!query) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey} <title>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '🔎');

    let allItems = [];
    try {
        const data = await apiFetch(`/search/${cfg.seg}?q=${encodeURIComponent(query)}&page=${page}`);
        allItems = data.items || data.results || [];
    } catch {
        try {
            const data = await apiFetch(`/search?q=${encodeURIComponent(query)}`);
            allItems = data.items || data.results || [];
        } catch {
            try {
                const fallbackData = await apiFetch(`/${cfg.seg}`);
                allItems = (fallbackData.items || []).filter(it => (it.title || '').toLowerCase().includes(query.toLowerCase()));
            } catch { /* ignore */ }
        }
    }
    const header = `${cfg.emoji} *${cfg.label} results for "${query}"*`;
    return renderCachedPage(sock, chatId, message, cfg, header, allItems, page, () => typeKey);
}

async function doActorSearch(sock, chatId, message, rawQuery, pageOverride) {
    if (!rawQuery) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$actor <name>*` }, { quoted: message });
    const { text: query, page: parsedPage } = extractPage(rawQuery);
    const page = pageOverride || parsedPage;
    if (!query) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$actor <name>*` }, { quoted: message });
    await react(sock, message, '🔎');
    const data = await apiFetch(`/search/actor?q=${encodeURIComponent(query)}`);
    const allItems = data.items || [];
    const header = `🎭 *Titles featuring "${query}"*`;
    return renderCachedPage(sock, chatId, message, TYPES.movie, header, allItems, page, it => it.subjectType === 2 ? 'tv' : 'movie');
}

async function doDetails(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey} details <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '📄');
    const data = await fetchDetail(resolved.id, cfg);

    let episodeData = null;
    if (data.seasons?.length) {
        episodeData = { seasons: data.seasons, totalEpisodes: data.totalEpisodes || data.episodes?.length };
    } else {
        try { episodeData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/episodes`); }
        catch {
            try { episodeData = await apiFetch(`/detail/${encodeURIComponent(resolved.id)}/episodes`); } catch {}
        }
    }

    const caption = formatDetail(data, cfg, episodeData, typeKey);
    const coverUrl = data.cover || data.poster || data.backdrop;
    if (coverUrl) {
        try {
            return await sock.sendMessage(chatId, { image: { url: coverUrl }, caption }, { quoted: message });
        } catch (err) {
            console.warn('[movie:doDetails] cover image failed, sending text:', err.message);
        }
    }
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

async function doTrailer(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey}trailer <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '🎬');

    let trailerUrl = null;
    let title = 'this title';

    try {
        const trailerData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/trailer`);
        if (trailerData.trailerUrl || trailerData.trailer) trailerUrl = trailerData.trailerUrl || trailerData.trailer;
    } catch {}

    if (!trailerUrl) {
        try {
            const data = await fetchDetail(resolved.id, cfg);
            if (data.title) title = data.title;
            if (data.trailer && data.trailer !== 'NONE' && data.trailer.startsWith('http')) {
                trailerUrl = data.trailer;
            }
        } catch {}
    }

    if (!trailerUrl || !trailerUrl.startsWith('http')) {
        return sock.sendMessage(chatId, { text: `⚠️ No trailer video available for *${title}*.` }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
        video: { url: trailerUrl },
        mimetype: 'video/mp4',
        caption: `🎬 *${title}* — Trailer\n\n_Daratech_ ⚡`,
    }, { quoted: message });
}

async function doCast(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey}cast <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '🎭');

    let cast = [];
    let title = 'this title';

    try {
        const castData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/cast`);
        cast = castData.cast || castData.items || [];
    } catch {}

    if (!cast.length) {
        try {
            const data = await fetchDetail(resolved.id, cfg);
            if (data.title) title = data.title;
            cast = data.cast || [];
        } catch {}
    }

    if (!cast.length) return sock.sendMessage(chatId, { text: `⚠️ No cast info available for *${title}*.` }, { quoted: message });

    const lines = cast.slice(0, 20).map((c, i) => {
        const role = (c.role && c.role.toLowerCase() !== 'self' && c.role.toLowerCase() !== 'actor') ? ` — ${c.role}` : '';
        return `${i + 1}. *${c.name}*${role}`;
    }).join('\n');
    return sock.sendMessage(chatId, { text: `🎭 *${title} — Cast*\n\n${lines}` }, { quoted: message });
}

async function doRelated(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey}related <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '🔗');

    let title = 'this title';
    let items = [];

    try {
        const relData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/related`);
        items = relData.items || relData.results || [];
    } catch {}

    if (!items.length) {
        try {
            const detail = await fetchDetail(resolved.id, cfg);
            if (detail.title) title = detail.title;
            items = detail.related || [];
        } catch {}
    }

    if (!items.length) return sock.sendMessage(chatId, { text: `⚠️ No related titles found for *${title}*.` }, { quoted: message });

    lastSearches.set(chatId, items.map(it => ({ type: typeKey, id: it.id || it.subjectId, title: it.title })));
    _saveCache();
    const header = `🔗 *Related to "${title}"*`;
    return sock.sendMessage(chatId, { text: renderList(items, cfg, header) }, { quoted: message });
}

async function doEpisodes(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey} episodes <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '📺');

    let data = null;
    try { data = await fetchDetail(resolved.id, cfg); } catch {}

    let seasons = data?.seasons || [];
    if (!seasons.length) {
        try {
            const epData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/episodes`);
            seasons = epData.seasons || [];
            if (epData.totalEpisodes) data = { ...data, totalEpisodes: epData.totalEpisodes };
        } catch {
            try {
                const epData = await apiFetch(`/detail/${encodeURIComponent(resolved.id)}/episodes`);
                seasons = epData.seasons || [];
            } catch {}
        }
    }

    if (!seasons.length) return sock.sendMessage(chatId, { text: '⚠️ No episode data available for this title.' }, { quoted: message });

    const title = data?.title || 'Episodes';
    const totalEps = data?.totalEpisodes || seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0);

    let msg = `📺 *${title}*\n`;
    msg += `📊 *${seasons.length} Season${seasons.length === 1 ? '' : 's'} · ${totalEps} Episodes*\n\n`;

    for (const s of seasons) {
        const eps = s.episodes || [];
        msg += `━━━ *Season ${s.season}* (${eps.length} episode${eps.length === 1 ? '' : 's'}) ━━━\n`;
        eps.slice(0, 15).forEach(e => {
            const dur = e.duration ? ` · ${e.duration}min` : '';
            const epNum = e.globalEpisode ? `E${e.globalEpisode}` : `Ep ${e.episode}`;
            msg += `  ${epNum}. *${e.title || `Episode ${e.episode}`}*${dur}\n`;
        });
        if (eps.length > 15) msg += `  _...and ${eps.length - 15} more episodes_\n`;
        msg += `\n`;
    }

    msg += `💡 *$${typeKey} dl ${resolved.id} s<season>e<episode>* — download\n`;
    msg += `_e.g. $${typeKey} dl ${resolved.id} s1e1_`;
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

function parseDlTokens(tokens) {
    let season = null, episode = null, qualityToken = null;
    for (const t of tokens) {
        const se = t.match(/^s(\d+)e(\d+)$/i);
        const sOnly = t.match(/^s(\d+)$/i);
        const eOnly = t.match(/^e(\d+)$/i);
        if (se) { season = +se[1]; episode = +se[2]; continue; }
        if (sOnly) { season = +sOnly[1]; continue; }
        if (eOnly) { episode = +eOnly[1]; continue; }
        qualityToken = t;
    }
    return { season, episode, qualityToken };
}

function resolveQualityChoice(qualities, token) {
    if (!token) return null;
    if (/^\d+$/.test(token)) {
        const idx = parseInt(token, 10) - 1;
        return qualities[idx] || null;
    }
    const norm = token.toLowerCase().replace(/p$/, '');
    return qualities.find(q => String(q.resolution) === norm || (q.label || '').toLowerCase().includes(norm)) || null;
}

function dlCmdPrefix(typeKey, id, season, episode) {
    let s = `$${typeKey} dl ${id}`;
    if (season !== null) s += ` s${season}`;
    if (episode !== null) s += `e${episode}`;
    return s;
}

async function showSeasonPicker(sock, chatId, message, typeKey, id, title, episodeData) {
    const seasons = episodeData.seasons || [];
    const totalEps = episodeData.totalEpisodes || seasons.reduce((sum, s) => sum + (s.episodes?.length || 0), 0);
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let msg = `📺 *${title}*\n📊 *${seasons.length} Season${seasons.length === 1 ? '' : 's'} · ${totalEps} Total Episodes*\n\n`;
    seasons.forEach((s, i) => {
        const eps = s.episodes || [];
        msg += `${nums[i] || `${i + 1}.`}  *${s.title || `Season ${s.season}`}*  —  ${eps.length} episode${eps.length === 1 ? '' : 's'}\n`;
    });
    msg += `\n💬 *Pick a season number to browse its episodes:*\n`;
    seasons.slice(0, 3).forEach(s => {
        msg += `_${dlCmdPrefix(typeKey, id, s.season, null)}_ — Season ${s.season} episodes\n`;
    });
    msg += `_${dlCmdPrefix(typeKey, id, seasons[0]?.season ?? 1, 1)}_ — Download S${seasons[0]?.season ?? 1}E1 directly`;
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

async function showEpisodePicker(sock, chatId, message, typeKey, id, title, season, seasonEpisodes) {
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    let msg = `📺 *${title}* — Season ${season}\n`;
    msg += `📋 *${seasonEpisodes.length} Episode${seasonEpisodes.length === 1 ? '' : 's'}*\n\n`;
    seasonEpisodes.slice(0, 20).forEach((e, i) => {
        const epNum = e.globalEpisode ? `E${e.globalEpisode}` : `Ep ${e.episode}`;
        const dur = e.duration ? ` · ${e.duration}min` : '';
        msg += `${nums[i] || `${i + 1}.`}  *${e.title || `Episode ${e.episode}`}*  (${epNum}${dur})\n`;
        if (e.description) {
            const desc = e.description.length > 100 ? e.description.slice(0, 100) + '…' : e.description;
            msg += `    _${desc}_\n`;
        }
        msg += `\n`;
    });
    if (seasonEpisodes.length > 20) msg += `_...and ${seasonEpisodes.length - 20} more episodes_\n\n`;
    msg += `💬 *Download an episode:*\n_${dlCmdPrefix(typeKey, id, season, seasonEpisodes[0]?.episode ?? 1)}_ — Download Ep 1\n`;
    msg += `_${dlCmdPrefix(typeKey, id, season, (seasonEpisodes[seasonEpisodes.length - 1]?.episode ?? seasonEpisodes.length))}_ — Download last episode`;
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

async function showQualityPicker(sock, chatId, message, typeKey, id, title, qualities, season, episode, trailerAvailable) {
    const nums = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];
    let msg = `🎬 *${title}*\n\n📋 *Available Resolutions:*\n\n`;
    qualities.forEach((q, i) => {
        const label = q.label || (q.resolution ? `${q.resolution}p` : 'Auto');
        const sizeStr = formatBytes(q.size);
        msg += `${nums[i] || `${i + 1}.`}  *${label}*${sizeStr ? ` — ${sizeStr}` : ''}\n`;
    });
    const prefix = dlCmdPrefix(typeKey, id, season, episode);
    msg += `\n💬 *Pick a resolution:*\n`;
    msg += `_${prefix} 1_ — by number\n`;
    msg += `_${prefix} ${(qualities[0]?.label || '').replace(/\s.*/, '') || '480p'}_ — by quality name`;
    if (trailerAvailable) msg += `\n\n🎬 *$${typeKey}trailer ${id}* — Watch trailer first`;
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

function normalizeQualities(list) {
    return (list || []).map(q => ({ ...q, label: q.label || q.quality || (q.resolution ? `${q.resolution}p` : 'Auto') }));
}

async function doDownload(sock, chatId, message, rawArg, tokens, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey} dl <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    const id = resolved.id;
    await react(sock, message, '⬇️');

    const detail = await fetchDetail(id, cfg);
    const { season, episode, qualityToken } = parseDlTokens(tokens);

    let seasons = detail.seasons || [];
    let episodeData = null;
    if (!seasons.length) {
        try {
            episodeData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(id)}/episodes`);
            seasons = episodeData.seasons || [];
        } catch {
            try {
                episodeData = await apiFetch(`/detail/${encodeURIComponent(id)}/episodes`);
                seasons = episodeData.seasons || [];
            } catch {}
        }
    }

    if (seasons.length) {
        if (season === null) {
            return showSeasonPicker(sock, chatId, message, typeKey, id, detail.title, { seasons, totalEpisodes: detail.totalEpisodes || episodeData?.totalEpisodes });
        }
        const seasonObj = seasons.find(s => s.season === season);
        if (!seasonObj) return sock.sendMessage(chatId, { text: `⚠️ Season ${season} not found. Title has ${seasons.length} season(s).` }, { quoted: message });

        if (episode === null) {
            return showEpisodePicker(sock, chatId, message, typeKey, id, detail.title, season, seasonObj.episodes);
        }

        let qualities = [];
        const tryEndpoints = [
            `/${cfg.seg}/${encodeURIComponent(id)}/season/${season}/episode/${episode}/download`,
            `/${cfg.seg}/${encodeURIComponent(id)}/download?ep=${episode}&season=${season}`,
            `/${cfg.seg}/${encodeURIComponent(id)}/season/${season}/episode/${episode}/stream`,
            `/${cfg.seg}/${encodeURIComponent(id)}/stream?ep=${episode}&season=${season}`,
            `/download/${encodeURIComponent(id)}?ep=${episode}&season=${season}`,
            `/stream/${encodeURIComponent(id)}?ep=${episode}&season=${season}`,
        ];

        for (const epUrl of tryEndpoints) {
            try {
                const res = await apiFetch(epUrl);
                const list = normalizeQualities(res.links || res.qualities || []);
                if (list.length) { qualities = list; break; }
                if (res.url || res.streamUrl) {
                    qualities = normalizeQualities([{ url: res.url || res.streamUrl, label: 'Auto' }]);
                    break;
                }
            } catch {}
        }

        if (!qualities.length) return sock.sendMessage(chatId, { text: '📭 No download source found for this episode.' }, { quoted: message });

        if (!qualityToken) {
            return showQualityPicker(sock, chatId, message, typeKey, id, `${detail.title} — S${season}E${episode}`, qualities, season, episode, !!detail.trailer);
        }
        const pick = resolveQualityChoice(qualities, qualityToken);
        if (!pick) return sock.sendMessage(chatId, { text: `⚠️ "${qualityToken}" isn't an available resolution.` }, { quoted: message });

        const epLabel = `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;
        const sizeStr = formatBytes(pick.size);
        await sock.sendMessage(chatId, { text: `📥 Downloading *${detail.title}* (${epLabel}) — ${pick.label}${sizeStr ? ` (${sizeStr})` : ''}…\n_Please wait…_` }, { quoted: message });
        await sendMedia(sock, chatId, message, pick.url, detail.title, pick.label, epLabel, pick.size);
        return react(sock, message, '✅');
    }

    // ── Non-episodic titles (Movie, Ugandan, Kids, etc.) ──────────────────────
    let qualities = [];
    const nonEpEndpoints = [
        `/${cfg.seg}/${encodeURIComponent(id)}/download`,
        `/${cfg.seg}/${encodeURIComponent(id)}/stream`,
        `/download/${encodeURIComponent(id)}`,
        `/stream/${encodeURIComponent(id)}`,
    ];
    for (const urlPath of nonEpEndpoints) {
        try {
            const flatData = await apiFetch(urlPath);
            const list = normalizeQualities(flatData.links || flatData.qualities || []);
            if (list.length) { qualities = list; break; }
            if (flatData.url || flatData.streamUrl) {
                qualities = normalizeQualities([{ url: flatData.url || flatData.streamUrl, label: 'Auto' }]);
                break;
            }
        } catch {}
    }

    if (!qualities.length) return sock.sendMessage(chatId, { text: '📭 No download source found for this title.' }, { quoted: message });

    if (!qualityToken) {
        return showQualityPicker(sock, chatId, message, typeKey, id, detail.title, qualities, null, null, !!detail.trailer);
    }
    const pick = resolveQualityChoice(qualities, qualityToken);
    if (!pick) return sock.sendMessage(chatId, { text: `⚠️ "${qualityToken}" isn't an available resolution.` }, { quoted: message });

    const sizeStr = formatBytes(pick.size);
    await sock.sendMessage(chatId, { text: `📥 Downloading *${detail.title}* — ${pick.label}${sizeStr ? ` (${sizeStr})` : ''}…\n_Please wait…_` }, { quoted: message });
    await sendMedia(sock, chatId, message, pick.url, detail.title, pick.label, null, pick.size);
    return react(sock, message, '✅');
}

// ─── Help text ──────────────────────────────────────────────────────────────
const HELP_TEXT = `🎬 *DARATECH MOVIE BOT COMMANDS*

*🔍 Search*
▸ *$movie <title>* — movies
▸ *$tv <title>* — TV shows
▸ *$anime <title>* — anime
▸ *$kids <title>* — kids content
▸ *$ugandan <title>* — Ugandan VJ titles
▸ *$actor <name>* — search by actor

*📄 Details*
▸ *$movie details <id>* / *$tv details <id>* / *$anime details <id>*
▸ *$kids details <id>* / *$ugandan details <id>*
▸ *$moviefull <id>* — full info + cast + stills + related in one shot

*⬇️ Download*
▸ *$movie dl <id>* — resolution picker
▸ *$tv dl <id> s1e3* / *$anime dl <id> s1e3* — series episode download
▸ *$kids dl <id>* / *$ugandan dl <id>*
▸ Append quality: *$movie dl <id> 1080p* or *$movie dl <id> 2*

*📺 Episodes*
▸ *$tv episodes <id>* / *$anime episodes <id>*

*🎬 Trailer / Cast / Related*
▸ *$movietrailer <id>* *$moviecast <id>* *$movierelated <id>*
▸ *$tvtrailer <id>* *$tvcast <id>* *$tvrelated <id>*
▸ *$animetrailer <id>* *$animerelated <id>* *$kidsrelated <id>* *$kidstrailer <id>*
▸ *$moviestills <id>* / *$tvstills <id>* — screenshot gallery

*📜 Subtitles / Captions*
▸ *$moviecaptions <id>* — list available subtitle languages
▸ *$moviecaptions <id> english* — download English subtitle
▸ *$tvcaptions <id> s1e1* — list subs for a TV episode
▸ *$tvcaptions <id> s1e1 english* — download sub for TV episode
▸ *$animecaptions <id> s1e1 [lang]* / *$kidscaptions <id> [lang]*

*🇺🇬 Ugandan VJ*
▸ *$ugandan vj <name>* — titles by that VJ
▸ *$ugandanvjs* — list all VJs
▸ *$ugandanlatest* — newest uploads

*📊 Browse*
▸ *$trending* *$popular* *$upcoming* *$topmovies*
▸ *$tvnew* *$animenew*

*🏷 Filter & More*
▸ *$moviefilter <genre>* — e.g. $moviefilter action
▸ *$moviehome* — featured content
▸ *$more* — next page of last search/browse

*📡 Live TV*
▸ *$livetv* — browse all live channels
▸ *$livetvsearch <name>* — search channels
▸ *$livetvstream <id>* — watch live stream

*⚽ Live Football Matches*
▸ *$matchlive* — live matches now
▸ *$matchupcoming* — upcoming fixtures
▸ *$matchended* — recent finished matches
▸ *$matchstream <id>* — stream link for a match
▸ *$matchdetails <id>* — full match info
▸ *$matchleagues* — list leagues

💡 *IDs* — use the number from a search result or paste the full ID.`;

async function doHomepage(sock, chatId, message) {
    await react(sock, message, '🏠');
    const data = await apiFetch('/home/full');
    const rows = data.rows || [];
    if (!rows.length) return sock.sendMessage(chatId, { text: '⚠️ Could not load featured content.' }, { quoted: message });

    let msg = '🏠 *Featured Content*\n\n';
    const seen = new Set();
    const allFeaturedItems = [];
    for (const row of rows.slice(0, 4)) {
        const items = (row.items || []).filter(it => {
            if (seen.has(it.id)) return false;
            seen.add(it.id);
            return true;
        }).slice(0, 4);
        if (!items.length) continue;
        msg += `*— ${row.title} —*\n`;
        items.forEach((it) => {
            allFeaturedItems.push(it);
            const idx = allFeaturedItems.length;
            const rStr = it.rating ? `  ⭐ ${it.rating}` : '';
            msg += `${it.subjectType === 2 ? '📺' : '🎬'} *${idx}.* ${it.title}\n    📅 ${it.year || '—'}${rStr}  •  🆔 \`${it.id}\`\n`;
        });
        msg += '\n';
    }

    lastSearches.set(chatId, allFeaturedItems.map(it => ({
        type: it.subjectType === 2 ? 'tv' : 'movie',
        id: String(it.id || it.subjectId || ''),
        title: it.title
    })));
    _saveCache();

    msg += '💡 *$movie details <number or id>* — Full info';
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

async function doGenreFilter(sock, chatId, message, rawGenre, pageOverride) {
    if (!rawGenre) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$moviefilter <genre>*' }, { quoted: message });
    const { text: genre, page: parsedPage } = extractPage(rawGenre);
    const page = pageOverride || parsedPage;
    if (!genre) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$moviefilter <genre>*' }, { quoted: message });
    await react(sock, message, '🏷');
    const data = await apiFetch(`/filter?category=movies&genre=${encodeURIComponent(genre)}&page=${page}`);
    const items = data.items || [];
    lastSearches.set(chatId, items.map(it => ({ type: 'movie', id: it.id || it.subjectId, title: it.title })));
    _saveCache();
    pageContext.set(chatId, {
        page,
        run: (nextPage) => doGenreFilter(sock, chatId, message, genre, nextPage),
    });
    const header = `🏷 *${genre} movies*${page > 1 ? ` (page ${page})` : ''}`;
    return sock.sendMessage(chatId, { text: renderList(items, TYPES.movie, header, items.length >= PAGE_SIZE_HINT) }, { quoted: message });
}

async function doCaptions(sock, chatId, message, rawArg, typeKey, tokens) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey}captions <id> [lang]*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    const cachedErr = checkCachedTypeMismatch(resolved, typeKey, rawArg, 'captions');
    if (cachedErr) return sock.sendMessage(chatId, { text: cachedErr }, { quoted: message });
    await react(sock, message, '📜');

    const { season, episode, qualityToken: langFilter } = parseDlTokens(tokens || []);

    let title = 'Title';
    try {
        const d = await apiFetch(`/${cfg.seg}/detail/${encodeURIComponent(resolved.id)}`);
        if (d.title) title = d.title;
    } catch { /* ignore */ }

    let streamData;
    if (cfg.hasEpisodes) {
        if (season === null || episode === null) {
            return sock.sendMessage(chatId, { text: `⚠️ This title has episodes.\n\n*Usage:* *$${typeKey}captions ${rawArg} s<N>e<N> [lang]*\n_e.g. $${typeKey}captions ${rawArg} s1e1 english_` }, { quoted: message });
        }
        streamData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/season/${season}/episode/${episode}/stream`);
    } else {
        let seasons = [];
        try {
            const epData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/episodes`);
            seasons = epData.seasons || [];
        } catch { /* non-episodic */ }

        if (seasons.length) {
            if (season === null || episode === null) {
                return sock.sendMessage(chatId, { text: `⚠️ This title has episodes.\n\n*Usage:* *$${typeKey}captions ${rawArg} s<N>e<N> [lang]*` }, { quoted: message });
            }
            streamData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/season/${season}/episode/${episode}/stream`);
        } else {
            streamData = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/stream`);
        }
    }

    const subs = streamData.subtitles || [];
    const epLabel = (season !== null && episode !== null) ? ` S${season}E${episode}` : '';
    const fullTitle = `${title}${epLabel}`;

    if (!subs.length) return sock.sendMessage(chatId, { text: `⚠️ No subtitles available for *${fullTitle}*.` }, { quoted: message });

    if (!langFilter) {
        const langList = subs.map((s, i) => `${i + 1}. *${s.lang || 'Unknown'}*`).join('\n');
        const hint = cfg.hasEpisodes
            ? `*$${typeKey}captions ${rawArg} s${season || 1}e${episode || 1} english* — download English`
            : `*$${typeKey}captions ${rawArg} english* — download English`;
        return sock.sendMessage(chatId, {
            text: `📜 *Subtitles for "${fullTitle}"*\n\n${langList}\n\n💡 ${hint}`
        }, { quoted: message });
    }

    const targets = subs.filter(s => (s.lang || '').toLowerCase().includes(langFilter.toLowerCase()));
    if (!targets.length) {
        const available = subs.map(s => `*${s.lang || 'Unknown'}*`).join(', ');
        return sock.sendMessage(chatId, { text: `⚠️ No subtitle matching "*${langFilter}*" for *${fullTitle}*.\n\nAvailable: ${available}` }, { quoted: message });
    }

    const sub = targets[0];
    await sock.sendMessage(chatId, { text: `📥 Downloading *${sub.lang}* subtitle for *${fullTitle}*…` }, { quoted: message });
    try {
        const resp = await axios.get(sub.url, { responseType: 'arraybuffer', timeout: 30000 });
        const rawExt = (sub.url || '').split('.').pop().split('?')[0].toLowerCase();
        const ext = ['srt', 'vtt', 'ass', 'ssa'].includes(rawExt) ? rawExt : 'srt';
        const safeName = fullTitle.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '_');
        const fileName = `${safeName}_${(sub.lang || 'sub').replace(/\s+/g, '_')}.${ext}`;
        await sock.sendMessage(chatId, {
            document: Buffer.from(resp.data),
            mimetype: 'text/plain',
            fileName,
            caption: `📜 *${fullTitle}*\n🗣 *Language:* ${sub.lang}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        await sock.sendMessage(chatId, { text: `⚠️ Failed to download *${sub.lang}* subtitle: ${err.message}` }, { quoted: message });
        await react(sock, message, '❌');
    }
}

async function doStills(sock, chatId, message, rawArg, typeKey) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: `⚠️ Usage: *$${typeKey}stills <id>*` }, { quoted: message });
    const cfg = TYPES[typeKey];
    await react(sock, message, '🖼');
    const data = await apiFetch(`/${cfg.seg}/${encodeURIComponent(resolved.id)}/stills`);
    const rawStills = data.stills || data.images || (Array.isArray(data) ? data : []);
    if (!rawStills.length) return sock.sendMessage(chatId, { text: '⚠️ No stills available for this title.' }, { quoted: message });
    
    let title = 'Unknown';
    try {
        const detail = await apiFetch(`/${cfg.seg}/detail/${encodeURIComponent(resolved.id)}`);
        if (detail.title) title = detail.title;
    } catch { /* ignore */ }

    const stills = rawStills.map(s => typeof s === 'string' ? s : s.url || s.image || s.src).filter(Boolean);
    if (!stills.length) return sock.sendMessage(chatId, { text: '⚠️ Could not load stills images.' }, { quoted: message });

    await sock.sendMessage(chatId, { text: `🖼 *${title}* — ${stills.length} still(s). Sending up to 6…` }, { quoted: message });
    let sent = 0;
    for (const stillUrl of stills.slice(0, 6)) {
        try {
            await sock.sendMessage(chatId, {
                image: { url: stillUrl },
                caption: `🖼 *${title}* — Screenshot ${sent + 1}\n\n_Daratech_ ⚡`,
            }, { quoted: message });
            sent++;
        } catch { /* skip */ }
    }
    if (!sent) await sock.sendMessage(chatId, { text: '⚠️ Could not send stills images.' }, { quoted: message });
}

async function doUniversalFull(sock, chatId, message, rawArg) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$moviefull <id>*' }, { quoted: message });
    await react(sock, message, '📦');
    
    let detail = null, typeKey = resolved.type || 'movie';
    for (const k of ['movie', 'tv', 'anime', 'kids', 'ugandan']) {
        try {
            detail = await apiFetch(`/${TYPES[k].seg}/detail/${encodeURIComponent(resolved.id)}`);
            typeKey = k;
            break;
        } catch { /* continue */ }
    }
    if (!detail) return sock.sendMessage(chatId, { text: '⚠️ Title not found.' }, { quoted: message });

    const cfg = TYPES[typeKey] || TYPES.movie;
    let msg = formatDetail(detail, cfg, null, typeKey);
    
    if (detail.cast?.length) {
        msg += `\n🎭 *Full Cast:*\n` + detail.cast.slice(0, 8).map(c => `  • ${c.name}${c.role ? ` as ${c.role}` : ''}`).join('\n');
    }
    if (detail.related?.length) {
        msg += `\n\n🔗 *Related Titles:*\n` + detail.related.slice(0, 5).map((r, i) => `  ${i + 1}. ${r.title}  \`${r.id || r.subjectId}\``).join('\n');
    }

    const cover = detail.cover || detail.poster || detail.backdrop;
    if (cover) {
        try { return await sock.sendMessage(chatId, { image: { url: cover }, caption: msg }, { quoted: message }); } catch { /* fall through */ }
    }
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

async function doLiveTV(sock, chatId, message, page = 1) {
    await react(sock, message, '📡');
    const data = await apiFetch('/livetv/channels');
    const channels = data.livetv || data.channels || data.items || (Array.isArray(data) ? data : []);
    if (!channels.length) return sock.sendMessage(chatId, { text: '⚠️ No live channels found.' }, { quoted: message });

    const pageSize = 15;
    const totalPages = Math.ceil(channels.length / pageSize);
    const currPage = Math.min(Math.max(1, page), totalPages);
    const start = (currPage - 1) * pageSize;
    const slice = channels.slice(start, start + pageSize);

    lastSearches.set(chatId, slice.map(c => ({
        type: 'livetv',
        id: String(c.id || c.channelId || ''),
        title: c.name || c.title || 'Channel'
    })));
    _saveCache();

    pageContext.set(chatId, {
        page: currPage,
        run: (nextPage) => doLiveTV(sock, chatId, message, nextPage),
    });

    const lines = slice.map((c, i) =>
        `📡 *${start + i + 1}.* ${c.name || c.title || 'Channel'}\n    🆔 \`${c.id || c.channelId}\``
    ).join('\n\n');

    let text = `📡 *LIVE TV CHANNELS* (Page ${currPage}/${totalPages} — ${channels.length} total)\n\n${lines}`;
    if (currPage < totalPages) {
        text += `\n\n➡️ *$more* — Next page`;
    }
    text += `\n\n💡 *$livetvstream <number or id>* — Watch channel\n💡 *$livetvsearch <name>* — Search channel\n\n_Daratech_ ⚡`;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

async function doLiveTVSearch(sock, chatId, message, rawQuery) {
    if (!rawQuery) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$livetvsearch <channel name>*' }, { quoted: message });
    await react(sock, message, '🔍');
    const data = await apiFetch(`/livetv/search?q=${encodeURIComponent(rawQuery)}`);
    const channels = data.livetv || data.channels || data.results || data.items || (Array.isArray(data) ? data : []);
    if (!channels.length) return sock.sendMessage(chatId, { text: `⚠️ No channels found for "*${rawQuery}*".` }, { quoted: message });
    
    const slice = channels.slice(0, 15);
    lastSearches.set(chatId, slice.map(c => ({
        type: 'livetv',
        id: String(c.id || c.channelId || ''),
        title: c.name || c.title || 'Channel'
    })));
    _saveCache();

    const lines = slice.map((c, i) =>
        `📡 *${i + 1}.* ${c.name || c.title || 'Channel'}\n    🆔 \`${c.id || c.channelId}\``
    ).join('\n\n');
    return sock.sendMessage(chatId, {
        text: `🔍 *Live TV results for "${rawQuery}"*\n\n${lines}\n\n💡 *$livetvstream <number or id>* — Watch channel`
    }, { quoted: message });
}

async function doLiveTVStream(sock, chatId, message, rawArg) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$livetvstream <channel-id or number>*' }, { quoted: message });
    await react(sock, message, '📡');
    const data = await apiFetch(`/livetv/channel/${encodeURIComponent(resolved.id)}`);
    const streamUrl = data.streamUrl || data.hlsUrl || data.url;
    let msg = `📡 *${data.name || 'Live TV Channel'}*\n\n`;
    if (streamUrl) {
        msg += `🔗 *Stream URL:*\n${streamUrl}\n\n_Open in VLC or ExoPlayer to stream._`;
    } else {
        msg += `⚠️ Channel stream URL is currently offline or unavailable.`;
    }
    msg += `\n\n_Daratech_ ⚡`;
    if (data.logo) {
        try { return await sock.sendMessage(chatId, { image: { url: data.logo }, caption: msg }, { quoted: message }); } catch { /* ignore */ }
    }
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

function formatMatchTime(timeStr) {
    if (!timeStr) return '';
    try {
        const d = new Date(timeStr);
        if (isNaN(d.getTime())) return timeStr;
        const datePart = d.toISOString().split('T')[0];
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const mins = String(d.getUTCMinutes()).padStart(2, '0');
        return `${datePart} ${hours}:${mins} UTC`;
    } catch {
        return timeStr;
    }
}

function formatMatch(m, i) {
    const home = typeof m.homeTeam === 'string' ? m.homeTeam : m.homeTeam?.name || m.home || '?';
    const away = typeof m.awayTeam === 'string' ? m.awayTeam : m.awayTeam?.name || m.away || '?';
    const score = (m.score && m.score !== '0-0') ? `*${m.score}*` : 'vs';
    const status = m.status ? ` _(${m.status})_` : '';
    const league = typeof m.league === 'string' ? m.league : m.league?.name || m.leagueName || '';
    const timeStr = m.time || m.date || '';
    const formattedTime = formatMatchTime(timeStr);
    const id = m.id || m.matchId || '';

    let line = `⚽ *${i + 1}.* ${home} ${score} ${away}${status}`;
    if (league) line += `\n    🏆 ${league}`;
    if (formattedTime) line += `\n    ⏰ ${formattedTime}`;
    if (id) line += `\n    🆔 \`${id}\``;
    return line;
}

async function doMatchList(sock, chatId, message, endpoint, title, emoji, page = 1) {
    await react(sock, message, emoji);
    const data = await apiFetch(endpoint);
    const matches = data.matches || data.items || (Array.isArray(data) ? data : []);
    if (!matches.length) {
        return sock.sendMessage(chatId, { text: `${emoji} No matches found.` }, { quoted: message });
    }

    const pageSize = 10;
    const totalPages = Math.ceil(matches.length / pageSize);
    const currPage = Math.min(Math.max(1, page), totalPages);
    const start = (currPage - 1) * pageSize;
    const slice = matches.slice(start, start + pageSize);

    lastSearches.set(chatId, slice.map(m => {
        const home = typeof m.homeTeam === 'string' ? m.homeTeam : m.homeTeam?.name || m.home || '?';
        const away = typeof m.awayTeam === 'string' ? m.awayTeam : m.awayTeam?.name || m.away || '?';
        return {
            type: 'match',
            id: String(m.id || m.matchId || ''),
            title: `${home} vs ${away}`
        };
    }));
    _saveCache();

    pageContext.set(chatId, {
        page: currPage,
        run: (nextPage) => doMatchList(sock, chatId, message, endpoint, title, emoji, nextPage),
    });

    const lines = slice.map((m, i) => formatMatch(m, start + i)).join('\n\n');
    let text = `${emoji} *${title}* (Page ${currPage}/${totalPages} — ${matches.length} total)\n\n${lines}`;

    if (currPage < totalPages) {
        text += `\n\n➡️ *$more* — Next page`;
    }
    text += `\n\n💡 *$matchstream <number or id>* — Stream link\n💡 *$matchdetails <number or id>* — Match info\n\n_Daratech_ ⚡`;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

async function doMatchLive(sock, chatId, message) {
    return doMatchList(sock, chatId, message, '/football/live', 'LIVE FOOTBALL MATCHES', '⚽');
}

async function doMatchUpcoming(sock, chatId, message) {
    return doMatchList(sock, chatId, message, '/football/upcoming', 'UPCOMING FIXTURES', '📅');
}

async function doMatchEnded(sock, chatId, message) {
    return doMatchList(sock, chatId, message, '/football/finished', 'ENDED MATCHES', '🏁');
}

async function doMatchLeagues(sock, chatId, message, rawQuery, page = 1) {
    await react(sock, message, '🏆');
    const data = await apiFetch('/football/leagues');
    let leagues = data.leagues || data.items || (Array.isArray(data) ? data : []);
    if (rawQuery) {
        leagues = leagues.filter(l => (l.name || '').toLowerCase().includes(rawQuery.toLowerCase()));
    }
    if (!leagues.length) return sock.sendMessage(chatId, { text: `⚠️ No leagues found${rawQuery ? ` matching "${rawQuery}"` : ''}.` }, { quoted: message });

    const pageSize = 15;
    const totalPages = Math.ceil(leagues.length / pageSize);
    const currPage = Math.min(Math.max(1, page), totalPages);
    const start = (currPage - 1) * pageSize;
    const slice = leagues.slice(start, start + pageSize);

    lastSearches.set(chatId, slice.map(l => ({
        type: 'league',
        id: String(l.id || l.leagueId || ''),
        title: l.name || l.leagueName || String(l)
    })));
    _saveCache();

    pageContext.set(chatId, {
        page: currPage,
        run: (nextPage) => doMatchLeagues(sock, chatId, message, rawQuery, nextPage),
    });

    const lines = slice.map((l, i) =>
        `🏆 *${start + i + 1}.* ${l.name || l.leagueName || String(l)}${l.id || l.leagueId ? `\n    🆔 \`${l.id || l.leagueId}\`` : ''}`
    ).join('\n\n');

    let text = `🏆 *FOOTBALL LEAGUES* (Page ${currPage}/${totalPages} — ${leagues.length} total)\n\n${lines}`;
    if (currPage < totalPages) {
        text += `\n\n➡️ *$more* — Next page`;
    }
    text += `\n\n_Daratech_ ⚡`;

    return sock.sendMessage(chatId, { text }, { quoted: message });
}

async function doMatchStream(sock, chatId, message, rawArg) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$matchstream <match-id>*' }, { quoted: message });
    await react(sock, message, '📺');
    const data = await apiFetch(`/football/stream/${encodeURIComponent(resolved.id)}`);
    const hlsUrl = data.hlsUrl || data.url || data.streamUrl;
    if (!hlsUrl) return sock.sendMessage(chatId, { text: '⚠️ No stream URL available for this match.' }, { quoted: message });
    return sock.sendMessage(chatId, {
        text: `📺 *Match Stream Link*\n\n🔗 ${hlsUrl}\n\n_Open in VLC or HLS-compatible player._\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function doMatchDetails(sock, chatId, message, rawArg) {
    const resolved = resolveId(chatId, rawArg);
    if (!resolved.id) return sock.sendMessage(chatId, { text: '⚠️ Usage: *$matchdetails <match-id>*' }, { quoted: message });
    await react(sock, message, '📋');
    const data = await apiFetch(`/football/details/${encodeURIComponent(resolved.id)}`);
    const home = typeof data.homeTeam === 'string' ? data.homeTeam : data.homeTeam?.name || data.home || '?';
    const away = typeof data.awayTeam === 'string' ? data.awayTeam : data.awayTeam?.name || data.away || '?';
    const score = data.score || 'TBD';
    const league = typeof data.league === 'string' ? data.league : data.league?.name || data.leagueName || '';
    const status = data.status || 'Unknown';
    const streams = data.streams || [];
    let msg = `⚽ *MATCH DETAILS*\n\n`;
    msg += `🏠 *Home:* ${home}\n`;
    msg += `✈️ *Away:* ${away}\n`;
    msg += `📊 *Score:* ${score}\n`;
    msg += `📌 *Status:* ${status}\n`;
    if (league) msg += `🏆 *League:* ${league}\n`;
    if (data.date) msg += `📅 *Date:* ${data.date}\n`;
    if (streams.length) {
        msg += `\n📺 *Stream Links:*\n`;
        streams.slice(0, 3).forEach((s, i) => { msg += `  ${i + 1}. ${s.url || s}\n`; });
    } else {
        msg += `\n💡 *$matchstream ${resolved.id}* — Stream link`;
    }
    msg += `\n\n_Daratech_ ⚡`;
    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

async function doUgandanVj(sock, chatId, message, vjName, pageOverride) {
    if (!vjName) {
        await react(sock, message, '🎙');
        const data = await apiFetch('/ugandan/vjs');
        const vjs = data.vjs || [];
        const lines = vjs.map((v, i) => `${i + 1}. ${v.name || v}`).join('\n');
        return sock.sendMessage(chatId, { text: `🎙 *Available VJs*\n\n${lines}\n\n💡 *$ugandan vj <name>* — browse by VJ` }, { quoted: message });
    }
    const { text: name, page: parsedPage } = extractPage(vjName);
    const page = pageOverride || parsedPage;
    await react(sock, message, '🎙');
    const data = await apiFetch(`/ugandan/vj/${encodeURIComponent(name)}`);
    const allItems = data.items || [];
    const header = `🎙 *Titles by ${name}*`;
    return renderCachedPage(sock, chatId, message, TYPES.ugandan, header, allItems, page, () => 'ugandan');
}

async function doBrowse(sock, chatId, message, basePath, typeKey, headerLabel, page = 1) {
    await react(sock, message, '📚');
    const sep = basePath.includes('?') ? '&' : '?';
    const data = await apiFetch(`${basePath}${sep}page=${page}`);
    const items = data.items || [];
    lastSearches.set(chatId, items.map(it => ({ type: typeKey, id: it.id || it.subjectId, title: it.title })));
    _saveCache();
    pageContext.set(chatId, {
        page,
        run: (nextPage) => doBrowse(sock, chatId, message, basePath, typeKey, headerLabel, nextPage),
    });
    const header = `${TYPES[typeKey].emoji} *${headerLabel}*${page > 1 ? ` (page ${page})` : ''}`;
    return sock.sendMessage(chatId, { text: renderList(items, TYPES[typeKey], header, items.length >= PAGE_SIZE_HINT) }, { quoted: message });
}

async function doMore(sock, chatId, message) {
    const ctx = pageContext.get(chatId);
    if (!ctx) {
        return sock.sendMessage(chatId, { text: `⚠️ Nothing to continue — run a search or browse command first.` }, { quoted: message });
    }
    await react(sock, message, '➡️');
    return ctx.run(ctx.page + 1);
}

// ─── Main Dispatcher ────────────────────────────────────────────────────────
async function movieCommand(sock, chatId, message, args, subcommand) {
    const rest = args.join(' ').trim();
    const [a1, a2, a3] = args;

    try {
        switch (subcommand) {
            case 'search:movie': if (!rest) return sock.sendMessage(chatId, { text: HELP_TEXT }, { quoted: message }); return await doSearch(sock, chatId, message, rest, 'movie');
            case 'search:tv': return await doSearch(sock, chatId, message, rest || a1, 'tv');
            case 'search:anime': return await doSearch(sock, chatId, message, rest || a1, 'anime');
            case 'search:kids': return await doSearch(sock, chatId, message, rest || a1, 'kids');
            case 'search:ugandan': return await doSearch(sock, chatId, message, rest || a1, 'ugandan');
            case 'search:actor': return await doActorSearch(sock, chatId, message, rest);

            case 'details:movie': return await doDetails(sock, chatId, message, a1, 'movie');
            case 'details:tv': return await doDetails(sock, chatId, message, a1, 'tv');
            case 'details:anime': return await doDetails(sock, chatId, message, a1, 'anime');
            case 'details:kids': return await doDetails(sock, chatId, message, a1, 'kids');
            case 'details:ugandan': return await doDetails(sock, chatId, message, a1, 'ugandan');

            case 'dl:movie': return await doDownload(sock, chatId, message, a1, args.slice(1), 'movie');
            case 'dl:tv': return await doDownload(sock, chatId, message, a1, args.slice(1), 'tv');
            case 'dl:anime': return await doDownload(sock, chatId, message, a1, args.slice(1), 'anime');
            case 'dl:kids': return await doDownload(sock, chatId, message, a1, args.slice(1), 'kids');
            case 'dl:ugandan': return await doDownload(sock, chatId, message, a1, args.slice(1), 'ugandan');

            case 'trailer:movie': return await doTrailer(sock, chatId, message, a1, 'movie');
            case 'trailer:tv': return await doTrailer(sock, chatId, message, a1, 'tv');
            case 'trailer:anime': return await doTrailer(sock, chatId, message, a1, 'anime');
            case 'trailer:kids': return await doTrailer(sock, chatId, message, a1, 'kids');

            case 'cast:movie': return await doCast(sock, chatId, message, a1, 'movie');
            case 'cast:tv': return await doCast(sock, chatId, message, a1, 'tv');
            case 'related:movie': return await doRelated(sock, chatId, message, a1, 'movie');
            case 'related:tv': return await doRelated(sock, chatId, message, a1, 'tv');
            case 'related:anime': return await doRelated(sock, chatId, message, a1, 'anime');
            case 'related:kids': return await doRelated(sock, chatId, message, a1, 'kids');

            case 'stills:movie': return await doStills(sock, chatId, message, a1, 'movie');
            case 'stills:tv': return await doStills(sock, chatId, message, a1, 'tv');

            case 'full:universal': return await doUniversalFull(sock, chatId, message, a1);

            case 'episodes:movie': return await doEpisodes(sock, chatId, message, a1, 'movie');
            case 'episodes:tv': return await doEpisodes(sock, chatId, message, a1, 'tv');
            case 'episodes:anime': return await doEpisodes(sock, chatId, message, a1, 'anime');
            case 'episodes:kids': return await doEpisodes(sock, chatId, message, a1, 'kids');
            case 'episodes:ugandan': return await doEpisodes(sock, chatId, message, a1, 'ugandan');

            case 'captions:movie': return await doCaptions(sock, chatId, message, a1, 'movie', args.slice(1));
            case 'captions:tv': return await doCaptions(sock, chatId, message, a1, 'tv', args.slice(1));
            case 'captions:anime': return await doCaptions(sock, chatId, message, a1, 'anime', args.slice(1));
            case 'captions:kids': return await doCaptions(sock, chatId, message, a1, 'kids', args.slice(1));

            case 'ugandan:vj': return await doUgandanVj(sock, chatId, message, rest);
            case 'ugandan:latest': return await doBrowse(sock, chatId, message, '/ugandan/latest', 'ugandan', 'Latest Ugandan VJ titles');

            case 'trending': return await doBrowse(sock, chatId, message, '/movies/trending', 'movie', 'Trending Movies');
            case 'popular': return await doBrowse(sock, chatId, message, '/movies/popular', 'movie', 'Popular Movies');
            case 'upcoming': return await doBrowse(sock, chatId, message, '/movies/new', 'movie', 'New Movies');
            case 'topmovies': return await doBrowse(sock, chatId, message, '/movies/top-rated', 'movie', 'Top-Rated Movies');
            case 'tvnew': return await doBrowse(sock, chatId, message, '/tvshows/new', 'tv', 'New TV Shows');
            case 'animenew': return await doBrowse(sock, chatId, message, '/anime/new', 'anime', 'New Anime');

            case 'homepage': return await doHomepage(sock, chatId, message);
            case 'moviefilter': return await doGenreFilter(sock, chatId, message, rest);

            case 'livetv': return await doLiveTV(sock, chatId, message);
            case 'livetv:search': return await doLiveTVSearch(sock, chatId, message, rest);
            case 'livetv:stream': return await doLiveTVStream(sock, chatId, message, a1);

            case 'match:live': return await doMatchLive(sock, chatId, message);
            case 'match:upcoming': return await doMatchUpcoming(sock, chatId, message);
            case 'match:ended': return await doMatchEnded(sock, chatId, message);
            case 'match:leagues': return await doMatchLeagues(sock, chatId, message, rest);
            case 'match:stream': return await doMatchStream(sock, chatId, message, a1);
            case 'match:details': return await doMatchDetails(sock, chatId, message, a1);

            case 'more': return await doMore(sock, chatId, message);

            default:
                return sock.sendMessage(chatId, { text: HELP_TEXT }, { quoted: message });
        }
    } catch (err) {
        console.error('[movie.js] Error:', err.message);
        return sock.sendMessage(chatId, { text: `⚠️ Error: ${err.message}` }, { quoted: message });
    }
}

const SUBCOMMANDS = {
    movie: 'search:movie',
    'movie details': 'details:movie',
    'movie dl': 'dl:movie',
    'movie episodes': 'episodes:movie',
    movietrailer: 'trailer:movie',
    trailer: 'trailer:movie',
    moviecast: 'cast:movie',
    movierelated: 'related:movie',
    moviecaptions: 'captions:movie',
    moviesub: 'captions:movie',
    moviestills: 'stills:movie',
    moviefull: 'full:universal',
    moviehome: 'homepage',
    moviefilter: 'moviefilter',

    tv: 'search:tv',
    'tv details': 'details:tv',
    'tv dl': 'dl:tv',
    'tv episodes': 'episodes:tv',
    tvtrailer: 'trailer:tv',
    tvcast: 'cast:tv',
    tvrelated: 'related:tv',
    tvcaptions: 'captions:tv',
    tvstills: 'stills:tv',
    tvnew: 'tvnew',

    anime: 'search:anime',
    'anime details': 'details:anime',
    'anime dl': 'dl:anime',
    'anime episodes': 'episodes:anime',
    animetrailer: 'trailer:anime',
    animerelated: 'related:anime',
    animecaptions: 'captions:anime',
    animenew: 'animenew',

    kids: 'search:kids',
    'kids details': 'details:kids',
    'kids dl': 'dl:kids',
    'kids episodes': 'episodes:kids',
    kidsrelated: 'related:kids',
    kidscaptions: 'captions:kids',
    kidstrailer: 'trailer:kids',

    ugandan: 'search:ugandan',
    'ugandan details': 'details:ugandan',
    'ugandan dl': 'dl:ugandan',
    'ugandan episodes': 'episodes:ugandan',
    'ugandan vj': 'ugandan:vj',
    ugandanvjs: 'ugandan:vj',
    ugandanlatest: 'ugandan:latest',

    actor: 'search:actor',

    trending: 'trending',
    popular: 'popular',
    upcoming: 'upcoming',
    topmovies: 'topmovies',

    livetv: 'livetv',
    tvchannel: 'livetv',
    channels: 'livetv',
    live: 'livetv',
    livetvsearch: 'livetv:search',
    livesearch: 'livetv:search',
    livetvstream: 'livetv:stream',
    livestream: 'livetv:stream',

    matchlive: 'match:live',
    matchupcoming: 'match:upcoming',
    matchended: 'match:ended',
    matchleagues: 'match:leagues',
    matchstream: 'match:stream',
    matchdetails: 'match:details',

    more: 'more',
};

module.exports = movieCommand;
module.exports.SUBCOMMANDS = SUBCOMMANDS;
