'use strict';
/**
 * imagegen-extra.js — Additional AI image generation commands
 * $animegen  — anime-style image
 * $artgen    — artistic/painting style image
 * $realgen   — photorealistic image
 * $vision    — analyze / describe an image with AI
 */

const { get }               = require('../lib/gifted');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const axios                 = require('axios');

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getPrompt(message, sliceWords = 1) {
    const raw = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(sliceWords).join(' ').trim();
}

/** Fetch image from URL as buffer */
async function urlToBuffer(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer', timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    return Buffer.from(res.data);
}

// ── $animegen ─────────────────────────────────────────────────────────────────
async function animegenCommand(sock, chatId, message) {
    const prompt = getPrompt(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '🎌 *ANIME GEN*\n\nUsage: *$animegen <prompt>*\n\nExample: $animegen a samurai girl in cherry blossoms\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        // Try GiftedTech anime imagegen
        let imgUrl = null;
        try {
            const data = await get('/imagegen/anime', { prompt }, 60000);
            imgUrl = data?.result?.image || data?.result?.url || data?.image || null;
        } catch { /* fallthrough */ }

        // Fallback: Pollinations anime model
        if (!imgUrl) {
            imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', anime style, vibrant colors, detailed')}&model=anime&width=768&height=768&nologo=true`;
        }

        const buf = await urlToBuffer(imgUrl);
        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            image:   buf,
            caption: `🎌 *ANIME GEN*\n\n_Prompt:_ ${prompt}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch (err) {
        console.error('[animegen]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Generation failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $artgen ───────────────────────────────────────────────────────────────────
async function artgenCommand(sock, chatId, message) {
    const prompt = getPrompt(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '🎨 *ART GEN*\n\nUsage: *$artgen <prompt>*\n\nExample: $artgen a surreal landscape oil painting\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        let imgUrl = null;
        try {
            const data = await get('/imagegen/art', { prompt }, 60000);
            imgUrl = data?.result?.image || data?.result?.url || data?.image || null;
        } catch { /* fallthrough */ }

        if (!imgUrl) {
            imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', masterpiece painting, artistic, detailed brushwork')}&model=flux&width=768&height=768&nologo=true`;
        }

        const buf = await urlToBuffer(imgUrl);
        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            image:   buf,
            caption: `🎨 *ART GEN*\n\n_Prompt:_ ${prompt}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch (err) {
        console.error('[artgen]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Generation failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $realgen ──────────────────────────────────────────────────────────────────
async function realgenCommand(sock, chatId, message) {
    const prompt = getPrompt(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '📷 *REAL GEN*\n\nUsage: *$realgen <prompt>*\n\nExample: $realgen a woman in Paris, golden hour photography\n\n_Daratech_ ⚡'
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        let imgUrl = null;
        try {
            const data = await get('/imagegen/real', { prompt }, 60000);
            imgUrl = data?.result?.image || data?.result?.url || data?.image || null;
        } catch { /* fallthrough */ }

        if (!imgUrl) {
            imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt + ', photorealistic, 8k, DSLR, sharp focus, professional photography')}&model=flux-realism&width=768&height=768&nologo=true`;
        }

        const buf = await urlToBuffer(imgUrl);
        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            image:   buf,
            caption: `📷 *REAL GEN*\n\n_Prompt:_ ${prompt}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch (err) {
        console.error('[realgen]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Generation failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $vision ───────────────────────────────────────────────────────────────────
async function visionCommand(sock, chatId, message) {
    const ctx    = message.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const rawText = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const question = rawText.trim().split(/\s+/).slice(1).join(' ').trim() || 'Describe this image in detail.';

    // Determine which message has the image
    let imgMsg = null;
    if (quoted?.imageMessage) {
        imgMsg = { key: { ...message.key, id: ctx.stanzaId }, message: quoted };
    } else if (message.message?.imageMessage) {
        imgMsg = message;
    }

    if (!imgMsg) {
        return sock.sendMessage(chatId, {
            text: `👁️ *VISION AI*\n\nReply to an *image* with *$vision* to analyze it.\n\nOptionally add a question:\n$vision what country is this?\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        const buf = await downloadMediaMessage(
            imgMsg, 'buffer', {},
            { reuploadRequest: sock.updateMediaMessage }
        );

        if (!buf || buf.length === 0) throw new Error('Failed to download image');

        const b64 = buf.toString('base64');
        const dataUri = `data:image/jpeg;base64,${b64}`;

        let result = null;

        // Method 1 — Pollinations OpenAI-compatible vision (POST, handles large images)
        try {
            const res = await axios.post('https://text.pollinations.ai/openai', {
                model: 'openai',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: dataUri } },
                        { type: 'text', text: question }
                    ]
                }]
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 60000
            });
            result = res.data?.choices?.[0]?.message?.content?.trim() || null;
        } catch { /* fallthrough */ }

        // Method 2 — GiftedTech vision via POST (avoids 414 URI Too Long)
        if (!result) {
            try {
                const { KEY } = require('../lib/gifted');
                const res = await axios.post(
                    `https://api.giftedtech.co.ke/api/ai/vision?apikey=${KEY}`,
                    { image: b64, q: question },
                    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
                );
                result = res.data?.result || res.data?.answer || res.data?.text || null;
            } catch { /* fallthrough */ }
        }

        if (!result) throw new Error('No response from vision AI');

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            text: `👁️ *VISION AI*\n\n${result.trim()}\n\n_Daratech_ ⚡`
        }, { quoted: message });

    } catch (err) {
        console.error('[vision]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ Vision analysis failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = { animegenCommand, artgenCommand, realgenCommand, visionCommand };
