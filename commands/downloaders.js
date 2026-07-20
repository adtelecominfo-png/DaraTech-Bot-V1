'use strict';
/**
 * downloaders.js — Platform-specific media downloaders
 * All media is buffered before sending to avoid expiring download URLs.
 */

const axios = require('axios');
const { get } = require('../lib/gifted');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractArg(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || ''
    ).trim().split(/\s+/).slice(1).join(' ').trim();
}

function isUrl(s) { return /^https?:\/\//i.test(s); }

function pickUrl(result) {
    if (!result) return null;
    if (typeof result === 'string' && result.startsWith('http')) return result;
    const fields = ['download_url', 'url', 'media', 'video', 'audio',
                    'hd', 'sd', 'link', 'mp4', 'mp3'];
    for (const f of fields) {
        if (typeof result[f] === 'string' && result[f].startsWith('http')) return result[f];
    }
    if (Array.isArray(result)) {
        for (const item of result) { const u = pickUrl(item); if (u) return u; }
    }
    if (Array.isArray(result.urls)) {
        const u = result.urls.find(u => typeof u === 'string' && u.startsWith('http'));
        if (u) return u;
    }
    return null;
}

/** Download URL → Buffer so WhatsApp never fetches an expiring link */
async function toBuffer(url, timeout = 90000) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return Buffer.from(res.data);
}

async function sendErr(sock, chatId, message, platform) {
    await sock.sendMessage(chatId, {
        text: `❌ Could not download from *${platform}*.\nMake sure you sent a valid ${platform} link and try again.`,
    }, { quoted: message });
}

// ─── $twitter / $twdl ────────────────────────────────────────────────────────

async function twitterDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🐦 Usage: $twitter <tweet URL>\nExample: $twitter https://x.com/user/status/123456789',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🐦 _Downloading Twitter/X video…_' }, { quoted: message });
        const data = await get('/download/twitterdlv2', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `🐦 *Twitter / X*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'Twitter/X'); }
}

// ─── $igdl — Instagram (GiftedTech fallback) ─────────────────────────────────

async function igdlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '📸 Usage: $igdl <Instagram post/reel URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📸 _Downloading Instagram media…_' }, { quoted: message });
        const data = await get('/download/instadlv2', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');

        const buf     = await toBuffer(dl);
        const isVideo = /\.(mp4|webm|mov)/i.test(dl) || data?.result?.type === 'video';
        if (isVideo) {
            await sock.sendMessage(chatId, {
                video: buf, mimetype: 'video/mp4',
                caption: `📸 *Instagram*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                image: buf, caption: `📸 *Instagram*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'Instagram'); }
}

// ─── Pinterest helpers ─────────────────────────────────────────────────────────

const PINTEREST_BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_ufi.php)';

function isPinterestUrl(u) {
    return /pinterest\.(com|co\.\w+|[a-z]{2,3})\/pin\//i.test(u) || /pin\.it\//i.test(u);
}

/** Extract <meta property="X" content="Y"> or <meta content="Y" property="X"> */
function ogContent(html, prop) {
    const re = [
        new RegExp(`property=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'),
        new RegExp(`content=["']([^"']+)["'][^>]*property=["']${prop}["']`, 'i'),
    ];
    for (const r of re) {
        const m = html.match(r);
        if (m?.[1]?.startsWith('http')) return m[1];
    }
    return null;
}

/**
 * Fetch the Pinterest pin page using Facebook bot UA (Pinterest reliably serves
 * og:image / og:video meta tags to social crawlers without login).
 * Handles pin.it short URLs via axios redirect following.
 */
