'use strict';
/**
 * Instagram Downloader — logic ported from working ruhend-scraper source.
 * Primary: ruhend-scraper igdl  |  Fallback: GiftedTech instadlv2
 */

const { igdl } = require('ruhend-scraper');
const { get }  = require('../lib/gifted');
const { toMp4, toBuffer } = require('../lib/media');

// Prevent duplicate processing of the same message
const processedMessages = new Set();

// ─── URL deduplication ────────────────────────────────────────────────────────
function extractUniqueMedia(mediaData) {
    const seen   = new Set();
    const result = [];
    for (const media of mediaData) {
        if (!media?.url || seen.has(media.url)) continue;
        seen.add(media.url);
        result.push(media);
    }
    return result;
}

// ─── Instagram URL validator ──────────────────────────────────────────────────
const IG_PATTERNS = [
    /https?:\/\/(?:www\.)?instagram\.com\/p\//,
    /https?:\/\/(?:www\.)?instagram\.com\/reel\//,
    /https?:\/\/(?:www\.)?instagram\.com\/tv\//,
    /https?:\/\/(?:www\.)?instagram\.com\/stories\//,
    /https?:\/\/(?:www\.)?instagram\.com\//,
    /https?:\/\/(?:www\.)?instagr\.am\//,
];

function isInstagramUrl(text) {
    return IG_PATTERNS.some(p => p.test(text));
}

// ─── Main command ─────────────────────────────────────────────────────────────
async function instagramCommand(sock, chatId, message) {
    // Duplicate guard
    if (processedMessages.has(message.key.id)) return;
    processedMessages.add(message.key.id);
    setTimeout(() => processedMessages.delete(message.key.id), 5 * 60 * 1000);

    try {
        const text = (
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text || ''
        ).trim();

        // Extract URL from the message
        const urlMatch = text.match(/https?:\/\/\S+/);
        if (!urlMatch || !isInstagramUrl(urlMatch[0])) {
            return sock.sendMessage(chatId, {
                text: '📸 *Instagram Downloader*\n\n' +
                      'Usage: *$ig <Instagram URL>*\n\n' +
                      'Supports: Posts, Reels, TV, Stories\n\n' +
                      '_Daratech_ ⚡',
            }, { quoted: message });
        }

        const url = urlMatch[0];

        // React to show we're working
        await sock.sendMessage(chatId, {
            react: { text: '📥', key: message.key },
        });

        // ── 1. Primary: ruhend-scraper igdl ──────────────────────────────────
        let mediaItems = [];
        try {
            const downloadData = await igdl(url);
            if (downloadData?.data?.length) {
                mediaItems = extractUniqueMedia(downloadData.data);
            }
        } catch (err) {
            console.error('[instagram] ruhend-scraper error:', err.message);
        }

        // ── 2. Fallback: GiftedTech instadlv2 ────────────────────────────────
        if (!mediaItems.length) {
            try {
                const data = await get('/download/instadlv2', { url });
                const r    = data?.result;
                if (r) {
                    if (Array.isArray(r) && r.length) {
                        mediaItems = extractUniqueMedia(r.filter(m => m?.url));
                    } else if (r.url) {
                        mediaItems = [{ url: r.url, type: r.type || 'image' }];
                    } else if (r.media_url) {
                        mediaItems = [{ url: r.media_url, type: r.type || 'image' }];
                    }
                }
            } catch (err) {
                console.error('[instagram] gifted fallback error:', err.message);
            }
        }

        if (!mediaItems.length) {
            return sock.sendMessage(chatId, {
                text: '❌ No media found. The post may be private or the link is invalid.\n\n_Daratech_ ⚡',
            }, { quoted: message });
        }

        const caption  = `📸 *Instagram*\n\n_Daratech_ ⚡`;
        const isReel   = url.includes('/reel/') || url.includes('/tv/');
        const toSend   = mediaItems.slice(0, 20); // max 20 items

        for (let i = 0; i < toSend.length; i++) {
            const media    = toSend[i];
            const mediaUrl = media.url;

            const isVideo  = media.type === 'video' ||
                             /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(mediaUrl) ||
                             isReel;

            try {
                if (isVideo) {
                    // Download + re-encode to H.264/AAC/faststart — Baileys requires this
                    let vidBuf = null;
                    try { vidBuf = await toBuffer(mediaUrl); } catch {}
                    if (vidBuf) {
                        const mp4 = await toMp4(vidBuf);
                        vidBuf = mp4 || vidBuf; // use re-encoded, fall back to raw
                    }
                    if (vidBuf) {
                        await sock.sendMessage(chatId, {
                            video:    vidBuf,
                            mimetype: 'video/mp4',
                            caption:  i === 0 ? caption : '',
                        }, { quoted: i === 0 ? message : undefined });
                    } else {
                        // Last resort — direct URL
                        await sock.sendMessage(chatId, {
                            video:    { url: mediaUrl },
                            mimetype: 'video/mp4',
                            caption:  i === 0 ? caption : '',
                        }, { quoted: i === 0 ? message : undefined });
                    }
                } else {
                    await sock.sendMessage(chatId, {
                        image:   { url: mediaUrl },
                        caption: i === 0 ? caption : '',
                    }, { quoted: i === 0 ? message : undefined });
                }
            } catch (itemErr) {
                console.error(`[instagram] media ${i + 1} failed:`, itemErr.message);
            }

            // Small delay between items to avoid rate limiting
            if (i < toSend.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }

    } catch (err) {
        console.error('[instagram]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ An error occurred while downloading Instagram media. Please try again.\n\n_Daratech_ ⚡',
        }, { quoted: message });
    }
}

module.exports = instagramCommand;
