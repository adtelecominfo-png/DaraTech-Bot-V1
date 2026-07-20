'use strict';
/**
 * gifted-ai.js — GiftedTech AI endpoints
 *
 * All endpoints confirmed working against api.giftedtech.co.ke/api/ai/
 *
 * Text AI endpoints (return result string):
 *   letmegpt, unlimitedai, muslimai
 *   gemini (standalone Google Gemini)
 *   venice  (uncensored AI)
 *   pollinations (with models: openai, openai-fast, gpt-oss, gpt-oss-20b, ovh-reasoning)
 *   overchat models: claude, deepseek, gpt4, llama, mistral, gemini, grok, qwen, o1
 *
 * Image generation endpoints:
 *   fluximg  → result.url (Flux / Amazon S3)
 *   txt2img  → result.url (Sora/Aritek server)
 *   magicstudio → raw binary JPEG (arraybuffer)
 *
 * Utility:
 *   transcript → YouTube transcript (result string)
 */

const axios = require('axios');
const { get, buildUrl } = require('../lib/gifted');

// ─── Shared helpers ───────────────────────────────────────────────────────────

function extractQuery(message) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    return raw.trim().split(/\s+/).slice(1).join(' ').trim();
}

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

// ─── Generic GiftedTech text AI handler ──────────────────────────────────────

async function giftedTextReply(sock, chatId, message, endpoint, params, label) {
    const query = extractQuery(message);
    if (!query) {
        const usageCmd = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim().split(' ')[0] || '$ai';
        return sock.sendMessage(chatId,
            { text: `🤖 Usage: ${usageCmd} <your question>` },
            { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        const data = await get(`/ai/${endpoint}`, { q: query, ...params });
        if (!data?.success) throw new Error(data?.message || 'No response');
        // muslimai has result.answer; everything else has result as string
        const reply = typeof data.result === 'string'
            ? data.result
            : data.result?.answer || JSON.stringify(data.result);
        await sock.sendMessage(chatId, {
            text: `🤖 *${label}* · Daratech\n\n${reply.trim()}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error(`[gifted-ai:${endpoint}]`, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ *${label}* failed. Try again.\n\n_${err.message}_` },
            { quoted: message });
    }
}

// ─── Text AI commands ─────────────────────────────────────────────────────────

/** $letmegpt — LetMeGPT endpoint */
async function letmegptCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'letmegpt', {}, 'LetMeGPT');
}

/** $unlimitedai — UnlimitedAI endpoint */
async function unlimitedAiCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'unlimitedai', {}, 'UnlimitedAI');
}

/** $claude — Claude AI via overchat */
async function claudeCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'claude' }, 'Claude AI');
}

/** $deepseek — DeepSeek via overchat */
async function deepseekCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'deepseek' }, 'DeepSeek');
}

/** $gpt4 — GPT-4 via overchat */
async function gpt4Command(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'gpt4' }, 'GPT-4');
}

/** $llama — Meta LLaMA via overchat */
async function llamaCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'llama' }, 'LLaMA AI');
}

/** $mistralai — Mistral AI via overchat (gifted version) */
async function mistralAiCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'mistral' }, 'Mistral AI');
}

/** $geminioc — Google Gemini via overchat model */
async function geminiOcCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'gemini' }, 'Gemini (Overchat)');
}

/** $grok — Grok AI via overchat */
async function grokCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'grok' }, 'Grok AI');
}

/** $qwenai — Qwen AI via overchat (gifted version) */
async function qwenAiCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'qwen' }, 'Qwen AI');
}

/** $o1 — OpenAI O1 reasoning model via overchat */
async function o1Command(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'overchat', { model: 'o1' }, 'OpenAI O1');
}

// ─── Standalone Gifted AI endpoints ──────────────────────────────────────────

/** $gifgemini — Standalone Google Gemini via Gifted API */
async function gifGeminiCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'gemini', {}, 'Google Gemini');
}

/** $gifvenice — Venice AI (uncensored) via Gifted API */
async function gifVeniceCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'venice', {}, 'Venice AI (Uncensored)');
}

/** $gifpoll — Pollinations AI via Gifted API */
async function gifPollCommand(sock, chatId, message) {
    await giftedTextReply(sock, chatId, message, 'pollinations', {}, 'Pollinations AI');
}

