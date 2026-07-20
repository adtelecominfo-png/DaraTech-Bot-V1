'use strict';
/**
 * Movie Command — powered by RUNFLIX API (movieapi.runflix.name.ng)
 *
 * Main:    $movie <title>           → search
 * Sub:     $movie details <id>      → full info + poster
 *          $movie dl <id>           → download / stream links
 *
 * Browse:  $trending  $popular  $upcoming  $schedule
 * Anime:   $anime <title>    $anime dl <id>
 * Live TV: $live  $livesearch <name>  $livestream <id>  $livecats
 * Filter:  $moviefilter <genre or platform>[,type]
 * Extra:   $moviecaptions <id>   $moviehome
 */

// Use axios — it correctly preserves Authorization headers through redirects,
// unlike node-fetch which strips them (causing 403 on shared hosting servers).
const axios = require('axios');
const fs     = require('fs');
const path   = require('path');

const MOVIE_BASE   = 'https://runflix-api-v-3263--trumpmax.replit.app/api/v3';
const CACHE_FILE   = path.join(__dirname, '../data/lastSearches.json');
const CACHE_MAX    = 200; // max chatIds kept in file (rolling)

// ── Persistent search-result cache ───────────────────────────────────────────
// Survives bot restarts so $movie dl 1 still works after .update
const lastSearches = new Map();

function _loadCache() {
    try {
        const raw = fs.readFileSync(CACHE_FILE, 'utf8');
        const obj = JSON.parse(raw);
        for (const [k, v] of Object.entries(obj)) lastSearches.set(k, v);
    } catch { /* no file yet or parse error — start empty */ }
}

function _saveCache() {
    try {
        // Keep only the most recent CACHE_MAX entries to avoid unbounded growth
        const entries = [...lastSearches.entries()];
        const trimmed = entries.slice(-CACHE_MAX);
        const obj = Object.fromEntries(trimmed);
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(obj));
    } catch { /* non-fatal */ }
}

_loadCache();

async function apiFetch(path) {
    const url = `${MOVIE_BASE}${path}`;
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
        return data;
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message || err.message || `HTTP ${status || 'timeout'}`;
        throw new Error(msg);
    }
}

/**
 * shortenUrl — same backends as the bot's own $vgd / $tinyurl commands.
 * Chain: v.gd (direct) → TinyURL (direct) → original URL
 */
async function shortenUrl(longUrl) {
    const enc = encodeURIComponent(longUrl);

    // 1️⃣ v.gd — same call as _shortenDirect('vgd')
    try {
        const { data } = await axios.get(
            `https://v.gd/create.php?format=json&url=${enc}`,
            { timeout: 8000 }
        );
        if (data?.shorturl) return data.shorturl;
    } catch { /* fall through */ }

    // 2️⃣ TinyURL — same call as _shortenDirect('ssur') fallback
    try {
        const { data } = await axios.get(
            `https://tinyurl.com/api-create.php?url=${enc}`,
            { timeout: 8000, responseType: 'text' }
        );
        const short = (data || '').trim();
        if (short.startsWith('http') && short.length < longUrl.length) return short;
    } catch { /* fall through */ }

    return longUrl;   // all services failed — return original
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function mediaEmoji(type) {
    if (!type) return '🎬';
    const t = type.toLowerCase();
    if (t.includes('anime'))                                        return '🎌';
    if (t.includes('series') || t.includes('tv') || t.includes('show')) return '📺';
    if (t.includes('live'))                                         return '📡';
    return '🎬';
}

function fileSize(bytes) {
    const b = parseInt(bytes);
    if (!b || isNaN(b)) return '';
    if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
    if (b >= 1e6) return `${Math.round(b / 1e6)} MB`;
    return `${Math.round(b / 1e3)} KB`;
}

/**
 * Unified result formatter — handles both movie (subjectId/cover.url/genre string)
 * and anime/upcoming (id/thumbnail/genres array) item shapes.
 */
function formatResult(item, i) {
    const em     = mediaEmoji(item.type || item.format || '');
    const id     = item.subjectId || item.id || '';
    const year   = (item.releaseDate || item.airingDate || '').slice(0, 4) || item.year || '';
    const type   = item.type || item.format || 'Movie';
    const rating = item.imdbRatingValue || item.imdbRate || item.rating;
    const rStr   = rating ? `  ⭐ ${rating}` : '';
    const genre  = Array.isArray(item.genres)
        ? item.genres.slice(0, 3).join(', ')
        : (item.genre || '');
    const genreStr = genre ? `  🏷 ${genre}` : '';
    return `${em} *${i + 1}.* ${item.title || item.name}\n    📅 ${year || '—'}  •  ${type}${rStr}${genreStr}\n    🆔 \`${id}\``;
}

function formatInfo(data) {
    const d  = data.results || data;
    const em = mediaEmoji(d.type);
    let msg  = `${em} *${d.title || d.name}*\n`;

    if (d.releaseDate)                          msg += `📅 *Year:* ${d.releaseDate.slice(0, 4)}\n`;
    if (d.type)                                 msg += `🎭 *Type:* ${d.type}\n`;
    const rating = d.imdbRatingValue || d.rating || d.imdbRate;
    if (rating)                                 msg += `⭐ *IMDb:* ${rating}/10\n`;
    if (d.duration)                             msg += `⏱ *Duration:* ${d.duration}\n`;
    if (d.genre)                                msg += `🏷 *Genre:* ${d.genre}\n`;
    if (d.countryName || d.country)             msg += `🌍 *Country:* ${d.countryName || d.country}\n`;
    if (d.language)                             msg += `🗣 *Language:* ${d.language}\n`;

    // Season / episode breakdown — shown for any series regardless of detail level
    if (d.seasonDetails && d.seasonDetails.length) {
        const totalEps = d.totalEpisodes
            || d.seasonDetails.reduce((a, s) => a + (s.totalEpisodes || 0), 0);
        const seasonLines = d.seasonDetails.map(s =>
            `S${s.season}` + (s.totalEpisodes ? `(${s.totalEpisodes}ep)` : '')
        ).join('  ');
        msg += `📺 *Seasons:* ${d.seasonDetails.length}`;
        if (totalEps) msg += `  •  *Total Episodes:* ${totalEps}`;
        msg += `\n📋 ${seasonLines}\n`;
    } else if (d.seasons) {
        // Only season count available — still show it
        msg += `📺 *Seasons:* ${d.seasons}`;
        if (d.totalEpisodes) msg += `  •  *Total Episodes:* ${d.totalEpisodes}`;
        msg += `\n`;
    }

    // Dubs / audio languages available
    const dubList = d.dubs || d.audioTracks || [];
    if (dubList.length > 1) {
        const langs = dubList.map(dub => dub.lanName || dub.lanCode || dub.language).filter(Boolean);
        msg += `🌐 *Available Dubs:* ${langs.join(' | ')}\n`;
    }

    if (d.staffList && d.staffList.length) {
        const dirs = d.staffList.filter(s => s.staffType === 2).slice(0, 2).map(s => s.name);
        const cast = [...new Set(d.staffList.filter(s => s.staffType === 1).map(s => s.name))].slice(0, 5);
        if (dirs.length) msg += `🎬 *Director:* ${dirs.join(', ')}\n`;
        if (cast.length) msg += `🎭 *Cast:* ${cast.join(', ')}\n`;
    }

    const synopsis = d.description || d.overview || d.plot || '';
    if (synopsis) msg += `\n📝 *Synopsis:*\n${synopsis.slice(0, 500)}${synopsis.length > 500 ? '...' : ''}`;

    const id = d.subjectId || d.id;
    if (id) {
        msg += `\n\n🆔 *ID:* \`${id}\``;
        msg += `\n💡 *$movie dl ${id}* — Resolution picker & download`;
        if (d.trailer?.VideoAddress?.url) msg += `\n🎬 *$movietrailer ${id}* — Watch official trailer`;
    }
    return msg;
}

/**
 * dedupeByQuality — for duplicate quality labels keep only the source
 * with the highest file size (best encode wins).
 */
function dedupeByQuality(sources) {
    const map = new Map();
    for (const s of sources) {
        const key  = (s.quality || 'unknown').toLowerCase().replace(/\s+/g, '');
        const size = parseInt(s.size) || 0;
        if (!map.has(key) || size > (parseInt(map.get(key).size) || 0)) {
            map.set(key, s);
        }
    }
    return [...map.values()];
}

// ─── Series helpers ───────────────────────────────────────────────────────────

function isSeriesType(type) {
    if (!type) return false;
    const t = type.toLowerCase();
    return t.includes('series') || t.includes('tv') || t.includes('show');
}

/**
 * parsePick — split user's pick string into season, episode, audio index, quality.
 * Supports: "s1e3", "s2", "s1e5 1080p", "1080p audio:2", "s1e3 720p audio:1"
 */
function parsePick(pick) {
    const seMatch    = pick.match(/\bs(\d+)e(\d+)\b/i);
    const sOnly      = !seMatch && pick.match(/\bs(\d+)\b/i);
    const audioMatch = pick.match(/\baudio:(\d+)\b/i);
    const cleaned    = pick
        .replace(/\bs\d+e\d+\b/gi, '')
        .replace(/\bs\d+\b/gi, '')
        .replace(/\baudio:\d+\b/gi, '')
        .trim();
    return {
        season:     seMatch  ? parseInt(seMatch[1])  : (sOnly ? parseInt(sOnly[1]) : null),
        episode:    seMatch  ? parseInt(seMatch[2])  : null,
        audioIndex: audioMatch ? parseInt(audioMatch[1]) : null,
        quality:    cleaned  || null,
    };
}

// ─── Size limits ──────────────────────────────────────────────────────────────
const VIDEO_LIMIT = 64  * 1024 * 1024; // 64 MB  — WA video message ceiling
const DOC_LIMIT   = 2   * 1024 * 1024 * 1024; // 2 GB  — WA document ceiling

/**
 * downloadBuffer — fetch a URL into a Buffer.
 * Returns null (don't attempt) if the file is already known to exceed VIDEO_LIMIT,
 * or if the download itself fails (caller falls back to link).
 */
async function downloadBuffer(url, sizeHint) {
    // Skip downloading if the known file size is already over the video ceiling
    const knownSize = parseInt(sizeHint) || 0;
    if (knownSize > VIDEO_LIMIT) return null;

    try {
        const resp = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 120000,        // 2 min — large files need time
            maxContentLength: VIDEO_LIMIT + 1,
            maxBodyLength:    VIDEO_LIMIT + 1,
        });
        return Buffer.from(resp.data);
    } catch (err) {
        console.warn('[movie:downloadBuffer] failed:', err.message);
        return null;
    }
}

