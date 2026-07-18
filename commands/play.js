'use strict';
const yts = require('yt-search');
const { get } = require('../lib/gifted');

async function playCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            return sock.sendMessage(chatId, { text: '🎵 Usage: .play <song name or YouTube URL>' }, { quoted: message });
        }

        let videoUrl = input;
        let title    = input;
        let thumbnail = null;
        let duration  = '';
        let author    = '';
        let views     = '';

        if (!/youtube\.com|youtu\.be/i.test(input)) {
            const { videos } = await yts(input);
            if (!videos?.length) throw new Error('No results found for: ' + input);
            const v  = videos[0];
            videoUrl  = v.url;
            title     = v.title;
            thumbnail = v.thumbnail || v.image || null;
            duration  = v.timestamp  || '';
            author    = v.author?.name || '';
            views     = v.views ? Number(v.views).toLocaleString() : '';
        }

        // ── Show thumbnail banner while downloading ───────────────────────
        const caption =
            `🎵 *${title}*\n` +
            (author   ? `👤 ${author}\n`      : '') +
            (duration ? `⏱️ ${duration}\n`    : '') +
            (views    ? `👁️ ${views} views\n` : '') +
            `\n⬇️ _Downloading audio…_`;

        if (thumbnail) {
            await sock.sendMessage(chatId, {
                image:   { url: thumbnail },
                caption: caption,
            }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }

        // ── Fetch and send audio ──────────────────────────────────────────
        const data = await get('/download/ytaudio', { url: videoUrl });
        const dl   = data?.result?.download_url || data?.result?.url || data?.download_url;
        if (!dl) throw new Error('No download URL returned');

        const songTitle = data?.result?.title || title;
        await sock.sendMessage(chatId, {
            audio:    { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${songTitle}.mp3`,
            ptt:      false,
        }, { quoted: message });

    } catch (err) {
        console.error('[play]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Audio download failed. Try again.' }, { quoted: message });
    }
}

module.exports = playCommand;
