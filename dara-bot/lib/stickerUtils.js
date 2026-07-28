'use strict';
/**
 * lib/stickerUtils.js
 * Shared sticker buffer helpers used by stickercrop.js and igs.js.
 * Extracted here so neither command file has to import the other.
 */

const { exec }   = require('child_process');
const fs         = require('fs');
const path       = require('path');
const webp       = require('node-webpmux');
const crypto     = require('crypto');
const settings   = require('../settings');

/**
 * Convert a raw media buffer into a cropped-square sticker WebP.
 * Mirrors the pipeline inside stickercrop.js.
 *
 * @param {Buffer}  inputBuffer
 * @param {boolean} isAnimated
 * @returns {Promise<Buffer>}
 */
async function stickercropFromBuffer(inputBuffer, isAnimated) {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const tempInput  = path.join(tmpDir, `cropbuf_${Date.now()}`);
    const tempOutput = path.join(tmpDir, `cropbuf_out_${Date.now()}.webp`);

    fs.writeFileSync(tempInput, inputBuffer);

    const fileSizeKB  = inputBuffer.length / 1024;
    const isLargeFile = fileSizeKB > 5000;

    let ffmpegCommand;
    if (isAnimated) {
        if (isLargeFile) {
            ffmpegCommand = `ffmpeg -y -i "${tempInput}" -t 2 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=8" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 30 -compression_level 6 -b:v 100k -max_muxing_queue_size 1024 "${tempOutput}"`;
        } else {
            ffmpegCommand = `ffmpeg -y -i "${tempInput}" -t 3 -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,fps=12" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 50 -compression_level 6 -b:v 150k -max_muxing_queue_size 1024 "${tempOutput}"`;
        }
    } else {
        ffmpegCommand = `ffmpeg -y -i "${tempInput}" -vf "crop=min(iw\\,ih):min(iw\\,ih),scale=512:512,format=rgba" -c:v libwebp -preset default -loop 0 -vsync 0 -pix_fmt yuva420p -quality 75 -compression_level 6 "${tempOutput}"`;
    }

    await new Promise((resolve, reject) => {
        exec(ffmpegCommand, (error) => {
            if (error) return reject(error);
            resolve();
        });
    });

    const webpBuffer = fs.readFileSync(tempOutput);

    const img = new webp.Image();
    await img.load(webpBuffer);

    const json = {
        'sticker-pack-id':   crypto.randomBytes(32).toString('hex'),
        'sticker-pack-name': settings.packname || 'KnightBot',
        'emojis': ['✂️'],
    };
    const exifAttr  = Buffer.from([0x49,0x49,0x2A,0x00,0x08,0x00,0x00,0x00,0x01,0x00,0x41,0x57,0x07,0x00,0x00,0x00,0x00,0x00,0x16,0x00,0x00,0x00]);
    const jsonBuffer = Buffer.from(JSON.stringify(json), 'utf8');
    const exif      = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    img.exif = exif;

    const finalBuffer = await img.save(null);

    try { fs.unlinkSync(tempInput);  } catch {}
    try { fs.unlinkSync(tempOutput); } catch {}

    return finalBuffer;
}

module.exports = { stickercropFromBuffer };