// ─── Filename builder ──────────────────────────────────────────────────────────
/**
 * buildFileName — constructs a clean document filename.
 * Format: Title.SxxExx.Quality.Daratech.mp4  (episode parts optional)
 */
function buildFileName(title, epLabel, quality) {
    const safe  = str => (str || '').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '.');
    const parts = [safe(title) || 'Video'];
    if (epLabel) parts.push(epLabel.replace(/\s+/g, ''));   // "S01E03" already clean
    if (quality)  parts.push(safe(quality));
    parts.push('Daratech');
    return parts.filter(Boolean).join('.') + '$mp4';
}

/**
 * parseSources — normalise both movie & anime source shapes into a flat array.
 *   Movie:  data.results[]  + data.subtitles[]  + data.audioTracks[]
 *   Anime:  data.results.sources[]  + data.results.subtitles[]  + …
 */
function parseSources(data) {
    return {
        sources:     Array.isArray(data.results) ? data.results : (data.results?.sources || []),
        subtitles:   data.subtitles   || data.results?.subtitles   || [],
        audioTracks: data.audioTracks || data.results?.audioTracks || [],
    };
}

/**
 * sendAsDocument — core sender.
 * Tries to send as a video message (inline player, ≤ VIDEO_LIMIT).
 * If that fails or the file is too large, sends a plain-text link instead.
 *
 * @param epLabel  e.g. "S01E03" — used in caption; pass null for movies
 */
async function sendAsDocument(sock, chatId, message, dlUrl, title, quality, epLabel, linksText, sizeHint) {
    const caption = [
        `🎬 *${title || 'Movie'}*`,
        epLabel ? `📺 *Episode:* ${epLabel}` : '',
        `🎞 *Quality:* ${quality || 'Unknown'}`,
        ``,
        `_Downloaded by Daratech_`,
    ].filter(l => l !== undefined).join('\n').replace(/\n\n\n+/g, '\n\n');

    // Download to buffer — CDN URLs are short-lived signed tokens; passing
    // them directly to WA's servers often results in a 403 after expiry.
    const buf      = await downloadBuffer(dlUrl, sizeHint);
    const size     = buf?.length || parseInt(sizeHint) || 0;
    const sizeStr  = size ? fileSize(String(size)) : '';

    // ── Attempt: send as video (inline player, ≤ VIDEO_LIMIT) ───────────────────
    if (buf && size <= VIDEO_LIMIT) {
        try {
            await sock.sendMessage(chatId, {
                video: buf, mimetype: 'video/mp4', caption,
            }, { quoted: message });
            if (linksText) await sock.sendMessage(chatId, { text: linksText }, { quoted: message });
            return;
        } catch (videoErr) {
            console.warn('[movie:send] video send failed, falling back to link:', videoErr.message);
        }
    }

    // ── Fallback: links message ───────────────────────────────────────────────────
    // Determine why we couldn't send as video
    const tooLarge = size > VIDEO_LIMIT || (!buf && parseInt(sizeHint) > VIDEO_LIMIT);
    const reasonLine = tooLarge
        ? `⚠️ File too large to send as video _(${quality ? quality + ' is ' : ''}${sizeStr} — too large to send directly)_`
        : `⚠️ Couldn't send the video directly _(download failed or link expired)_`;

    const fallback = [reasonLine, '', linksText || `🔗 *Direct link:*\n${dlUrl}`]
        .join('\n').replace(/\n\n\n+/g, '\n\n');
    await sock.sendMessage(chatId, { text: fallback }, { quoted: message });
}

/**
 * sendVideoOrLinks — builds the links list then calls sendAsDocument.
 * Title here may include the episode label; epLabel is passed separately
 * so the filename can be constructed correctly.
 */
