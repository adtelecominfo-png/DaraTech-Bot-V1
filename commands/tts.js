'use strict';
const gTTS        = require('gtts');
const fs          = require('fs');
const path        = require('path');
const axios       = require('axios');
const { toOgg }   = require('../lib/media');

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text) {
        await sock.sendMessage(chatId, {
            text: '🗣️ Usage: $tts <text>\nFor a specific language: $tts es Hola mundo',
        });
        return;
    }

    await sock.sendMessage(chatId, { text: '🗣️ Converting text to speech…' }, { quoted: message });

    let mp3Buf;

    // Method 1 — Google Translate TTS (no temp file, fastest)
    try {
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(language)}&client=tw-ob`;
        const res = await axios.get(ttsUrl, {
            responseType: 'arraybuffer',
            timeout: 20000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer':    'https://translate.google.com/',
            },
        });
        mp3Buf = Buffer.from(res.data);
        if (mp3Buf.length < 100) throw new Error('empty');
    } catch {
        // Method 2 — gtts library → temp file → buffer
        const tmpDir  = path.join(__dirname, '../temp');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        const tmpFile = path.join(tmpDir, `tts-${Date.now()}.mp3`);
        try {
            await new Promise((res, rej) => {
                new gTTS(text, language).save(tmpFile, err => err ? rej(err) : res());
            });
            mp3Buf = fs.readFileSync(tmpFile);
        } finally {
            try { fs.unlinkSync(tmpFile); } catch {}
        }
    }

    // Convert MP3 → OGG/OPUS (WhatsApp Baileys v7 requires Opus for audio bubbles)
    const oggBuf = await toOgg(mp3Buf);

    await sock.sendMessage(chatId, {
        audio:    oggBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt:      false,
    }, { quoted: message });
}

module.exports = ttsCommand;
