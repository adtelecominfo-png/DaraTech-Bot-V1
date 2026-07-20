'use strict';
const gTTS = require('gtts');
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide the text for TTS conversion.\nUsage: $tts <text>\nFor another language: $tts <lang> <text>' });
        return;
    }

    await sock.sendMessage(chatId, { text: '🗣️ Converting text to speech…' }, { quoted: message });

    // Method 1: Google Translate TTS URL (no temp file needed)
    try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(language)}&client=tw-ob`;
        // Download to buffer so Baileys can re-upload to WhatsApp CDN
        const res = await axios.get(ttsUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Referer': 'https://translate.google.com/',
            },
        });
        const audioBuf = Buffer.from(res.data);
        if (audioBuf.length < 100) throw new Error('Empty audio from Google TTS');

        await sock.sendMessage(chatId, {
            audio:    audioBuf,
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
        return;
    } catch (err) {
        console.warn('[tts] Google TTS URL failed, falling back to gtts lib:', err.message);
    }

    // Method 2: gtts library → temp file → buffer
    const tmpDir  = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `tts-${Date.now()}.mp3`);

    try {
        const gtts = new gTTS(text, language);
        await new Promise((resolve, reject) => {
            gtts.save(filePath, err => (err ? reject(err) : resolve()));
        });

        const audioBuf = fs.readFileSync(filePath);
        if (audioBuf.length < 100) throw new Error('gtts generated empty audio');

        await sock.sendMessage(chatId, {
            audio:    audioBuf,
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
    } catch (err) {
        console.error('[tts]', err.message);
        await sock.sendMessage(chatId, { text: '❌ TTS conversion failed. Try again.' }, { quoted: message });
    } finally {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
}

module.exports = ttsCommand;