async function sendVideoOrLinks(sock, chatId, message, data, title, poster, epLabel) {
    const { sources, subtitles, audioTracks } = parseSources(data);

    if (!sources.length) {
        return sock.sendMessage(chatId, {
            text: '⚠️ No download sources found for this title.\n\n_The movie may not have links yet._'
        }, { quoted: message });
    }

    const validSources = sources.filter(s => (s.download_url || s.url)?.startsWith('http'));
    if (!validSources.length) {
        return sock.sendMessage(chatId, { text: '⚠️ No valid download URLs in API response.' }, { quoted: message });
    }

    // Pick the one being sent (resolveAndSend already narrows to [selected])
    const target  = validSources[0];
    const dlUrl   = target.download_url || target.url;
    const quality = target.quality || '';

    // Always build a links block — used as fallback when video can't be sent
    const titleLabel = epLabel ? `${title || 'Movie'} ${epLabel}` : (title || 'Movie');
    // Shorten all URLs in parallel (TinyURL, falls back to original on failure)
    const shortUrls = await Promise.all(
        validSources.map(s => shortenUrl(s.download_url || s.url))
    );
    let linksText = `📥 *Download Links* — ${titleLabel}\n\n`;
    validSources.forEach((s, i) => {
        const q   = s.quality || `Link ${i + 1}`;
        const sz  = s.size ? ` (${fileSize(s.size)})` : '';
        const fmt = s.format ? ` [${s.format.toUpperCase()}]` : '';
        linksText += `*${i + 1}. ${q}${fmt}${sz}*\n${shortUrls[i]}\n\n`;
    });
    if (audioTracks.length > 1)
        linksText += `🔊 *Audio:* ${audioTracks.map(a => a.language).join(' | ')}\n`;
    if (subtitles.length)
        linksText += `📜 *Subs:* ${subtitles.map(s => s.language || s.languageCode).join(', ')}\n`;

    // Strip epLabel from display title to avoid duplication in caption
    const baseTitle = epLabel ? (title || '').replace(epLabel, '').trim() : (title || '');

    return sendAsDocument(sock, chatId, message, dlUrl, baseTitle || title, quality, epLabel || null, linksText.trim(), target.size);
}

// ─── Shared resolution picker & send helpers ──────────────────────────────────

/**
 * showResolutionPicker — sends the "pick a quality" message.
 * Also shows audio dub options if more than one track is available.
 */
function showResolutionPicker(sock, chatId, message, sorted, audioTracks, subtitles, title, id, epLabel, hasTrailer) {
    const NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
    const emoji = epLabel ? '📺' : '🎬';
    const epTag  = epLabel ? ` ${epLabel}` : '';
    let msg = `${emoji} *${title}${epTag}*\n\n📋 *Available Resolutions:*\n\n`;

    sorted.forEach((s, i) => {
        const sz      = s.size ? fileSize(s.size) : '?';
        const codec   = s.codec ? ` · ${s.codec.toUpperCase()}` : '';
        const canSend = (parseInt(s.size) || Infinity) <= DOC_LIMIT ? ' ✅' : '';
        msg += `${NUMS[i] || `${i + 1}.`}  *${s.quality}*  —  ${sz}${codec}${canSend}\n`;
    });

    const dlCmd = epLabel ? `$movie dl ${id} ${epLabel.toLowerCase()} ` : `$movie dl ${id} `;
    msg += `\n✅ _= can be sent as video/file in chat_\n`;
    msg += `\n💬 *Pick a resolution:*\n`;
    msg += `_${dlCmd}1_ — by number\n`;
    msg += `_${dlCmd}360p_ — by quality name\n`;

    if (audioTracks && audioTracks.length > 1) {
        msg += `\n🔊 *Audio Dubs Available:*\n`;
        audioTracks.forEach((a, i) => {
            const orig = a.isOriginal ? ' ✓ Original' : '';
            msg += `  *${i + 1}.* ${a.language || `Track ${i + 1}`}${orig}\n`;
        });
        msg += `\n💡 Add *audio:<n>* to pick a dub:\n`;
        msg += `_${dlCmd}1080p audio:2_ — 1080p + dub #2\n`;
    }

    if (hasTrailer)        msg += `\n🎬 *$movietrailer ${id}* — Watch trailer first`;
    if (subtitles && subtitles.length) msg += `\n📜 *Subs:* ${subtitles.map(s => s.language || s.languageCode).join(', ')}`;

    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
}

/**
 * resolveAndSend — resolve quality + audio pick from parsePick() result, then send.
 */
async function resolveAndSend(sock, chatId, message, sorted, srcData, parsed, title, poster, audioTracks, subtitles, id, epLabel) {
    const qualityStr = parsed.quality || '';
    let selected = null;

    if (qualityStr) {
        const num = parseInt(qualityStr);
        if (!isNaN(num) && num >= 1 && num <= sorted.length) {
            selected = sorted[num - 1];
        }
        if (!selected) {
            selected = sorted.find(s =>
                (s.quality || '').toLowerCase().replace(/\s+/g, '').includes(qualityStr.replace(/\s+/g, ''))
            );
        }
    } else {
        // No quality given but audio given — use smallest (best first in sorted desc)
        selected = sorted[sorted.length - 1] || sorted[0];
    }

    if (!selected) {
        const avail = sorted.map((s, i) => `${i + 1}. ${s.quality}`).join('\n');
        return sock.sendMessage(chatId, {
            text: `❌ Quality "*${qualityStr}*" not found.\n\nAvailable:\n${avail}\n\n_Use number or quality name_`
        }, { quoted: message });
    }

    // Audio dub override: if selected audio track has its own URL, swap the source
    if (parsed.audioIndex && audioTracks && audioTracks.length >= parsed.audioIndex) {
        const track = audioTracks[parsed.audioIndex - 1];
        if (track?.url || track?.download_url) {
            selected = { ...selected, download_url: track.url || track.download_url, url: track.url || track.download_url };
        }
    }

    const syntheticData = Array.isArray(srcData.results)
        ? { ...srcData, results: [selected] }
        : { ...srcData, results: { ...(srcData.results || {}), sources: [selected] } };

    // Pass epLabel separately so sendVideoOrLinks/buildFileName can construct
    // the correct filename: Title.SxxExx.Quality.Daratech.mp4
    return sendVideoOrLinks(sock, chatId, message, syntheticData, title || 'Movie', poster, epLabel || null);
}

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP_TEXT = `🎬 *MOVIE COMMANDS*

*🔍 Search*
▸ *$movie <title>*          — Search movies & shows
▸ *$movie details <id>*     — Full info + poster
▸ *$movie dl <id>*          — Download (auto-detects movie or series)
▸ *$movietrailer <id>*      — Watch official trailer 🎬

*📺 Series / Shows*
▸ *$movie dl <id>*          — Shows all seasons + episode count
▸ *$movie dl <id> s1*       — Episode list for Season 1
▸ *$movie dl <id> s1e3*     — Download S1 Episode 3 (quality picker)
▸ *$movie dl <id> s1e3 720p* — Download S1 Ep3 at 720p directly

*🌐 Dubs (different audio languages)*
▸ Each dub has its own ID shown in the season list
▸ *$movie dl <dub-id> s1e1* — Download that dub's episode

*🎬 Movies*
▸ *$movie dl <id>*          — Shows quality picker
▸ *$movie dl <id> 1*        — Download quality #1 directly
▸ *$movie dl <id> 720p*     — Download by quality name

*📊 Browse*
▸ *$trending*               — What's hot right now 🔥
▸ *$upcoming*               — Upcoming seasons 🗓
▸ *$schedule*               — Weekly airing schedule 📅
▸ *$schedule daily/monthly* — Change schedule period

*🎌 Anime*
▸ *$anime <title>*          — Search anime
▸ *$anime dl <id>*          — Shows seasons + episode count
▸ *$anime dl <id> s1*       — Episode list for Season 1
▸ *$anime dl <id> s1e3*     — Download S1 Episode 3
▸ *$anime dl <id> s1e3 1080p* — Specific quality

*📡 Live TV*
▸ *$live*                   — Browse live channels
▸ *$livesearch <name>*      — Search live TV channels
▸ *$livestream <id>*        — Get stream link
▸ *$livecats*               — Browse categories

*🔎 Filter & More*
▸ *$moviefilter <genre>*    — e.g. $moviefilter action
▸ *$moviefilter action,1*   — genre + type (1=Movie, 2=Series)
▸ *$moviecaptions <id>*     — Subtitles & audio info
▸ *$moviehome*              — Featured content

_✅ = file small enough to send directly in chat_
_💡 IDs come from search results — copy the full ID_`;

