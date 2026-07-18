'use strict';
/**
 * downloaders.js — Platform-specific media downloaders
 *
 * All endpoints confirmed against api.giftedtech.co.ke/api docs.
 * Response shape: { status, success, result: { download_url|media|url, title, ... } }
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

/**
 * Try multiple candidate fields for a download URL.
 * Handles: download_url, url, media, video, audio, hd, sd, link, or first
 * element of an array result.
 */
function pickUrl(result) {
    if (!result) return null;
    if (typeof result === 'string' && result.startsWith('http')) return result;
    const fields = ['download_url', 'url', 'media', 'video', 'audio',
                    'hd', 'sd', 'link', 'mp4', 'mp3'];
    for (const f of fields) {
        if (typeof result[f] === 'string' && result[f].startsWith('http')) return result[f];
    }
    // Array of quality objects
    if (Array.isArray(result)) {
        for (const item of result) {
            const u = pickUrl(item);
            if (u) return u;
        }
    }
    if (Array.isArray(result.urls)) {
        const u = result.urls.find(u => typeof u === 'string' && u.startsWith('http'));
        if (u) return u;
    }
    return null;
}

async function sendErr(sock, chatId, message, platform) {
    await sock.sendMessage(chatId, {
        text: `❌ Could not download from *${platform}*.\nMake sure you sent a valid ${platform} link and try again.`,
    }, { quoted: message });
}

// ─── .twitter / .twdl — Twitter / X video ────────────────────────────────────
// Endpoint: /download/twitterdlv2   params: apikey, url

async function twitterDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🐦 Usage: .twitter <tweet URL>\nExample: .twitter https://x.com/user/status/123456789',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🐦 _Downloading Twitter/X video…_' }, { quoted: message });
        const data = await get('/download/twitterdlv2', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        await sock.sendMessage(chatId, {
            video: { url: dl }, mimetype: 'video/mp4',
            caption: `🐦 *Twitter / X*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'Twitter/X'); }
}

// ─── .igdl — Instagram Reels / posts ─────────────────────────────────────────
// Endpoint: /download/instadlv2   params: apikey, url

async function igdlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '📸 Usage: .igdl <Instagram post/reel URL>\nExample: .igdl https://www.instagram.com/p/ABC123/',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📸 _Downloading Instagram media…_' }, { quoted: message });
        const data = await get('/download/instadlv2', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');

        const isVideo = /\.(mp4|webm|mov)/i.test(dl) || data?.result?.type === 'video';
        if (isVideo) {
            await sock.sendMessage(chatId, {
                video: { url: dl }, mimetype: 'video/mp4',
                caption: `📸 *Instagram*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                image: { url: dl }, caption: `📸 *Instagram*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'Instagram'); }
}

// ─── .pinterestdl — Pinterest image / video / GIF ────────────────────────────
// Endpoints: /download/pinterestv2 → v3 → v4  (cascade fallback)

async function pinterestDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '📌 Usage: .pinterestdl <Pinterest pin URL>\nExample: .pinterestdl https://pin.it/abc123',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📌 _Downloading Pinterest pin…_' }, { quoted: message });

        // Try v2 → v3 → v4 until one returns a download URL
        let dl = null;
        for (const ep of ['/download/pinterestv2', '/download/pinterestv3', '/download/pinterestv4']) {
            try {
                const data = await get(ep, { url });
                dl = pickUrl(data?.result);
                if (dl) break;
            } catch { /* try next */ }
        }
        if (!dl) throw new Error('no url');

        const isVideo = /\.(mp4|webm|mov)/i.test(dl);
        if (isVideo) {
            await sock.sendMessage(chatId, {
                video: { url: dl }, mimetype: 'video/mp4',
                caption: '📌 *Pinterest*\n\n_Daratech_ ⚡',
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                image: { url: dl }, caption: '📌 *Pinterest*\n\n_Daratech_ ⚡',
            }, { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'Pinterest'); }
}

// ─── .douyin — Douyin (Chinese TikTok) ───────────────────────────────────────
// Endpoint: /download/tiktokdlv2   (handles douyin URLs natively)

async function douyinCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🎵 Usage: .douyin <Douyin URL>\nExample: .douyin https://v.douyin.com/abc123',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🎵 _Downloading Douyin video…_' }, { quoted: message });
        const data = await get('/download/tiktokdlv2', { url });
        const dl   = pickUrl(data?.result) || data?.result?.nowatermark || data?.result?.video_url_nwm;
        if (!dl) throw new Error('no url');
        await sock.sendMessage(chatId, {
            video: { url: dl }, mimetype: 'video/mp4',
            caption: `🎵 *Douyin*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'Douyin'); }
}

// ─── .snackvideo — SnackVideo ─────────────────────────────────────────────────
// Endpoint: /download/snackdl   result.media = download URL

async function snackVideoCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🍿 Usage: .snackvideo <SnackVideo URL>\nExample: .snackvideo https://www.snackvideo.com/video/12345',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🍿 _Downloading SnackVideo…_' }, { quoted: message });
        const data = await get('/download/snackdl', { url });
        // snackdl uses result.media for the download URL
        const dl   = data?.result?.media || pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        await sock.sendMessage(chatId, {
            video: { url: dl }, mimetype: 'video/mp4',
            caption: `🍿 *SnackVideo*\n${data?.result?.title || ''}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'SnackVideo'); }
}

// ─── .soundcloud — SoundCloud track download ─────────────────────────────────
// Endpoint: /download/soundclouddl   params: apikey, url

async function soundcloudCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🎧 Usage: .soundcloud <SoundCloud track URL>\nExample: .soundcloud https://soundcloud.com/artist/track',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🎧 _Downloading SoundCloud track…_' }, { quoted: message });
        const data = await get('/download/soundclouddl', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');
        const title = data?.result?.title || 'SoundCloud Track';
        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${title}.mp3`,
            ptt:      false,
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'SoundCloud'); }
}

