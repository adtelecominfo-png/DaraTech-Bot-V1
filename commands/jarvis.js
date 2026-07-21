'use strict';
/**
 * jarvis.js — Convert text to JARVIS (Iron Man AI) style voice note
 * $jarvis <text>
 * Uses StreamElements TTS with 'Brian' voice + pitch/bass ffmpeg effects
 */

const axios    = require('axios');
const { spawn } = require('child_process');
const { toOgg } = require('../lib/media');

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getText(message) {
    const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

/** Fetch TTS audio from StreamElements as buffer */
async function fetchTTS(text, voice = 'Brian') {
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodeURIComponent(text)}`;
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

/** Apply JARVIS-style pitch + reverb effects via ffmpeg stdin→stdout */
function applyJarvisEffect(inputBuf) {
    return new Promise((resolve) => {
        let ff;
        try {
            ff = spawn('ffmpeg', [
                '-loglevel', 'error',
                '-i', 'pipe:0',
                '-af', [
                    'asetrate=44100*1.15',   // slight pitch-up (robotic)
                    'aresample=44100',
                    'bass=g=4',              // boost bass slightly
                    'treble=g=2',            // sharpen highs
                    'volume=1.3'
                ].join(','),
                '-f', 'mp3',
                'pipe:1',
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch {
            return resolve(inputBuf); // return original on error
        }

        const out = [];
        ff.stdout.on('data', d => out.push(d));
        ff.stderr.on('data', () => {});
        ff.on('close', code => resolve(code === 0 && out.length ? Buffer.concat(out) : inputBuf));
        ff.on('error', () => resolve(inputBuf));

        try { ff.stdin.write(inputBuf); ff.stdin.end(); } catch { resolve(inputBuf); }
    });
}

async function jarvisCommand(sock, chatId, message) {
    const text = getText(message);

    if (!text) {
        return sock.sendMessage(chatId, {
            text: `🤖 *J.A.R.V.I.S.*\n\n` +
                  `*Usage:* $jarvis <text>\n\n` +
                  `*Examples:*\n` +
                  `▸ $jarvis Good morning, sir\n` +
                  `▸ $jarvis Power at 400% capacity\n` +
                  `▸ $jarvis Shall I prepare the suit?\n\n` +
                  `_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '🤖');
    await sock.sendMessage(chatId, { text: '🤖 _Generating JARVIS voice…_' }, { quoted: message });

    try {
        let mp3 = await fetchTTS(text, 'Brian');
        const effected = await applyJarvisEffect(mp3);
        const ogg = await toOgg(effected);
        const buf  = ogg || effected;
        const mime = ogg ? 'audio/ogg; codecs=opus' : 'audio/mpeg';

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            audio:    buf,
            mimetype: mime,
            ptt:      true, // send as voice note
        }, { quoted: message });

    } catch (err) {
        console.error('[jarvis]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ JARVIS failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = jarvisCommand;
