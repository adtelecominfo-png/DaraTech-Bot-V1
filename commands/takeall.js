'use strict';

const crypto = require('crypto');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const webp = require('node-webpmux');
const settings = require('../settings');
const { getStickerHistory } = require('../lib/stickerHistory');

const DEFAULT_BATCH_SIZE = 30;
const LARGE_BATCH_SIZE = 60;
const SEND_DELAY_MS = 250;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function getStickerMessage(message) {
    let current = message?.message;
    for (let i = 0; i < 4 && current; i += 1) {
        if (current.stickerMessage) return current.stickerMessage;
        if (current.ephemeralMessage?.message) {
            current = current.ephemeralMessage.message;
            continue;
        }
        if (current.viewOnceMessage?.message) {
            current = current.viewOnceMessage.message;
            continue;
        }
        if (current.viewOnceMessageV2?.message) {
            current = current.viewOnceMessageV2.message;
            continue;
        }
        break;
    }
    return null;
}

async function addPackMetadata(stickerBuffer, packName, author, packId) {
    const image = new webp.Image();
    await image.load(stickerBuffer);

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const metadata = {
        'sticker-pack-id': packId,
        'sticker-pack-name': packName,
        'sticker-pack-publisher': author,
        emojis: ['📦'],
    };
    const jsonBuffer = Buffer.from(JSON.stringify(metadata), 'utf8');
    const exif = Buffer.concat([exifAttr, jsonBuffer]);
    exif.writeUIntLE(jsonBuffer.length, 14, 4);
    image.exif = exif;
    return image.save(null);
}

function parseBatchSize(message) {
    const text = (
        message?.message?.conversation ||
        message?.message?.extendedTextMessage?.text ||
        ''
    ).trim();
    const option = text.split(/\s+/)[1];

    if (!option) return null;
    const size = Number(option);
    return size === DEFAULT_BATCH_SIZE || size === LARGE_BATCH_SIZE ? size : undefined;
}

async function takeallCommand(sock, chatId, message) {
    const requestedBatchSize = parseBatchSize(message);
    if (requestedBatchSize === undefined) {
        return sock.sendMessage(chatId, {
            text: '❌ Use *$takeall*, *$takeall 30*, or *$takeall 60*.',
        }, { quoted: message });
    }

    const stickers = getStickerHistory(chatId);
    if (!stickers.length) {
        return sock.sendMessage(chatId, {
            text: '🖼️ I have not seen any stickers in this chat yet.',
        }, { quoted: message });
    }

    // Small collections use the normal 30-sticker pack size. Larger
    // collections use 60 per batch unless the user explicitly chooses 30.
    const batchSize = requestedBatchSize ||
        (stickers.length > DEFAULT_BATCH_SIZE ? LARGE_BATCH_SIZE : DEFAULT_BATCH_SIZE);
    const totalBatches = Math.ceil(stickers.length / batchSize);
    const author = settings.botOwner || settings.botName || 'Daratech';
    const basePackName = settings.packname || 'Daratech';

    await sock.sendMessage(chatId, {
        text: `📦 Found *${stickers.length}* stickers.\n` +
            `⏳ Sending ${totalBatches} pack${totalBatches === 1 ? '' : 's'} ` +
            `(${batchSize} per batch max)...`,
    }, { quoted: message });

    let totalSent = 0;
    let totalFailed = 0;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const batch = stickers.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
        const packName = totalBatches === 1
            ? `${basePackName} TakeAll`
            : `${basePackName} TakeAll ${batchIndex + 1}`;
        const packId = `daratech-takeall-${Date.now()}-${crypto.randomBytes(5).toString('hex')}-${batchIndex + 1}`;
        let batchSent = 0;

        for (const storedMessage of batch) {
            try {
                if (!getStickerMessage(storedMessage)) {
                    totalFailed += 1;
                    continue;
                }

                const stickerBuffer = await downloadMediaMessage(
                    storedMessage,
                    'buffer',
                    {},
                    {
                        logger: undefined,
                        reuploadRequest: sock.updateMediaMessage,
                    },
                );
                if (!stickerBuffer?.length) {
                    totalFailed += 1;
                    continue;
                }

                const packedSticker = await addPackMetadata(
                    stickerBuffer,
                    packName,
                    author,
                    packId,
                );
                await sock.sendMessage(chatId, { sticker: packedSticker }, { quoted: message });
                batchSent += 1;
                totalSent += 1;
                await sleep(SEND_DELAY_MS);
            } catch (error) {
                totalFailed += 1;
                console.error(`[takeall] Failed to process sticker: ${error.message}`);
            }
        }

        await sock.sendMessage(chatId, {
            text: `✅ Pack ${batchIndex + 1}/${totalBatches}: *${batchSent}* stickers sent.`,
        }, { quoted: message });
    }

    if (totalFailed) {
        await sock.sendMessage(chatId, {
            text: `ℹ️ Finished: *${totalSent}* sent, *${totalFailed}* could not be downloaded.`,
        }, { quoted: message });
    }
}

module.exports = takeallCommand;