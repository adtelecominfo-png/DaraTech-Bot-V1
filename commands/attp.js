'use strict';

const { spawn } = require('child_process');
const crypto = require('crypto');
const webp = require('node-webpmux');
const settings = require('../settings');

function runFfmpeg(args) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
        const chunks = [];
        const errors = [];
        ff.stdout.on('data', chunk => chunks.push(chunk));
        ff.stderr.on('data', chunk => errors.push(chunk));
        ff.on('error', reject);
        ff.on('close', code => {
            if (code === 0 && chunks.length) return resolve(Buffer.concat(chunks));
            reject(new Error(Buffer.concat(errors).toString() || `ffmpeg exited with code ${code}`));
        });
    });
}

function escapeDrawtext(text) {
    return String(text)
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'")
        .replace(/,/g, '\\,')
        .replace(/%/g, '\\%')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
}

async function addMetadata(buffer) {
    const image = new webp.Image();
    await image.load(buffer);
    const json = {
        'sticker-pack-id': crypto.randomBytes(16).toString('hex'),
        'sticker-pack-name': settings.packname || 'Daratech',
        'sticker-pack-publisher': settings.author || 'Daratech',
        emojis: ['🤖']
    };
    const header = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json));
    const exif = Buffer.concat([header, jsonBuffer]);
    exif.writeUInt32LE(jsonBuffer.length, 14);
    image.exif = exif;
    return image.save(null);
}

async function renderAnimatedText(text) {
    const font = process.platform === 'win32'
        ? 'C:/Windows/Fonts/arialbd.ttf'
        : '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    const safe = escapeDrawtext(text);
    const filter = `drawtext=fontfile='${font}':text='${safe}':fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:borderw=2:bordercolor=black@0.6:fontcolor=white`;

    return runFfmpeg([
        '-f', 'lavfi', '-i', 'color=c=black:s=512x512:d=1.8:r=20',
        '-vf', filter, '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '55',
        '-compression_level', '6', '-loop', '0', '-an', '-f', 'webp', 'pipe:1'
    ]);
}

async function attpCommand(sock, chatId, message) {
    const userMessage = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const text = userMessage.split(/\s+/).slice(1).join(' ').trim();
    if (!text) {
        return sock.sendMessage(chatId, { text: 'Please provide text after the $attp command.' }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '🎬 Generating animated sticker……' }, { quoted: message });
        const webpBuffer = await renderAnimatedText(text);
        const finalBuffer = await addMetadata(webpBuffer);
        await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });
    } catch (error) {
        console.error('[attp]', error);
        await sock.sendMessage(chatId, {
            text: 'Failed to generate the animated sticker. Please try shorter text.'
        }, { quoted: message });
    }
}

module.exports = attpCommand;