async function fetchPinterestMedia(pinUrl) {
    const res = await axios.get(pinUrl, {
        timeout: 20000,
        maxRedirects: 10,
        headers: {
            'User-Agent': PINTEREST_BOT_UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });

    const html = typeof res.data === 'string' ? res.data : '';
    if (!html) return null;

    // ── Video (og:video or og:video:url) ──────────────────────────────────────
    const videoUrl = ogContent(html, 'og:video:url') || ogContent(html, 'og:video');
    if (videoUrl) return { type: 'video', url: videoUrl };

    // ── Also hunt for v.pinimg.com .mp4 embedded in JSON blobs ───────────────
    const mp4Match = html.match(/https?:\/\/v\.pinimg\.com\/[^\s"'\\]+\.mp4[^\s"'\\]*/i);
    if (mp4Match) return { type: 'video', url: mp4Match[0] };

    // ── Image (og:image — upgrade to /originals/ for full quality) ────────────
    const imgUrl = ogContent(html, 'og:image');
    if (imgUrl) {
        // Pinterest og:image is often /236x/, /474x/, /736x/ — upgrade to originals
        const hq = imgUrl.replace(/\/\d+x\//, '/originals/').replace(/\/\d+x\d+_/, '/originals/');
        return { type: 'image', url: hq };
    }

    // ── Last-resort: find any i.pinimg.com originals URL ─────────────────────
    const origMatch = html.match(/https?:\/\/i\.pinimg\.com\/originals\/[^\s"'\\]+/i);
    if (origMatch) return { type: 'image', url: origMatch[0] };

    return null;
}

// ─── $pinterestdl / $pintdl / $pdl ───────────────────────────────────────────

async function pinterestDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url) return sock.sendMessage(chatId, {
        text: '📌 *PINTEREST DOWNLOADER*\n\n' +
              'Usage: *$pinterestdl <Pinterest URL>*\n\n' +
              'Examples:\n' +
              '• $pinterestdl https://pin.it/xxxxxx\n' +
              '• $pinterestdl https://www.pinterest.com/pin/123456/\n\n' +
              '_Supports images & videos_ ⚡',
    }, { quoted: message });

    if (!isPinterestUrl(url)) return sock.sendMessage(chatId, {
        text: '❌ Please send a valid Pinterest URL.\n\nExamples:\n• https://pin.it/xxxxxx\n• https://www.pinterest.com/pin/123456/',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📌 _Fetching Pinterest media…_' }, { quoted: message });

        // ── Strategy 1: Custom scraper (Facebook bot UA → og tags) ──────────
        let media = null;
        try {
            media = await fetchPinterestMedia(url);
        } catch (e) {
            console.error('[pintdl] scrape err:', e.message);
        }

        // ── Strategy 2: Gifted API fallbacks ────────────────────────────────
        if (!media) {
            for (const ep of ['/download/pinterestv2', '/download/pinterestv3', '/download/pinterestv4']) {
                try {
                    const data = await get(ep, { url });
                    const dl = pickUrl(data?.result);
                    if (dl) {
                        const isVideo = /\.(mp4|webm|mov)/i.test(dl) || data?.result?.type === 'video';
                        media = { type: isVideo ? 'video' : 'image', url: dl };
                        break;
                    }
                } catch { /* try next */ }
            }
        }

        if (!media) throw new Error('Could not extract media from this Pinterest link');

        const buf = await toBuffer(media.url);
        if (media.type === 'video') {
            await sock.sendMessage(chatId, {
                video: buf, mimetype: 'video/mp4',
                caption: '📌 *Pinterest*\n\n_Daratech_ ⚡',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                image: buf,
                caption: '📌 *Pinterest*\n\n_Daratech_ ⚡',
            }, { quoted: message });
        }
    } catch (e) {
        console.error('[pinterestdl]', e.message);
        await sock.sendMessage(chatId, {
            text: `❌ Failed to download Pinterest media.\n\n_${e.message}_\n\nMake sure you send a valid Pinterest pin URL.`,
        }, { quoted: message });
    }
}

// ─── $douyin ──────────────────────────────────────────────────────────────────

async function douyinCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🎵 Usage: $douyin <Douyin URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🎵 _Downloading Douyin video…_' }, { quoted: message });
        const data = await get('/download/tiktokdlv2', { url });
        const dl   = pickUrl(data?.result) || data?.result?.nowatermark || data?.result?.video_url_nwm;
        if (!dl) throw new Error('no url');
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `🎵 *Douyin*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'Douyin'); }
}

// ─── $snackvideo ──────────────────────────────────────────────────────────────

async function snackVideoCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🍿 Usage: $snackvideo <SnackVideo URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🍿 _Downloading SnackVideo…_' }, { quoted: message });
        const data = await get('/download/snackdl', { url });
        const dl   = data?.result?.media || pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `🍿 *SnackVideo*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'SnackVideo'); }
}

// ─── $soundcloud ──────────────────────────────────────────────────────────────

async function soundcloudCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🎧 Usage: $soundcloud <SoundCloud track URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🎧 _Downloading SoundCloud track…_' }, { quoted: message });
        const data  = await get('/download/soundclouddl', { url });
        const dl    = pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        const title = data?.result?.title || 'SoundCloud Track';
        const buf   = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            audio: buf, mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`, ptt: false,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'SoundCloud'); }
}

// ─── $mediafire ───────────────────────────────────────────────────────────────

async function mediafireCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🔥 Usage: $mediafire <MediaFire file URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🔥 _Fetching MediaFire link…_' }, { quoted: message });
        const data     = await get('/download/mediafire', { url });
        const res      = data?.result;
        const dl       = res?.download_url || res?.direct_link || res?.link || pickUrl(res);
        if (!dl) throw new Error('no url');
        const fileName = res?.filename || res?.name || url.split('/').filter(Boolean).pop() || 'mediafire_file';
        const buf      = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            document: buf, fileName,
            mimetype: 'application/octet-stream',
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'MediaFire'); }
}

// ─── $gdrive — Google Drive ───────────────────────────────────────────────────
// Drive's usercontent CDN is stable; no expiry — buffer anyway for consistency

async function gdriveCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '💾 Usage: $gdrive <Google Drive file URL>\n_File must be publicly shared._',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '💾 _Fetching Google Drive file…_' }, { quoted: message });
        const idMatch = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
        if (!idMatch) throw new Error('Could not extract file ID from URL');
        const fileId = idMatch[1];
        const dl     = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
        const buf    = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            document: buf,
            fileName: `gdrive_${fileId}`,
            mimetype: 'application/octet-stream',
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ Google Drive download failed.\n${err.message}\n\n_Make sure the file is set to "Anyone with the link can view"._`,
        }, { quoted: message });
    }
}

