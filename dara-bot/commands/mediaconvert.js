'use strict';
/**
 * mediaconvert.js — Media conversion commands
 * $toaudio  — reply to video/audio → send as MP3 audio file
 * $tovideo  — reply to audio/gif → send as MP4 video
 * $togif    — reply to video → convert to GIF
 * $toimage  — reply to video → extract thumbnail as image
 * $tosticker2 — reply to image/video → send as animated/static sticker
 */

const { spawn }  = require('child_process');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { toOgg, toMp4 } = require('../lib/media');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Helpers ───────────────────────────────────────────────────────────────────

const TMP = path.join(os.tmpdir(), 'daratech-convert');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

function tmpFile(ext) {
    // Ensure dir exists every time — it may be wiped by $cleartmp or the OS
    if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
    return path.join(TMP, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function cleanup(...files) {
    for (const f of files) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
}

function ffmpeg(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
        let stderr = '';
        proc.stderr.on('data', d => { stderr += d; });
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(stderr.trim() || `ffmpeg exited ${code}`));
        });
        proc.on('error', reject);
    });
}

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

/** Download the quoted or direct media from a message, return buffer + detected type */
async function downloadQuotedMedia(sock, message) {
    const ctx    = message.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;

    // Determine which message object to download from
    let surrogateMsg = null;
    let mediaType    = null;

    if (quoted) {
        const q = quoted;
        if (q.videoMessage)  { mediaType = 'video';  surrogateMsg = { key: { ...message.key, id: ctx.stanzaId }, message: q }; }
        else if (q.audioMessage) { mediaType = 'audio'; surrogateMsg = { key: { ...message.key, id: ctx.stanzaId }, message: q }; }
        else if (q.imageMessage) { mediaType = 'image'; surrogateMsg = { key: { ...message.key, id: ctx.stanzaId }, message: q }; }
        else if (q.stickerMessage) { mediaType = 'sticker'; surrogateMsg = { key: { ...message.key, id: ctx.stanzaId }, message: q }; }
        else if (q.gifMessage || (q.videoMessage?.gifPlayback)) { mediaType = 'gif'; surrogateMsg = { key: { ...message.key, id: ctx.stanzaId }, message: q }; }
    }

    // Direct media on the command message itself
    if (!surrogateMsg) {
        const m = message.message;
        if (m?.videoMessage)  { mediaType = 'video';  surrogateMsg = { key: message.key, message: m }; }
        else if (m?.audioMessage) { mediaType = 'audio'; surrogateMsg = { key: message.key, message: m }; }
        else if (m?.imageMessage) { mediaType = 'image'; surrogateMsg = { key: message.key, message: m }; }
        else if (m?.stickerMessage) { mediaType = 'sticker'; surrogateMsg = { key: message.key, message: m }; }
    }

    if (!surrogateMsg) return null;

    const buffer = await downloadMediaMessage(
        surrogateMsg, 'buffer', {},
        { reuploadRequest: sock.updateMediaMessage }
    );

    return { buffer, mediaType };
}

