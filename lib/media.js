'use strict';
/**
 * lib/media.js — shared media helpers
 *
 * WhatsApp / Baileys v7 requirements:
 *   Audio → OGG/OPUS  (toOgg)
 *   Video → H.264 + AAC + MP4 faststart  (toMp4)
 *
 * Sending the wrong codec shows "couldn't download" on the client.
 */

const { spawn }  = require('child_process');
const axios      = require('axios');
const getFfmpegPath = require('./getFfmpeg');

/**
 * Convert any video Buffer to H.264 + AAC + MP4 (faststart) via ffmpeg.
 * WhatsApp requires this exact codec combination for playable video messages.
 * Returns null on failure — callers should fall back to document send.
 */
function toMp4(inputBuf) {
    return new Promise((resolve) => {
        let ff;
        try {
            ff = spawn(getFfmpegPath(), [
                '-loglevel', 'error',
                '-i',        'pipe:0',          // stdin
                '-c:v',      'libx264',         // H.264 — WhatsApp requirement
                '-preset',   'fast',
                '-crf',      '28',
                '-pix_fmt',  'yuv420p',         // universal compatibility
                '-c:a',      'aac',             // AAC — WhatsApp requirement
                '-b:a',      '128k',
                '-movflags', '+faststart',      // moov atom at front for streaming
                '-f',        'mp4',
                'pipe:1',                       // stdout
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch {
            return resolve(null);
        }

        const out = [];
        ff.stdout.on('data', d => out.push(d));
        ff.stderr.on('data', () => {});

        ff.on('close', code => {
            if (code === 0 && out.length) resolve(Buffer.concat(out));
            else resolve(null);
        });
        ff.on('error', () => resolve(null));

        try {
            ff.stdin.write(inputBuf);
            ff.stdin.end();
        } catch {
            resolve(null);
        }
    });
}

/**
 * Convert any audio Buffer (MP3, M4A, WebM …) to OGG/OPUS Buffer via ffmpeg.
 * Returns null if ffmpeg is unavailable — callers should fall back to document send.
 */
function toOgg(inputBuf) {
    const codecs = ['libopus', 'opus'];

    const run = (codecIndex) => new Promise((resolve) => {
        const ffmpegPath = getFfmpegPath();
        let ff;
        try {
            ff = spawn(ffmpegPath, [
                '-hide_banner', '-loglevel', 'error', '-y',
                '-i',        'pipe:0',
                '-map',      '0:a:0?',
                '-vn',
                '-c:a',      codecs[codecIndex],
                '-application', 'voip',
                '-b:a',      '64k',
                '-ar',       '48000',
                '-ac',       '1',
                '-f',        'ogg',
                'pipe:1',
            ], { stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (error) {
            return resolve({ buffer: null, error });
        }

        const out = [];
        const errors = [];
        ff.stdout.on('data', d => out.push(d));
        ff.stderr.on('data', d => errors.push(d));
        ff.on('error', error => resolve({ buffer: null, error }));
        ff.on('close', code => {
            if (code === 0 && out.length) return resolve({ buffer: Buffer.concat(out), error: null });
            const error = new Error(Buffer.concat(errors).toString().trim() || `ffmpeg exited with code ${code}`);
            error.code = code;
            resolve({ buffer: null, error });
        });

        try {
            ff.stdin.end(inputBuf);
        } catch (error) {
            resolve({ buffer: null, error });
        }
    });

    return (async () => {
        let lastError;
        for (let i = 0; i < codecs.length; i++) {
            const result = await run(i);
            if (result.buffer) return result.buffer;
            lastError = result.error;
        }
        console.error(`[media] Opus conversion failed using ${getFfmpegPath()}:`, lastError?.message || 'unknown error');
        return null;
    })();
}

/**
 * Download a URL to a Buffer with generous timeout + redirect following.
 * Adds a browser-like User-Agent so CDNs don't block the download.
 */
async function toBuffer(url, timeout = 120000, extraHeaders = {}) {
    const res = await axios.get(url, {
        responseType:    'arraybuffer',
        timeout,
        maxContentLength: Infinity,
        maxBodyLength:    Infinity,
        maxRedirects:     10,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept':     '*/*',
            ...extraHeaders,
        },
    });
    return Buffer.from(res.data);
}

module.exports = { toOgg, toMp4, toBuffer };