// ─── .mediafire — MediaFire file download ────────────────────────────────────
// Endpoint: /download/mediafire   result.download_url or result.direct_link

async function mediafireCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🔥 Usage: .mediafire <MediaFire file URL>\nExample: .mediafire https://www.mediafire.com/file/abc123/file.zip/file',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🔥 _Fetching MediaFire link…_' }, { quoted: message });
        const data = await get('/download/mediafire', { url });
        const res  = data?.result;
        const dl   = res?.download_url || res?.direct_link || res?.link || pickUrl(res);
        if (!dl) throw new Error('no url');
        const fileName = res?.filename || res?.name || url.split('/').filter(Boolean).pop() || 'mediafire_file';
        await sock.sendMessage(chatId, {
            document: { url: dl },
            fileName,
            mimetype: 'application/octet-stream',
        }, { quoted: message });
    } catch { await sendErr(sock, chatId, message, 'MediaFire'); }
}

// ─── .gdrive — Google Drive (public files only) ───────────────────────────────
// GiftedTech /download/googledrive is 404; use Drive's export CDN directly.

async function gdriveCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '💾 Usage: .gdrive <Google Drive file URL>\nExample: .gdrive https://drive.google.com/file/d/FILE_ID/view\n\n_File must be publicly shared._',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '💾 _Fetching Google Drive file…_' }, { quoted: message });
        const idMatch = url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
        if (!idMatch) throw new Error('Could not extract file ID from URL');
        const fileId = idMatch[1];
        const dl     = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
        await sock.sendMessage(chatId, {
            document: { url: dl },
            fileName: `gdrive_${fileId}`,
            mimetype: 'application/octet-stream',
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ Google Drive download failed.\n${err.message}\n\n_Make sure the file is set to "Anyone with the link can view"._`,
        }, { quoted: message });
    }
}

// ─── .videy — Videy.co video download ────────────────────────────────────────
// Videy stores videos at cdn.videy.co/VIDEO_ID.mp4

async function videyCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '📹 Usage: .videy <Videy URL>\nExample: .videy https://videy.co/video?id=abc123',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '📹 _Downloading Videy video…_' }, { quoted: message });
        const idMatch = url.match(/[?&]id=([\w-]+)/) || url.match(/videy\.co\/([^/?&]+)/);
        if (!idMatch) throw new Error('Could not extract Videy video ID');
        const vidId = idMatch[1];
        const dl    = `https://cdn.videy.co/${vidId}.mp4`;
        await sock.sendMessage(chatId, {
            video: { url: dl }, mimetype: 'video/mp4',
            caption: '📹 *Videy*\n\n_Daratech_ ⚡',
        }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, {
            text: `❌ Videy download failed.\n${err.message}`,
        }, { quoted: message });
    }
}

// ─── .webdl — Direct URL download (image / video / audio / file) ─────────────

async function webDlCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: '🌐 Usage: .webdl <direct media URL>\n_Downloads any image, video, audio, or file from a direct link._',
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🌐 _Downloading from URL…_' }, { quoted: message });
        const lower = url.toLowerCase().split('?')[0];
        if (/\.(jpe?g|png|webp|gif)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { image: { url }, caption: '🌐 *WebDL*\n\n_Daratech_ ⚡' },
                { quoted: message });
        } else if (/\.(mp4|webm|mov|avi|mkv)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { video: { url }, mimetype: 'video/mp4', caption: '🌐 *WebDL*\n\n_Daratech_ ⚡' },
                { quoted: message });
        } else if (/\.(mp3|ogg|flac|wav|m4a|aac)$/.test(lower)) {
            await sock.sendMessage(chatId,
                { audio: { url }, mimetype: 'audio/mpeg', ptt: false },
                { quoted: message });
        } else {
            const fileName = url.split('/').pop().split('?')[0] || 'download';
            await sock.sendMessage(chatId,
                { document: { url }, fileName, mimetype: 'application/octet-stream' },
                { quoted: message });
        }
    } catch { await sendErr(sock, chatId, message, 'WebDL'); }
}

// ─── .aio — All-in-one media downloader ──────────────────────────────────────
// Endpoint: /download/aiodl   supports Twitter/X, Bilibili, Facebook & more

async function aioCommand(sock, chatId, message) {
    const url = extractArg(message);
    if (!url || !isUrl(url)) return sock.sendMessage(chatId, {
        text: [
            '🔗 *.aio <URL>* — All-in-one downloader',
            '',
            'Supports: Twitter/X, Facebook, Bilibili, and more.',
            'For YouTube use .play / .video',
            'For TikTok use .tiktok',
            'For Instagram use .instagram or .igdl',
            '',
            'Example: .aio https://x.com/user/status/123',
        ].join('\n'),
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🔗 _Auto-detecting platform and downloading…_' }, { quoted: message });
        const data = await get('/download/aiodl', { url });
        const dl   = pickUrl(data?.result);
        if (!dl) throw new Error('no url');

        const lower = dl.toLowerCase().split('?')[0];
        if (/\.(mp3|ogg|flac|m4a)$/.test(lower) || data?.result?.type === 'audio') {
            await sock.sendMessage(chatId, {
                audio: { url: dl }, mimetype: 'audio/mpeg',
                fileName: `${data?.result?.title || 'audio'}.mp3`, ptt: false,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, {
                video: { url: dl }, mimetype: 'video/mp4',
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
