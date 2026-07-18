'use strict';
const yts = require('yt-search');
const { get } = require('../lib/gifted');

async function videoCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const input = text.split(' ').slice(1).join(' ').trim();
        if (!input) {
            return sock.sendMessage(chatId, { text: '🎬 Usage: .video <title or YouTube URL>' }, { quoted: message });
        }
        let videoUrl = input;
        let title = input;
        if (!/youtube\.com|youtu\.be/i.test(input)) {
            const { videos } = await yts(input);
            if (!videos?.length) throw new Error('No results found for: ' + input);
            videoUrl = videos[0].url;
            title = videos[0].title;
        }
        await sock.sendMessage(chatId, { text: `🎬 Downloading: *${title}*...` }, { quoted: message });
        const data = await get('/download/ytmp4', { url: videoUrl });
        const dl = data?.result?.download_url || data?.result?.url || data?.download_url;
        if (!dl) throw new Error('No download URL returned');
        const videoTitle = data?.result?.title || title;
        await sock.sendMessage(chatId, {
            video: { url: dl },
            mimetype: 'video/mp4',
            caption: `🎬 *${videoTitle}*\n\n✨ *Daratech Bot*`,
        }, { quoted: message });
    } catch (err) {
        console.error('[video]', err.message);
        await sock.sendMessage(chatId, { text: '❌ Video download failed. Try again.' }, { quoted: message });
    }
}

module.exports = videoCommand;