// ─── Main command handler ─────────────────────────────────────────────────────

async function movieCommand(sock, chatId, message, args, subcommand) {
    try {

        // Detect inline sub-keywords inside plain $movie command
        if (!subcommand || subcommand === 'search') {
            const first = (args[0] || '').toLowerCase();
            if (first === 'details' || first === 'info') {
                subcommand = 'info';
                args = args.slice(1);
            } else if (first === 'dl' || first === 'download') {
                subcommand = 'dl';
                args = args.slice(1);
            }
        }

        const query = args.join(' ').trim();

        // Show help when $movie sent alone
        if ((!subcommand || subcommand === 'search') && !query) {
            return sock.sendMessage(chatId, { text: HELP_TEXT }, { quoted: message });
        }

        // ── SEARCH ──────────────────────────────────────────────────────────
        if (!subcommand || subcommand === 'search') {
            if (!query) return sock.sendMessage(chatId, { text: '❌ Provide a title.\n*Example:* _$movie avengers_' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '🔍', key: message.key } });

            const data = await apiFetch(`/search/${encodeURIComponent(query)}`);
            // Response: data.results.items[]
            const list = data.results?.items || [];
            if (!list.length) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ No results for "*${query}*"\n\nTry a different spelling or use *$trending* to see what's popular.`
                }, { quoted: message });
            }
            const top = list.slice(0, 10);
            // Remember results so users can pick by number (e.g. $movie dl 1)
            lastSearches.set(chatId, top);
            _saveCache();
            const lines = top.map(formatResult);
            return sock.sendMessage(chatId, {
                text:
                    `🔍 *Search: ${query}*\n\n` +
                    lines.join('\n\n') +
                    `\n\n` +
                    `💡 *Quick pick by number:*\n` +
                    `  *$movie dl 1* — download result 1\n` +
                    `  *$movie details 2* — info for result 2`
            }, { quoted: message });
        }

        // ── DETAILS / INFO ──────────────────────────────────────────────────
        if (subcommand === 'info') {
            if (!query) {
                return sock.sendMessage(chatId, {
                    text: '❌ Provide a movie ID or pick number.\n*Example:* _$movie details 1234376946650333432_\n*Quick pick:* _$movie details 2_ (from last search)\n\n💡 Get IDs by searching first: *$movie <title>*'
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

            // Resolve numeric pick → real ID from last search
            let infoId = query;
            const pickNum = parseInt(query);
            if (!isNaN(pickNum) && pickNum >= 1 && pickNum <= 10 && query === String(pickNum)) {
                const saved = lastSearches.get(chatId) || [];
                const picked = saved[pickNum - 1];
                if (!picked) {
                    return sock.sendMessage(chatId, {
                        text: `❌ No result #${pickNum} in your last search.\nSearch first: *$movie <title>*`
                    }, { quoted: message });
                }
                infoId = picked.subjectId || picked.id || '';
                if (!infoId) {
                    return sock.sendMessage(chatId, {
                        text: `❌ Could not read the ID for result #${pickNum}. Search again: *$movie <title>*`
                    }, { quoted: message });
                }
            }

            const data   = await apiFetch(`/info/${encodeURIComponent(infoId)}`);
            // Response: data.results (object)
            const text   = formatInfo(data);
            const poster = data.results?.cover?.url || data.results?.thumbnail;
            if (poster) {
                await sock.sendMessage(chatId, { image: { url: poster }, caption: text }, { quoted: message });
            } else {
                await sock.sendMessage(chatId, { text }, { quoted: message });
            }
            return;
        }

        // ── DOWNLOAD / SOURCES ──────────────────────────────────────────────
        if (subcommand === 'dl') {
            // args[0] = ID or pick number,  args[1+] = pick: "1" | "360p" | "s1" | "s1e3" | "s1e3 720p"
            let id   = args[0] || '';
            const pick = args.slice(1).join(' ').trim().toLowerCase();

            if (!id) {
                return sock.sendMessage(chatId, {
                    text: '❌ Provide a movie/series ID or pick number.\n*Example:* _$movie dl 1234376946650333432_\n*Quick pick:* _$movie dl 2_ (result #2 from last search)\n\n💡 Get IDs by searching first: *$movie <title>*'
                }, { quoted: message });
            }

            // Resolve numeric pick → real ID from last search
            const dlPickNum = parseInt(id);
            if (!isNaN(dlPickNum) && dlPickNum >= 1 && dlPickNum <= 10 && id === String(dlPickNum)) {
                const saved = lastSearches.get(chatId) || [];
                const picked = saved[dlPickNum - 1];
                if (!picked) {
                    return sock.sendMessage(chatId, {
                        text: `❌ No result #${dlPickNum} in your last search.\nSearch first: *$movie <title>*`
                    }, { quoted: message });
                }
                const resolvedId = picked.subjectId || picked.id || '';
                if (!resolvedId) {
                    return sock.sendMessage(chatId, {
                        text: `❌ Could not read the ID for result #${dlPickNum}. Search again: *$movie <title>*`
                    }, { quoted: message });
                }
                id = resolvedId;
            }

            await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

            // Info always fetched first — contains seasonDetails for series
            const infoData      = await apiFetch(`/info/${encodeURIComponent(id)}`).catch(() => null);
            const title         = infoData?.results?.title;
            const poster        = infoData?.results?.cover?.url || infoData?.results?.thumbnail;
            const hasTrailer    = !!infoData?.results?.trailer?.VideoAddress?.url;
            const mediaType     = infoData?.results?.type || '';
            // seasonDetails comes directly from /info — no separate API call needed
            const seasonDetails = infoData?.results?.seasonDetails || [];
            // Dubs: each dub is a separate series with its own subjectId
            const dubList       = infoData?.results?.dubs || infoData?.results?.audioTracks || [];

            // ── SERIES PATH ──────────────────────────────────────────────────
            // Handle series even when API returns no seasonDetails (some series
            // only return a seasons count — we still route correctly).
            if (isSeriesType(mediaType)) {
                const parsed = parsePick(pick);

                // If API gave no seasonDetails but gave a seasons count, build synthetic ones
                let effectiveSeasonDetails = seasonDetails;
                if (!effectiveSeasonDetails.length && infoData?.results?.seasons > 0) {
                    const count = parseInt(infoData.results.seasons);
                    effectiveSeasonDetails = Array.from({ length: count }, (_, i) => ({ season: i + 1, totalEpisodes: null }));
                }

                // No seasonDetails at all AND user didn't specify s/e — ask them to specify
                if (!effectiveSeasonDetails.length && !parsed.season) {
                    return sock.sendMessage(chatId, {
                        text: [
                            `📺 *${title || id}* is a series.`,
                            ``,
                            `The API did not return season info for this title.`,
                            `Please specify the episode directly:`,
                            ``,
                            `_$movie dl ${id} s1e1_ — S1 Episode 1`,
                            `_$movie dl ${id} s1e1 720p_ — specific quality`,
                        ].join('\n')
                    }, { quoted: message });
                }

                // ① No season → show full season overview
                if (!parsed.season) {
                    const totalEps  = infoData?.results?.totalEpisodes
                        || effectiveSeasonDetails.reduce((a, s) => a + (s.totalEpisodes || 0), 0);
                    const NUMS      = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
                    let msg = `📺 *${title || 'Series'}*\n`;
                    msg += `📊 *${effectiveSeasonDetails.length} Season${effectiveSeasonDetails.length > 1 ? 's' : ''}`;
                    if (totalEps) msg += ` • ${totalEps} Total Episodes`;
                    msg += `*\n\n`;

                    effectiveSeasonDetails.forEach((s, i) => {
                        const eps = s.totalEpisodes;
                        const epStr = eps ? `${eps} episode${eps !== 1 ? 's' : ''}` : '? episodes';
                        msg += `${NUMS[i] || `${i + 1}.`}  *Season ${s.season}*  —  ${epStr}\n`;
                    });

                    msg += `\n💬 *Pick a season:*\n_$movie dl ${id} s1_ — Season 1 episodes\n_$movie dl ${id} s2_ — Season 2 episodes`;
                    msg += `\n_$movie dl ${id} s1e1_ — Download S1 Episode 1 directly`;

                    // Show dub options if any non-original dubs exist
                    const dubs = dubList.filter(d => !d.original && d.subjectId && d.subjectId !== id);
                    if (dubs.length) {
                        msg += `\n\n🌐 *Available Dubs (use the dub ID to download that language):*\n`;
                        const orig = dubList.find(d => d.original);
                        if (orig) msg += `  • ${orig.lanName || 'Original'} ✓ _(this series)_\n`;
                        dubs.forEach(d => {
                            msg += `  • *${d.lanName || d.lanCode}*  🆔 \`${d.subjectId}\`\n`;
                        });
                        msg += `\n💡 *$movie dl <dub-id> s1e1* — download that dub`;
                    }

                    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
                }

                // ② Season given, no episode → show episode list for that season
                if (parsed.season && !parsed.episode) {
                    const seasonInfo = effectiveSeasonDetails.find(s => s.season === parsed.season);
                    if (!seasonInfo) {
                        const available = effectiveSeasonDetails.map(s => `S${s.season}`).join(', ');
                        return sock.sendMessage(chatId, {
                            text: `⚠️ Season ${parsed.season} not found in *${title || id}*.\n\nAvailable: ${available}`
                        }, { quoted: message });
                    }

                    const totalEps = seasonInfo.totalEpisodes || 0;
                    let msg = `📺 *${title || 'Series'}* — Season ${parsed.season}\n`;
                    if (totalEps) {
                        msg += `📋 *${totalEps} Episode${totalEps !== 1 ? 's' : ''}:*\n\n`;
                        const showMax = Math.min(totalEps, 30);
                        for (let ep = 1; ep <= showMax; ep++) {
                            msg += `  *Ep ${ep}*  →  \`$movie dl ${id} s${parsed.season}e${ep}\`\n`;
                        }
                        if (totalEps > showMax) msg += `  _...and ${totalEps - showMax} more episodes_\n`;
                    } else {
                        // Episode count unknown — show first 20 as safe default
                        msg += `📋 *Episodes (specify directly):*\n\n`;
                        for (let ep = 1; ep <= 20; ep++) {
                            msg += `  *Ep ${ep}*  →  \`$movie dl ${id} s${parsed.season}e${ep}\`\n`;
                        }
                        msg += `  _...try higher numbers if there are more_\n`;
                    }

                    msg += `\n💡 Add quality to download directly:\n_$movie dl ${id} s${parsed.season}e1 720p_`;
                    return sock.sendMessage(chatId, { text: msg }, { quoted: message });
                }

                // ③ Season + episode → fetch sources with ?season=N&episode=N
                if (parsed.season && parsed.episode) {
                    const epLabel = `S${String(parsed.season).padStart(2, '0')}E${String(parsed.episode).padStart(2, '0')}`;

                    const srcData = await apiFetch(`/sources/${encodeURIComponent(id)}?season=${parsed.season}&episode=${parsed.episode}`);
                    const { sources, subtitles, audioTracks } = parseSources(srcData);

                    if (!sources.length) {
                        return sock.sendMessage(chatId, {
                            text: `⚠️ No download sources found for *${title || id} ${epLabel}*.\n\n_This episode may not have links yet._`
                        }, { quoted: message });
                    }

                    const deduped = dedupeByQuality(sources);
                    const sorted  = [...deduped].sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));
                    const epTitle = `${title || id} ${epLabel}`;

                    if (parsed.quality) {
                        return resolveAndSend(sock, chatId, message, sorted, srcData, parsed, title || id, poster, audioTracks, subtitles, id, epLabel);
                    }
                    return showResolutionPicker(sock, chatId, message, sorted, audioTracks, subtitles, epTitle, id, epLabel, false);
                }
            }

            // ── MOVIE / flat source ──────────────────────────────────────────
            const srcData = await apiFetch(`/sources/${encodeURIComponent(id)}`);
            const { sources, subtitles, audioTracks } = parseSources(srcData);

            if (!sources.length) {
                const trailerHint = hasTrailer ? `\n\n🎬 *$movietrailer ${id}* — Watch trailer instead` : '';
                return sock.sendMessage(chatId, {
                    text: `⚠️ No download sources found for *${title || id}*.\n\n_The movie may not have links yet._${trailerHint}`
                }, { quoted: message });
            }

            const deduped = dedupeByQuality(sources);
            const sorted  = [...deduped].sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));
            const parsed  = parsePick(pick);

            if (pick) {
                return resolveAndSend(sock, chatId, message, sorted, srcData, parsed, title, poster, audioTracks, subtitles, id, null);
            }
            return showResolutionPicker(sock, chatId, message, sorted, audioTracks, subtitles, title || 'Movie', id, null, hasTrailer);
        }

        // ── TRAILER ──────────────────────────────────────────────────────────
        if (subcommand === 'trailer') {
            const id = args[0] || query;
            if (!id) {
                return sock.sendMessage(chatId, {
                    text: '❌ Provide a movie ID.\n*Example:* _$movietrailer 1234376946650333432_\n\n💡 Get IDs from *$movie <title>* search'
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, { react: { text: '🎬', key: message.key } });

            const data    = await apiFetch(`/info/${encodeURIComponent(id)}`);
            const title   = data.results?.title;
            const trailer = data.results?.trailer;

            if (!trailer?.VideoAddress?.url) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ No trailer found for *${title || id}*.\n\n💡 *$movie dl ${id}* — Download links\n💡 *$movie details ${id}* — Full info`
                }, { quoted: message });
            }

            const { url, duration, size } = trailer.VideoAddress;
            const mins     = Math.floor((duration || 0) / 60);
            const secs     = (duration || 0) % 60;
            const timeStr  = duration ? ` · ⏱ ${mins}m ${secs}s` : '';
            const sizeStr  = size     ? ` · ${fileSize(String(size))}` : '';
            const caption  = `🎬 *${title}* — Official Trailer${timeStr}${sizeStr}\n\n_Daratech_`;

            try {
                await sock.sendMessage(chatId, {
                    video:    { url },
                    mimetype: 'video/mp4',
                    caption,
                }, { quoted: message });
            } catch (e) {
                // Fallback to link if video send fails
                await sock.sendMessage(chatId, {
                    text: `🎬 *${title}* — Official Trailer\n\n${url}`
                }, { quoted: message });
            }
            return;
        }

        // ── TRENDING ────────────────────────────────────────────────────────
        if (subcommand === 'trending') {
            await sock.sendMessage(chatId, { react: { text: '🔥', key: message.key } });

            const data = await apiFetch('/trending');
            // Response: data.results.items[]
            const list = data.results?.items || [];
            if (!list.length) return sock.sendMessage(chatId, { text: '⚠️ No trending content found.' }, { quoted: message });
            const lines = list.slice(0, 12).map(formatResult);
            return sock.sendMessage(chatId, {
                text: `🔥 *Trending Now*\n\n${lines.join('\n\n')}\n\n💡 *$movie details <id>* — Full info`
            }, { quoted: message });
        }

        // ── UPCOMING ────────────────────────────────────────────────────────
        if (subcommand === 'upcoming') {
            await sock.sendMessage(chatId, { react: { text: '🗓', key: message.key } });

            const params = query ? `?genre=${encodeURIComponent(query)}` : '';
            const data   = await apiFetch(`/seasons/upcoming${params}`);
            // Response: data.results.items[] — each item uses 'id' and 'thumbnail', 'genres' array
            const list = data.results?.items || [];
            if (!list.length) return sock.sendMessage(chatId, { text: '⚠️ No upcoming seasons found.' }, { quoted: message });
            const lines = list.slice(0, 10).map(formatResult);
            return sock.sendMessage(chatId, {
                text: `🗓 *Upcoming Seasons*\n\n${lines.join('\n\n')}`
            }, { quoted: message });
        }

        // ── SCHEDULE ────────────────────────────────────────────────────────
        if (subcommand === 'schedule') {
            await sock.sendMessage(chatId, { react: { text: '📅', key: message.key } });

            const period = query || 'weekly';
            const data   = await apiFetch(`/schedule?period=${encodeURIComponent(period)}`);

            // Response: data.results.schedule[] — each entry: { date, count, items[] }
            // Flatten all items across days
            const scheduleArr = data.results?.schedule || [];
            const list = scheduleArr.flatMap(day => day.items || []);

            if (!list.length) {
                return sock.sendMessage(chatId, {
                    text: `📅 No schedule entries found for *${period}*.\n\nTry *$schedule daily* or *$schedule monthly*`
                }, { quoted: message });
            }
            const lines = list.slice(0, 12).map(formatResult);
            return sock.sendMessage(chatId, {
                text: `📅 *${period.charAt(0).toUpperCase() + period.slice(1)} Schedule*\n\n${lines.join('\n\n')}`
            }, { quoted: message });
        }

        // ── LIVE TV (browse) ─────────────────────────────────────────────────
        if (subcommand === 'live') {
            await sock.sendMessage(chatId, { react: { text: '📡', key: message.key } });

            const params = query
                ? `?category=${encodeURIComponent(query)}&limit=15`
                : '?limit=15';
            const data = await apiFetch(`/live${params}`);

            // Response: data.results = { total, page, limit, pages, results: [{id, name, country, streams[]}] }
            const list = data.results?.results || [];
            if (!list.length) return sock.sendMessage(chatId, { text: '⚠️ No live channels found.' }, { quoted: message });

            let msg = `📡 *Live TV Channels*${query ? ` — ${query}` : ''}\n\n`;
            list.slice(0, 12).forEach((ch, i) => {
                const name    = ch.name || ch.title || 'Unknown';
                const id      = ch.id || '';
                const country = ch.country || '';
                const cats    = ch.categories ? ch.categories.slice(0, 2).join(', ') : '';
                msg += `*${i + 1}.* ${name}${country ? ` 🌍 ${country}` : ''}${cats ? ` (${cats})` : ''}\n    🆔 \`${id}\`\n\n`;
            });
            msg += '💡 *$livestream <id>* — Get stream link\n💡 *$livesearch <name>* — Search channels\n💡 *$livecats* — Browse by category';
            return sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

        // ── LIVE SEARCH ──────────────────────────────────────────────────────
        if (subcommand === 'livesearch') {
            if (!query) return sock.sendMessage(chatId, { text: '❌ Provide a channel name.\n*Example:* _$livesearch CNN_' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '📡', key: message.key } });

            const data = await apiFetch(`/live/search/${encodeURIComponent(query)}`);
            // Response: data.results = { total, query, results: [{id, name, country, streams[]}] }
            const list = data.results?.results || [];
            if (!list.length) return sock.sendMessage(chatId, { text: `⚠️ No channels found for "*${query}*"` }, { quoted: message });

            let msg = `📡 *Live Search: ${query}*\n\n`;
            list.slice(0, 10).forEach((ch, i) => {
                const name    = ch.name || ch.title || 'Unknown';
                const id      = ch.id || '';
                const country = ch.country || '';
                msg += `*${i + 1}.* ${name}${country ? ` 🌍 ${country}` : ''}\n    🆔 \`${id}\`\n\n`;
            });
            msg += '💡 Copy the ID exactly and use *$livestream <id>* to get the stream link';
            return sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

        // ── LIVE STREAM ──────────────────────────────────────────────────────
        if (subcommand === 'livestream') {
            if (!query) {
                return sock.sendMessage(chatId, {
                    text: '❌ Provide a channel ID.\n*Example:* _$livestream CNN.us_\n\n💡 Get exact IDs from *$live* or *$livesearch <name>*'
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, { react: { text: '📡', key: message.key } });

            let data;
            try {
                data = await apiFetch(`/live/stream/${encodeURIComponent(query)}`);
            } catch (_fetchErr) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ Channel *${query}* was not found or is unavailable.\n\n💡 Use *$livesearch <name>* to find the exact channel ID.\n💡 Use *$live* to browse all channels.`
                }, { quoted: message });
            }

            if (!data.success) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ Channel *${query}* was not found.\n\n💡 Use *$livesearch <name>* to find the exact channel ID.`
                }, { quoted: message });
            }

            // Response: data.results = { id, name, streams: [{url, httpReferrer, userAgent}] }
            const ch      = data.results || {};
            const streams = ch.streams || [];
            if (!streams.length) {
                return sock.sendMessage(chatId, { text: '⚠️ No stream available for this channel right now.' }, { quoted: message });
            }

            const name = ch.name || query;
            let msg    = `📡 *Live Stream: ${name}*\n\n`;
            streams.forEach((s, i) => {
                msg += `*Stream ${i + 1}:*\n${s.url}\n\n`;
            });
            msg += '_Open link in VLC, MX Player or any media player that supports M3U8_';
            return sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

        // ── LIVE CATEGORIES ──────────────────────────────────────────────────
        if (subcommand === 'livecats') {
            await sock.sendMessage(chatId, { react: { text: '📡', key: message.key } });

            const data = await apiFetch('/live/categories');
            // Response: data.results = { total, categories: [{name, count}] }
            const cats = data.results?.categories || [];
            if (!cats.length) return sock.sendMessage(chatId, { text: '⚠️ Could not load categories.' }, { quoted: message });

            const list = cats.slice(0, 20).map((c, i) => `*${i + 1}.* ${c.name}  _(${c.count} channels)_`).join('\n');
            return sock.sendMessage(chatId, {
                text: `📡 *Live TV Categories*\n\n${list}\n\n💡 *$live <category>* — Browse by category name`
            }, { quoted: message });
        }

        // ── ANIME ────────────────────────────────────────────────────────────
        if (subcommand === 'anime') {
            const first = (args[0] || '').toLowerCase();

            // Anime download: $anime dl <id> [s1] [s1e3] [s1e3 1080p]
            if (first === 'dl' || first === 'download') {
                const animeId = args[1] || '';
                const pick    = args.slice(2).join(' ').trim().toLowerCase();

                if (!animeId) return sock.sendMessage(chatId, { text: '❌ Provide an anime ID.\n*Example:* _$anime dl <id>_\n*Season/ep:* _$anime dl <id> s1e3_' }, { quoted: message });
                await sock.sendMessage(chatId, { react: { text: '📥', key: message.key } });

                // Fetch info first — contains seasonDetails if this is a series
                const infoData      = await apiFetch(`/info/${encodeURIComponent(animeId)}`).catch(() => null);
                const title         = infoData?.results?.title;
                const poster        = infoData?.results?.cover?.url || infoData?.results?.thumbnail;
                const mediaType     = infoData?.results?.type || infoData?.results?.format || '';
                const seasonDetails = infoData?.results?.seasonDetails || [];
                const dubList       = infoData?.results?.dubs || infoData?.results?.audioTracks || [];

                const parsed = parsePick(pick);

                // ── Series: has season details ───────────────────────────────
                if (isSeriesType(mediaType) && seasonDetails.length > 0) {

                    // ① No season → show season overview
                    if (!parsed.season) {
                        const totalEps = infoData.results.totalEpisodes || seasonDetails.reduce((a, s) => a + (s.totalEpisodes || 0), 0);
                        const NUMS     = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
                        let msg = `🎌 *${title || 'Anime'}*\n`;
                        msg += `📊 *${seasonDetails.length} Season${seasonDetails.length > 1 ? 's' : ''} • ${totalEps} Total Episodes*\n\n`;
                        seasonDetails.forEach((s, i) => {
                            const eps = s.totalEpisodes || '?';
                            msg += `${NUMS[i] || `${i + 1}.`}  *Season ${s.season}*  —  ${eps} episode${eps !== 1 ? 's' : ''}\n`;
                        });
                        msg += `\n💬 *Pick a season:*\n_$anime dl ${animeId} s1_ — Season 1 episodes\n_$anime dl ${animeId} s1e1_ — Download S1 Ep1 directly`;

                        const dubs = dubList.filter(d => !d.original && d.subjectId && d.subjectId !== animeId);
                        if (dubs.length) {
                            msg += `\n\n🌐 *Available Dubs:*\n`;
                            const orig = dubList.find(d => d.original);
                            if (orig) msg += `  • ${orig.lanName || 'Original'} ✓ _(this series)_\n`;
                            dubs.forEach(d => {
                                msg += `  • *${d.lanName || d.lanCode}*  🆔 \`${d.subjectId}\`\n`;
                            });
                            msg += `\n💡 *$anime dl <dub-id> s1e1* — download that language`;
                        }
                        return sock.sendMessage(chatId, { text: msg }, { quoted: message });
                    }

                    // ② Season given, no episode → show episode list
                    if (parsed.season && !parsed.episode) {
                        const seasonInfo = seasonDetails.find(s => s.season === parsed.season);
                        if (!seasonInfo) {
                            const available = seasonDetails.map(s => `S${s.season}`).join(', ');
                            return sock.sendMessage(chatId, {
                                text: `⚠️ Season ${parsed.season} not found in *${title || animeId}*.\n\nAvailable: ${available}`
                            }, { quoted: message });
                        }
                        const totalEps = seasonInfo.totalEpisodes || 0;
                        const showMax  = Math.min(totalEps, 30);
                        let msg = `🎌 *${title || 'Anime'}* — Season ${parsed.season}\n`;
                        msg += `📋 *${totalEps} Episode${totalEps !== 1 ? 's' : ''}:*\n\n`;
                        for (let ep = 1; ep <= showMax; ep++) {
                            msg += `  *Ep ${ep}*  →  \`$anime dl ${animeId} s${parsed.season}e${ep}\`\n`;
                        }
                        if (totalEps > showMax) msg += `  _...and ${totalEps - showMax} more_\n`;
                        msg += `\n💡 Add quality: _$anime dl ${animeId} s${parsed.season}e1 1080p_`;
                        return sock.sendMessage(chatId, { text: msg }, { quoted: message });
                    }

                    // ③ Season + episode → fetch sources with ?season=N&episode=N
                    if (parsed.season && parsed.episode) {
                        const epLabel = `S${String(parsed.season).padStart(2, '0')}E${String(parsed.episode).padStart(2, '0')}`;
                        const epTitle = `${title || animeId} ${epLabel}`;

                        const srcData = await apiFetch(`/anime/sources/${encodeURIComponent(animeId)}?season=${parsed.season}&episode=${parsed.episode}`);
                        const { sources, subtitles, audioTracks } = parseSources(srcData);

                        if (!sources.length) {
                            return sock.sendMessage(chatId, {
                                text: `⚠️ No download sources found for *${epTitle}*.\n\n_This episode may not have links yet._`
                            }, { quoted: message });
                        }

                        const deduped = dedupeByQuality(sources);
                        const sorted  = [...deduped].sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));

                        if (parsed.quality) {
                            return resolveAndSend(sock, chatId, message, sorted, srcData, parsed, title || animeId, poster, audioTracks, subtitles, animeId, epLabel);
                        }
                        return showResolutionPicker(sock, chatId, message, sorted, audioTracks, subtitles, epTitle, animeId, epLabel, false);
                    }
                }

                // ── Flat / movie-style anime ─────────────────────────────────
                const srcData = await apiFetch(`/anime/sources/${encodeURIComponent(animeId)}`);
                const { sources, subtitles, audioTracks } = parseSources(srcData);

                if (!sources.length) {
                    return sock.sendMessage(chatId, {
                        text: `⚠️ No download sources found for *${title || animeId}*.\n\n_May not have links yet._`
                    }, { quoted: message });
                }

                const deduped = dedupeByQuality(sources);
                const sorted  = [...deduped].sort((a, b) => (parseInt(b.size) || 0) - (parseInt(a.size) || 0));

                if (pick) {
                    return resolveAndSend(sock, chatId, message, sorted, srcData, parsed, title, poster, audioTracks, subtitles, animeId, null);
                }

                // No pick: show resolution picker
                const NUMS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];
                let msg = `🎌 *${title || 'Anime'}*\n\n📋 *Available Resolutions:*\n\n`;
                sorted.forEach((s, i) => {
                    const sz      = s.size ? fileSize(s.size) : '?';
                    const codec   = s.codec ? ` · ${s.codec.toUpperCase()}` : '';
                    const canSend = (parseInt(s.size) || Infinity) <= DOC_LIMIT ? ' ✅' : '';
                    msg += `${NUMS[i] || `${i + 1}.`}  *${s.quality}*  —  ${sz}${codec}${canSend}\n`;
                });
                msg += `\n✅ _= can be sent as video/file in chat_\n`;
                msg += `\n💬 *Pick a resolution:*\n_$anime dl ${animeId} 1_ — by number\n_$anime dl ${animeId} 1080p_ — by name`;
                if (subtitles.length) msg += `\n📜 *Subs:* ${subtitles.map(s => s.language || s.languageCode).join(', ')}`;
                return sock.sendMessage(chatId, { text: msg }, { quoted: message });
            }

            if (!query) return sock.sendMessage(chatId, { text: '❌ Provide an anime title.\n*Example:* _$anime naruto_' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '🎌', key: message.key } });

            const data = await apiFetch(`/anime/search/${encodeURIComponent(query)}`);
            // Response: data.results.items[]
            const list = data.results?.items || [];
            if (!list.length) return sock.sendMessage(chatId, { text: `⚠️ No anime found for "*${query}*"` }, { quoted: message });
            const lines = list.slice(0, 8).map(formatResult);
            return sock.sendMessage(chatId, {
                text: `🎌 *Anime: ${query}*\n\n${lines.join('\n\n')}\n\n💡 *$movie details <id>* — Full info\n💡 *$anime dl <id>* — Download links`
            }, { quoted: message });
        }

        // ── FILTER ───────────────────────────────────────────────────────────
        if (subcommand === 'filter') {
            if (!query) {
                return sock.sendMessage(chatId, {
                    text: '❌ Provide a genre or platform.\n\n*Examples:*\n_$moviefilter action_\n_$moviefilter bollywood_\n_$moviefilter comedy,1_ (1=Movie, 2=Series)'
                }, { quoted: message });
            }
            await sock.sendMessage(chatId, { react: { text: '🔎', key: message.key } });

            const [genre, typeStr] = query.split(',').map(s => s.trim());
            const platforms        = ['netflix', 'amazon', 'disney', 'hulu', 'bollywood', 'hbo', 'appletv', 'primevideo'];
            const isPlatform       = platforms.includes(genre.toLowerCase());
            const typeParam        = typeStr ? `&type=${typeStr}` : '';
            const apiPath          = isPlatform
                ? `/filter?platform=${encodeURIComponent(genre)}${typeParam}`
                : `/filter?genre=${encodeURIComponent(genre)}${typeParam}`;

            const data = await apiFetch(apiPath);
            // Response: data.results.items[]
            const list = data.results?.items || [];
            if (!list.length) {
                return sock.sendMessage(chatId, {
                    text: `⚠️ No results for "*${genre}*"\n\nNote: genre/platform filtering depends on upstream data — try a different genre like _action_, _comedy_, _thriller_`
                }, { quoted: message });
            }
            const lines     = list.slice(0, 10).map(formatResult);
            const label     = isPlatform ? `Platform: ${genre}` : `Genre: ${genre}`;
            const typeLabel = typeStr ? ` (${typeStr === '1' ? 'Movies' : 'Series'})` : '';
            return sock.sendMessage(chatId, {
                text: `🔎 *Filter — ${label}${typeLabel}*\n\n${lines.join('\n\n')}\n\n💡 *$movie details <id>* — Full info`
            }, { quoted: message });
        }

        // ── CAPTIONS / SUBTITLES ─────────────────────────────────────────────
        if (subcommand === 'captions') {
            if (!query) return sock.sendMessage(chatId, { text: '❌ Provide a movie ID.\n*Example:* _$moviecaptions <id>_' }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '📜', key: message.key } });

            // Sources endpoint provides subtitles + audioTracks alongside download links
            const srcData = await apiFetch(`/sources/${encodeURIComponent(query)}`);
            const subs    = srcData.subtitles   || [];
            const audio   = srcData.audioTracks || [];

            if (!subs.length && !audio.length) {
                return sock.sendMessage(chatId, { text: '⚠️ No subtitles or audio tracks found for this title.' }, { quoted: message });
            }
            let msg = '📜 *Captions & Audio Tracks*\n\n';
            if (subs.length) {
                msg += `*Subtitles (${subs.length}):*\n`;
                subs.forEach((s, i) => { msg += `  ${i + 1}. ${s.language || s.languageCode}\n`; });
                msg += '\n';
            }
            if (audio.length) {
                msg += `*Audio Tracks (${audio.length}):*\n`;
                audio.forEach((a, i) => { msg += `  ${i + 1}. ${a.language}${a.isOriginal ? ' ✓ Original' : ''}\n`; });
            }
            return sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

        // ── HOMEPAGE / FEATURED ──────────────────────────────────────────────
        if (subcommand === 'homepage') {
            await sock.sendMessage(chatId, { react: { text: '🏠', key: message.key } });

            const data = await apiFetch('/homepage');
            // Response: data.results = { sections: [{type, title, items:[]}], totalSections }
            const sections = data.results?.sections || [];
            // Flatten all section items into one list
            const list = sections.flatMap(sec => (sec.items || []).map(item => ({ ...item, _section: sec.title })));

            if (!list.length) return sock.sendMessage(chatId, { text: '⚠️ Could not load featured content.' }, { quoted: message });

            // Group by section — show first 3 sections, up to 4 items each
            let msg = '🏠 *Featured Content*\n\n';
            const seen = new Set();
            for (const sec of sections.slice(0, 3)) {
                const secItems = (sec.items || []).filter(it => {
                    const id = it.subjectId || it.id;
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                }).slice(0, 4);
                if (!secItems.length) continue;
                msg += `*— ${sec.title || sec.type} —*\n`;
                secItems.forEach((item, i) => {
                    const id     = item.subjectId || item.id || '';
                    const year   = (item.releaseDate || '').slice(0, 4) || item.year || '';
                    const rating = item.imdbRatingValue || item.imdbRate || item.rating;
                    const rStr   = rating ? `  ⭐ ${rating}` : '';
                    msg += `${mediaEmoji(item.type)} *${i + 1}.* ${item.title}\n    📅 ${year || '—'}${rStr}  •  🆔 \`${id}\`\n`;
                });
                msg += '\n';
            }
            msg += '💡 *$movie details <id>* — Full info';
            return sock.sendMessage(chatId, { text: msg }, { quoted: message });
        }

    } catch (err) {
        console.error('[movie.js] Error:', err.message);
        await sock.sendMessage(chatId, {
            text: `❌ Movie command failed.\n\n_${err.message}_\n\nTry again in a moment.`
        }, { quoted: message });
    }
}

module.exports = movieCommand;
