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

// ─── $pinterestdl / $pintdl / $pdl ───────────────────────────────────────────

function isPinterestUrl(u) {
    return /pinterest\.(com|co\.\w+|[a-z]{2,3})\/pin\//i.test(u) || /pin\.it\//i.test(u);
}

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

        const apiRes = await axios.get('https://api.nexray.eu.cc/downloader/pinterest', {
            params: { url },
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });

        const pinData = apiRes.data?.result;
        if (!apiRes.data?.status || !pinData) throw new Error('No data returned from API');

        const isVideo = !!pinData.video;
        const mediaUrl = pinData.video || pinData.image || pinData.url;
        if (!mediaUrl) throw new Error('No media URL in API response');

        const buf = await axios.get(mediaUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.pinterest.com/',
            },
        }).then(r => Buffer.from(r.data));

        const title  = pinData.title  || '';
        const author = pinData.author || '';
        const caption = `📌 *Pinterest*${title ? `\n${title}` : ''}${author ? `\n👤 ${author}` : ''}\n\n_Daratech_ ⚡`;

        if (isVideo) {
            await sock.sendMessage(chatId, {
                video: buf, mimetype: 'video/mp4', caption,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { image: buf, caption }, { quoted: message });
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

        let dl = null, title = '';

        // Method 1 — nexray API (returns proper download_url)
        try {
            const { data } = await axios.get('https://api.nexray.eu.cc/downloader/snackvideo', {
                params: { url }, timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (data?.status && data?.result?.download_url) {
                dl    = data.result.download_url;
                title = data.result.title || '';
            }
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech snackdl fallback
        if (!dl) {
            const data = await get('/download/snackdl', { url });
            const media = data?.result?.media;
            dl    = (media && media !== '' ? media : null) || pickUrl(data?.result);
            title = data?.result?.title || title;
        }

        if (!dl) throw new Error('no url');
        const buf = await toBuffer(dl);
        await sock.sendMessage(chatId, {
            video: buf, mimetype: 'video/mp4',
            caption: `🍿 *SnackVideo*${title ? `\n${title}` : ''}\n\n_Daratech_ ⚡`,
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
        const dl       = res?.downloadUrl || res?.download_url || res?.direct_link || res?.link || pickUrl(res);
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
