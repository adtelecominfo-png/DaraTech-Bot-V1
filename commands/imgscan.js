'use strict';

/**
 * commands/imgscan.js — AI Image Identification & Analysis
 *
 * Aliases: $identify, $imgscan, $scanimg
 *
 * Usage:
 *   Reply to an image with $identify
 *   OR send an image with caption $identify
 *   Optionally add a custom question: $identify what species of plant is this?
 */

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { KEY } = require('../lib/gifted');

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

/**
 * Upload an image buffer to uguu.se and return a public URL (fallback for URL-based Vision endpoints)
 */
async function uploadImage(buffer, mimetype = 'image/jpeg') {
    const ext = (mimetype || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const tmpDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const tmpPath = path.join(tmpDir, `imgscan_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, buffer);
    try {
        const form = new FormData();
        form.append('files[]', fs.createReadStream(tmpPath));
        const { data } = await axios.post('https://uguu.se/upload.php', form, {
            headers: { ...form.getHeaders(), 'User-Agent': 'Mozilla/5.0' },
            timeout: 25000,
        });
        const fileObj = data?.files?.[0];
        const url = typeof fileObj === 'string' ? fileObj : (fileObj?.url || fileObj?.url_full);
        if (!url || !url.startsWith('http')) throw new Error('uguu.se upload returned no URL');
        return url;
    } finally {
        setTimeout(() => { try { fs.unlinkSync(tmpPath); } catch {} }, 5000);
    }
}

async function imgscanCommand(sock, chatId, message) {
    try {
        const ctx    = message.message?.extendedTextMessage?.contextInfo;
        const quoted = ctx?.quotedMessage;

        const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const customPrompt = rawText.trim().split(/\s+/).slice(1).join(' ').trim();
        const prompt = customPrompt || 'Identify and describe in detail what is shown in this image, including objects, text, species, brands, or landmarks.';

        // Decide which message contains the image
        let dlMsg = null;
        let mimetype = 'image/jpeg';

        if (quoted?.imageMessage) {
            dlMsg = { key: { ...message.key, id: ctx.stanzaId }, message: quoted };
            mimetype = quoted.imageMessage.mimetype || mimetype;
        } else if (message.message?.imageMessage) {
            dlMsg = message;
            mimetype = message.message.imageMessage.mimetype || mimetype;
        }

        if (!dlMsg) {
            return sock.sendMessage(chatId, {
                text: '🔍 *IMAGE IDENTIFIER*\n\nUsage:\n• Reply to an image with *$identify*\n• Send an image with caption *$identify*\n\nExample:\n• *$identify what breed of dog is this?*\n\n_Daratech_ ⚡',
            }, { quoted: message });
        }

        await react(sock, message, '⏳');

        // Download image buffer
        const buffer = await downloadMediaMessage(
            dlMsg, 'buffer', {},
            { reuploadRequest: sock.updateMediaMessage }
        );
        if (!buffer || buffer.length === 0) throw new Error('Media download returned empty buffer');

        const b64 = buffer.toString('base64');
        const dataUri = `data:${mimetype};base64,${b64}`;

        let resultText = null;

        // Method 1 — Pollinations OpenAI Vision via Base64 POST
        try {
            const res = await axios.post('https://text.pollinations.ai/openai', {
                model: 'openai',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: dataUri } },
                        { type: 'text', text: prompt }
                    ]
                }]
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 45000
            });
            resultText = res.data?.choices?.[0]?.message?.content?.trim() || null;
        } catch (e1) {
            console.log('[imgscan] Method 1 (Pollinations Base64) failed:', e1.message);
        }

        // Method 2 — GiftedTech Vision API POST (Base64)
        if (!resultText) {
            try {
                const res = await axios.post(
                    `https://api.gifted.co.ke/api/ai/vision?apikey=${KEY}`,
                    { image: b64, q: prompt },
                    { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
                );
                resultText = res.data?.result || res.data?.answer || res.data?.text || null;
            } catch (e2) {
                console.log('[imgscan] Method 2 (Gifted Vision) failed:', e2.message);
            }
        }

        // Method 3 — Uguu Upload + Pollinations GET fallback
        if (!resultText) {
            try {
                const imageUrl = await uploadImage(buffer, mimetype);
                const encodedPrompt = encodeURIComponent(prompt);
                const encodedUrl    = encodeURIComponent(imageUrl);
                const res = await axios.get(`https://text.pollinations.ai/${encodedPrompt}?image=${encodedUrl}`, {
                    timeout: 45000
                });
                resultText = typeof res.data === 'string' ? res.data.trim() : null;
            } catch (e3) {
                console.log('[imgscan] Method 3 (Uguu + Pollinations GET) failed:', e3.message);
            }
        }

        if (!resultText) throw new Error('All Vision AI engines failed to analyze the image');

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            text: [
                '╭━═ 『 🔍 *IMAGE IDENTIFIED* 』 ═━╮',
                '│',
                `${resultText.trim()}`,
                '│',
                '╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯',
                '',
                '⚡ *Daratech Bot*',
            ].join('\n'),
        }, { quoted: message });

    } catch (err) {
        console.error('[imgscan]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *Image identification failed*\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = imgscanCommand;