/** $muslimai — Islamic AI (answers Quran/Islam questions) */
async function muslimAiCommand(sock, chatId, message) {
    const query = extractQuery(message);
    if (!query) {
        return sock.sendMessage(chatId, {
            text: '☪️ Usage: $muslimai <your Islamic question>\n_Ask about Quran, Hadith, Islamic rulings, and more._',
        }, { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        const data = await get('/ai/muslimai', { q: query });
        if (!data?.success) throw new Error(data?.message || 'No response');
        const answer = data.result?.answer || (typeof data.result === 'string' ? data.result : 'No answer returned.');
        await sock.sendMessage(chatId, {
            text: `☪️ *Muslim AI* · Daratech\n\n${answer.trim()}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ai:muslimai]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ Muslim AI failed. Try again.\n\n_${err.message}_` },
            { quoted: message });
    }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** $transcript — Get YouTube video transcript */
async function transcriptCommand(sock, chatId, message) {
    const url = extractQuery(message);
    if (!url || !/youtu(be\.com|\.be)/i.test(url)) {
        return sock.sendMessage(chatId, {
            text: '📝 Usage: $transcript <YouTube URL>\nExample: $transcript https://youtu.be/dQw4w9WgXcQ',
        }, { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: '📝 _Fetching transcript…_' }, { quoted: message });
        const data = await get('/ai/transcript', { url }, 35000);
        if (!data?.success || !data?.result) throw new Error(data?.message || 'No transcript found');
        const transcript = data.result.trim();
        // WhatsApp has a 65536 char limit per message
        if (transcript.length <= 60000) {
            await sock.sendMessage(chatId, {
                text: `📝 *YouTube Transcript*\n\n${transcript}\n\n_Daratech_ ⚡`,
            }, { quoted: message });
        } else {
            // Split into chunks
            const chunks = transcript.match(/.{1,59000}/gs);
            for (let i = 0; i < chunks.length; i++) {
                await sock.sendMessage(chatId, {
                    text: `📝 *Transcript (${i + 1}/${chunks.length})*\n\n${chunks[i]}`,
                }, { quoted: message });
            }
        }
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ai:transcript]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ Transcript fetch failed.\n\n_${err.message}_` },
            { quoted: message });
    }
}

// ─── Image generation ─────────────────────────────────────────────────────────

/** $giftflux — GiftedTech Flux image (result.url → Amazon S3) */
async function giftFluxCommand(sock, chatId, message) {
    const prompt = extractQuery(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '🎨 Usage: $giftflux <describe the image you want>\nExample: $giftflux anime girl with blue hair in a cherry blossom garden',
        }, { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: `🎨 _Generating Flux image…_` }, { quoted: message });
        const data = await get('/ai/fluximg', { prompt }, 40000);
        if (!data?.success || !data?.result?.url) throw new Error(data?.message || 'No image URL returned');
        await sock.sendMessage(chatId, {
            image:   { url: data.result.url },
            caption: `🎨 *${prompt}*\n\n_Flux · Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ai:fluximg]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ Flux image generation failed. Try again.\n\n_${err.message}_` },
            { quoted: message });
    }
}

/** $gifttxt2img — GiftedTech txt2img (result.url → Sora/Aritek server) */
async function giftTxt2ImgCommand(sock, chatId, message) {
    const prompt = extractQuery(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '🖼️ Usage: $gifttxt2img <describe the image you want>\nExample: $gifttxt2img futuristic city at night with neon lights',
        }, { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: `🖼️ _Generating image…_` }, { quoted: message });
        const data = await get('/ai/txt2img', { prompt }, 40000);
        if (!data?.success || !data?.result?.url) throw new Error(data?.message || 'No image URL returned');
        await sock.sendMessage(chatId, {
            image:   { url: data.result.url },
            caption: `🖼️ *${prompt}*\n\n_txt2img · Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ai:txt2img]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ Image generation failed. Try again.\n\n_${err.message}_` },
            { quoted: message });
    }
}

/** $magicstudio — MagicStudio AI (returns raw binary JPEG, no JSON wrapper) */
async function magicStudioCommand(sock, chatId, message) {
    const prompt = extractQuery(message);
    if (!prompt) {
        return sock.sendMessage(chatId, {
            text: '✨ Usage: $magicstudio <describe the image you want>\nExample: $magicstudio a majestic lion in golden armor',
        }, { quoted: message });
    }
    try {
        await react(sock, message, '⏳');
        await sock.sendMessage(chatId, { text: `✨ _MagicStudio generating…_` }, { quoted: message });
        // MagicStudio returns raw binary JPEG — fetch as arraybuffer
        const url = buildUrl('/ai/magicstudio', { prompt });
        const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 35000 });
        const buffer = Buffer.from(resp.data);
        if (buffer.length < 1000) throw new Error('Generated image too small — try a different prompt');
        await sock.sendMessage(chatId, {
            image:   buffer,
            mimetype: 'image/jpeg',
            caption: `✨ *${prompt}*\n\n_MagicStudio · Daratech_ ⚡`,
        }, { quoted: message });
        await react(sock, message, '✅');
    } catch (err) {
        console.error('[gifted-ai:magicstudio]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId,
            { text: `❌ MagicStudio failed. Try again.\n\n_${err.message}_` },
            { quoted: message });
    }
}

module.exports = {
    letmegptCommand,
    unlimitedAiCommand,
    claudeCommand,
    deepseekCommand,
    gpt4Command,
    llamaCommand,
    mistralAiCommand,
    geminiOcCommand,
    grokCommand,
    qwenAiCommand,
    o1Command,
    gifGeminiCommand,
    gifVeniceCommand,
    gifPollCommand,
    muslimAiCommand,
    transcriptCommand,
    giftFluxCommand,
    giftTxt2ImgCommand,
    magicStudioCommand,
};