// ─── $videy ───────────────────────────────────────────────────────────────────

async function videyCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '📹 Usage: $videy <Videy URL>\nExample: $videy https://videy.co/video?id=abc123',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📹 _Downloading Videy video…_' }, { quoted: message });
        const idMatch = url.match(/[?&]id=([\w-]+)/) || url.match(/videy\.co\/([^/?&]+)/);
        if (!idMatch) throw new Error('Could not extract Videy video ID');
        const dl  = `https://cdn.videy.co/${idMatch[1]}.mp4`;
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: '📹 *Videy*\n\n_Daratech_ ⚡',
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, { text: `❌ Videy download failed.\n${err.message}` }, { quoted: message });
    }
}

// ─── $webdl — Direct URL download ────────────────────────────────────────────

async function webDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🌐 Usage: $webdl <direct media URL>',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🌐 _Downloading from URL…_' }, { quoted: message });
        const buf   = await toBuffer(url);
        const lower = url.toLowerCase().split('?')[0];
        if (/\.(jpe?g|png|webp|gif)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { image: buf, caption: '🌐 *WebDL*\n\n_Daratech_ ⚡' },
                { quoted: message });
        } else if (/\.(mp4|webm|mov|avi|mkv)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { video: buf, mimetype: 'video/mp4', caption: '🌐 *WebDL*\n\n_Daratech_ ⚡' },
                { quoted: message });
        } else if (/\.(mp3|ogg|flac|wav|m4a|aac)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { audio: buf, mimetype: 'audio/mpeg', ptt: false },
                { quoted: message });
        } else {
            const fileName = url.split('/').pop().split('?')[0] || 'download';
            await sock.sendMessage(chatId,
                { document: buf, fileName, mimetype: 'application/octet-stream' },
                { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'WebDL'); }
}

// ─── $aio — All-in-one downloader ────────────────────────────────────────────

async function aioCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: [
            '🔗 *$aio <URL>* — All-in-one downloader',
            '',
            'Supports: Twitter/X, Facebook, Bilibili, and more.',
            'For YouTube use $play / $video',
            'For TikTok use $tiktok',
            'For Instagram use $ig or $igdl',
            '',
            'Example: $aio https://x.com/user/status/123',
        ].join('\n'),
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🔗 _Auto-detecting platform and downloading…_' }, { quoted: message });
        const data = await get('/download/aiodl', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');

        const buf   = await toBuffer(dl);
        const lower = dl.toLowerCase().split('?')[0];
        if (/\.(mp3|ogg|flac|m4a)$/.test(lower) || data?.result?.type === 'audio') {
            await sock.sendMessage(chatId, {
                audio: buf, mimetype: 'audio/mpeg',
                fileName: `${data?.result?.title || 'audio'}.mp3`, ptt: false,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                video: buf, mimetype: 'video/mp4',
                caption: `🔗 *AIO Download*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'AIO'); }
}

module.exports = {
    twitterDlCommand,
    igdlCommand,
    pinterestDlCommand,
    douyinCommand,
    snackVideoCommand,
    soundcloudCommand,
    mediafireCommand,
    gdriveCommand,
    videyCommand,
    webDlCommand,
    aioCommand,
};
