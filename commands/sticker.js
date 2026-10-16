'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const webp = require('node-webpmux');
const settings = require('../settings');

function textOf(message) {
    return message?.conversation ||
        message?.extendedTextMessage?.text ||
        message?.imageMessage?.caption ||
        message?.videoMessage?.caption ||
        message?.documentMessage?.caption || '';
}

function getQuotedMessage(message) {
    return message?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
}

function extractUrl(text) {
    const match = String(text || '').match(/https?:\/\/[^\s<>]+/i);
    return match ? match[0].replace(/[),.!?]+$/, '') : null;
}

async function downloadUrl(url) {
    const response = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0', Accept: '*/*' }
    });
    if (!response.ok) throw new Error(`URL returned HTTP ${response.status}`);
    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get('content-type') || ''
    };
}

function runFfmpeg(input, args) {
    return new Promise((resolve, reject) => {
        const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
        const output = [];
        const errors = [];
        ff.stdout.on('data', chunk => output.push(chunk));
        ff.stderr.on('data', chunk => errors.push(chunk));
        ff.on('error', reject);
        ff.on('close', code => {
            if (code === 0 && output.length) return resolve(Buffer.concat(output));
            reject(new Error(Buffer.concat(errors).toString() || `ffmpeg exited with code ${code}`));
        });
        ff.stdin.on('error', () => {});
        ff.stdin.end(input);
    });
}

async function convertToWebp(input, animated) {
    const common = [
        '-i', 'pipe:0',
        '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000'
    ];
    if (animated) {
        // This FFmpeg build emits invalid multi-frame WebP for some video inputs.
        // Use the first frame so $sticker always produces a valid WhatsApp sticker.
        return runFfmpeg(input, [
            ...common, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '0',
            '-q:v', '55', '-compression_level', '6', '-f', 'webp', 'pipe:1'
        ]);
    }
    return runFfmpeg(input, [
        ...common, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '0',
        '-q:v', '75', '-compression_level', '6', '-f', 'webp', 'pipe:1'
    ]);
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
    const exifHeader = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00
    ]);
    const jsonBuffer = Buffer.from(JSON.stringify(json));
    const exif = Buffer.concat([exifHeader, jsonBuffer]);
    exif.writeUInt32LE(jsonBuffer.length, 14);
    image.exif = exif;
    return image.save(null);
}

async function stickerCommand(sock, chatId, message) {
    const quotedMessage = getQuotedMessage(message);
    const targetMessage = quotedMessage ? {
        key: {
            remoteJid: chatId,
            id: message.message?.extendedTextMessage?.contextInfo?.stanzaId,
            participant: message.message?.extendedTextMessage?.contextInfo?.participant
        },
        message: quotedMessage
    } : message;

    const mediaMessage = targetMessage.message?.imageMessage ||
        targetMessage.message?.videoMessage ||
        targetMessage.message?.documentMessage;
    const commandText = textOf(message.message);
    const quotedText = quotedMessage ? textOf(quotedMessage) : '';
    const url = extractUrl(quotedText) || extractUrl(commandText.replace(/^\$s(ticker)?\s*/i, ''));

    if (!mediaMessage && !url) {
        return sock.sendMessage(chatId, {
            text: 'Reply to an image/video or an image URL with $sticker.'
        }, { quoted: message });
    }

    let tempInput;
    try {
        let mediaBuffer;
        let contentType = '';
        if (mediaMessage) {
            mediaBuffer = await downloadMediaMessage(targetMessage, 'buffer', {}, {
                logger: undefined,
                reuploadRequest: sock.updateMediaMessage
            });
            contentType = mediaMessage.mimetype || '';
        } else {
            const downloaded = await downloadUrl(url);
            mediaBuffer = downloaded.buffer;
            contentType = downloaded.contentType;
        }
        if (!mediaBuffer?.length) throw new Error('Downloaded media is empty');

        const animated = /video|gif|webm/i.test(contentType) ||
            Boolean(mediaMessage?.seconds) || /\.(gif|mp4|webm|mov)(?:\?|$)/i.test(url || '');
        const tempDir = path.join(process.cwd(), 'tmp');
        fs.mkdirSync(tempDir, { recursive: true });
        tempInput = path.join(tempDir, `sticker-input-${process.pid}-${Date.now()}`);
        fs.writeFileSync(tempInput, mediaBuffer);

        let webpBuffer = await convertToWebp(mediaBuffer, animated);
        if (animated && webpBuffer.length > 900 * 1024) {
            webpBuffer = await runFfmpeg(mediaBuffer, [
                '-i', 'pipe:0', '-frames:v', '1',
                '-vf', 'scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=#00000000',
                '-c:v', 'libwebp', '-q:v', '35', '-compression_level', '6', '-f', 'webp', 'pipe:1'
            ]);
        }

        const finalBuffer = await addMetadata(webpBuffer);
        await sock.sendMessage(chatId, { sticker: finalBuffer }, { quoted: message });
    } catch (error) {
        console.error('[sticker]', error);
        await sock.sendMessage(chatId, {
            text: 'Failed to create sticker. Reply to a valid image/video or a working image URL and try again.'
        }, { quoted: message });
    } finally {
        if (tempInput) {
            try { fs.unlinkSync(tempInput); } catch {}
        }
    }
}

module.exports = stickerCommand;
