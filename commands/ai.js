'use strict';
const { callPollinationsAI, MODELS } = require('../lib/pollinations');
const { getImageUrl } = require('../lib/pollinations');

// Maps command name → Pollinations model key
const TEXT_MODELS = {
    ai:        'openai',
    ask:       'openai',
    chatbot:   'openai',
    gpt:       'openai',
    gpt4o:     'openai',
    gptlarge:  'large',
    gptfast:   'fast',
    gemini:    'gemini',
    mistral:   'mistral',
    qwen:      'qwen',
    venice:    'openai',
    overchat:  'openai',
};

const MODEL_NAMES = {
    openai: 'GPT-4o',
    large:  'GPT-4o Large',
    fast:   'GPT-4o Fast',
    gemini: 'Gemini',
    mistral:'Mistral AI',
    qwen:   'Qwen Coder',
};

async function aiCommand(sock, chatId, message, userMessage) {
    const rawText = userMessage || message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const parts = rawText.trim().split(' ');
    const cmd   = parts[0].replace('$', '').toLowerCase();
    const query = parts.slice(1).join(' ').trim();
    // Image generation commands
    const isImage = ['imagine', 'txt2img', 'text2img', 'flux', 'dalle', 'animegen', 'sora', 'veo3'].includes(cmd);
    if (isImage) {
        if (!query) {
            return sock.sendMessage(chatId, { text: `🎨 Usage: $${cmd} <describe the image you want>` }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
            const model = cmd === 'flux' || cmd === 'imagine' || cmd === 'dalle' ? 'flux' : 'turbo';
            const imgUrl = getImageUrl(query, model);
            await sock.sendMessage(chatId, {
                image: { url: imgUrl },
                caption: `🎨 *${query}*\n\n_Daratech_ ⚡`,
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } catch (err) {
            console.error('[ai:image]', err.message);
            await sock.sendMessage(chatId, { text: '❌ Image generation failed. Try again.' }, { quoted: message });
        }
        return;
    }

    // Text AI commands
    const modelKey  = TEXT_MODELS[cmd] || 'openai';
    const modelName = MODEL_NAMES[modelKey] || 'GPT-4o';
    const polModel  = MODELS[modelKey] || 'openai';

    if (!query) {
        return sock.sendMessage(chatId, { text: `🤖 Usage: $${cmd} <your question>` }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        let response;
        try {
            response = await callPollinationsAI(query, polModel);
        } catch (primaryErr) {
            // If the chosen model fails (404 / 429 / unavailable), fall back to the
            // reliable openai (GPT-4o) model so the user still gets an answer.
            const statusCode = primaryErr?.response?.status;
            if (polModel !== 'openai' && (statusCode === 404 || statusCode === 429 || statusCode >= 400)) {
                console.warn(`[ai:${cmd}] model '${polModel}' failed (${statusCode}), falling back to openai`);
                response = await callPollinationsAI(query, 'openai');
            } else {
                throw primaryErr;
            }
        }

        await sock.sendMessage(chatId, {
            text: `🤖 *${modelName}* · Daratech\n\n${response.trim()}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error(`[ai:${cmd}]`, err.message);
        await sock.sendMessage(chatId, { text: `❌ AI request failed. Try again.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = aiCommand;