// ── $toaudio — any video/audio → MP3 file ────────────────────────────────────
async function toaudioCommand(sock, chatId, message) {
    try {
        const result = await downloadQuotedMedia(sock, message);
        if (!result || !['video', 'audio'].includes(result.mediaType)) {
            return sock.sendMessage(chatId, {
                text: '🎵 *TO AUDIO*\n\nReply to a *video* or *audio* message with *$toaudio* to convert it to an MP3 file.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: '🎵 Converting to audio…' }, { quoted: message });

        const inExt  = result.mediaType === 'video' ? '.mp4' : '.ogg';
        const inFile  = tmpFile(inExt);
        const outFile = tmpFile('.mp3');
        fs.writeFileSync(inFile, result.buffer);

        await ffmpeg(['-i', inFile, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '192k', outFile]);

        const mp3 = fs.readFileSync(outFile);
        cleanup(inFile, outFile);

        // WhatsApp/Baileys requires OGG/OPUS for audio bubbles — convert MP3 → OGG
        const oggBuf = await toOgg(mp3);
        const audioBuf  = oggBuf || mp3;
        const audioMime = oggBuf ? 'audio/ogg; codecs=opus' : 'audio/mpeg';

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            audio: audioBuf, mimetype: audioMime, ptt: false,
        }, { quoted: message });

    } catch (err) {
        console.error('[toaudio]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Conversion failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $tovideo — audio → MP4 video (black bg) ──────────────────────────────────
async function tovideoCommand(sock, chatId, message) {
    try {
        const result = await downloadQuotedMedia(sock, message);
        if (!result || result.mediaType !== 'audio') {
            return sock.sendMessage(chatId, {
                text: '🎬 *TO VIDEO*\n\nReply to an *audio* message with *$tovideo* to convert it to an MP4 video.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: '🎬 Converting to video…' }, { quoted: message });

        const inFile  = tmpFile('.ogg');
        const outFile = tmpFile('.mp4');
        fs.writeFileSync(inFile, result.buffer);

        // black background + audio
        await ffmpeg([
            '-i', inFile,
            '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=1',
            '-shortest', '-map', '1:v', '-map', '0:a',
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '128k', '-strict', '-2',
            '-movflags', '+faststart',
            outFile
        ]);

        const mp4 = fs.readFileSync(outFile);
        cleanup(inFile, outFile);

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            video: mp4, mimetype: 'video/mp4',
            caption: `🎬 *Video file*\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[tovideo]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Conversion failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $togif — video → animated GIF ────────────────────────────────────────────
async function togifCommand(sock, chatId, message) {
    try {
        const result = await downloadQuotedMedia(sock, message);
        if (!result || result.mediaType !== 'video') {
            return sock.sendMessage(chatId, {
                text: '🎞️ *TO GIF*\n\nReply to a *video* with *$togif* to convert it to an animated GIF.\n\n⚠️ Best for short clips (under 10s).\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: '🎞️ Converting to GIF… (may take a moment)' }, { quoted: message });

        const inFile      = tmpFile('.mp4');
        const paletteFile = tmpFile('.png');
        const outFile     = tmpFile('.gif');
        fs.writeFileSync(inFile, result.buffer);

        // Two-pass palette GIF — much lighter on memory than the split-filter approach
        // Pass 1: generate palette from first 10s at 320px / 8fps
        await ffmpeg([
            '-i', inFile,
            '-t', '10',
            '-vf', 'fps=8,scale=320:-2:flags=lanczos,palettegen=max_colors=64',
            '-y', paletteFile,
        ]);

        // Pass 2: apply palette to produce the GIF
        await ffmpeg([
            '-i', inFile,
            '-i', paletteFile,
            '-t', '10',
            '-filter_complex', 'fps=8,scale=320:-2:flags=lanczos[v];[v][1:v]paletteuse=dither=bayer',
            '-loop', '0',
            outFile,
        ]);

        const gif = fs.readFileSync(outFile);
        cleanup(inFile, paletteFile, outFile);

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            image: gif, mimetype: 'image/gif',
            caption: `🎞️ *GIF*\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[togif]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ GIF conversion failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $toimage — video → thumbnail frame ───────────────────────────────────────
async function toimageCommand(sock, chatId, message) {
    try {
        const result = await downloadQuotedMedia(sock, message);
        if (!result || result.mediaType !== 'video') {
            return sock.sendMessage(chatId, {
                text: '🖼️ *TO IMAGE*\n\nReply to a *video* with *$toimage* to extract its thumbnail frame as an image.\n\n_Daratech_ ⚡'
            }, { quoted: message });
        }

        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: '🖼️ Extracting frame…' }, { quoted: message });

        const inFile  = tmpFile('.mp4');
        const outFile = tmpFile('.jpg');
        fs.writeFileSync(inFile, result.buffer);

        await ffmpeg(['-i', inFile, '-vframes', '1', '-q:v', '2', outFile]);

        const img = fs.readFileSync(outFile);
        cleanup(inFile, outFile);

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            image: img,
            caption: `🖼️ *Video thumbnail*\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[toimage]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Frame extraction failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = { toaudioCommand, tovideoCommand, togifCommand, toimageCommand };
