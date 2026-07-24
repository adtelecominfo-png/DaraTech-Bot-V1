'use strict';
const { get } = require('../lib/gifted');

// Maps command name → GiftedTech AI endpoint and optional model parameters.
const TEXT_MODELS = {
    ai:        { endpoint: 'pollinations', params: {} },
    ask:       { endpoint: 'pollinations', params: {} },
    chatbot:   { endpoint: 'pollinations', params: {} },
    gpt:       { endpoint: 'pollinations', params: { model: 'openai' } },
    gpt4o:     { endpoint: 'pollinations', params: { model: 'openai' } },
    gptlarge:  { endpoint: 'pollinations', params: { model: 'openai-large' } },
    gptfast:   { endpoint: 'pollinations', params: { model: 'openai-fast' } },
    gemini:    { endpoint: 'gemini', params: {} },
    mistral:   { endpoint: 'overchat', params: { model: 'mistral' } },
    qwen:      { endpoint: 'overchat', params: { model: 'qwen' } },
    venice:    { endpoint: 'venice', params: {} },
    overchat:  { endpoint: 'overchat', params: { model: 'gpt4' } },
};

const MODEL_NAMES = {
    ai:       'Gifted AI',
    ask:      'Gifted AI',
    chatbot:  'Gifted AI',
    gpt:      'GPT-4o',
    gpt4o:    'GPT-4o',
    gptlarge: 'GPT-4o Large',
    gptfast:  'GPT-4o Fast',
    gemini:   'Gemini',
    mistral:  'Mistral AI',
    qwen:     'Qwen AI',
    venice:   'Venice AI',
    overchat: 'Overchat AI',
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
            const endpoint = cmd === 'flux' || cmd === 'imagine' || cmd === 'dalle'
                ? 'fluximg'
                : 'txt2img';
            const data = await get(`/ai/${endpoint}`, { prompt: query }, 40000);
            const imgUrl = data?.result?.url || data?.result?.image || data?.url || data?.image;
            if (!data?.success || !imgUrl) {
                throw new Error(data?.message || 'No image URL returned');
            }
            await sock.sendMessage(chatId, {
                image: { url: imgUrl },
                caption: `🎨 *${query}*\n\n_Gifted AI · Daratech_ ⚡`,
            }, { quoted: message });
            await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
        } catch (err) {
            console.error('[ai:image]', err.message);
            await sock.sendMessage(chatId, { text: '❌ Image generation failed. Try again.' }, { quoted: message });
        }
        return;
    }

    // Text AI commands
    const config    = TEXT_MODELS[cmd] || TEXT_MODELS.ai;
    const modelName = MODEL_NAMES[cmd] || 'Gifted AI';

    if (!query) {
        return sock.sendMessage(chatId, { text: `🤖 Usage: $${cmd} <your question>` }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const data = await get(`/ai/${config.endpoint}`, { q: query, ...config.params });
        if (!data?.success) throw new Error(data?.message || 'No response');
        const response = typeof data.result === 'string'
            ? data.result
            : data.result?.answer || JSON.stringify(data.result);

        await sock.sendMessage(chatId, {
            text: `🤖 *${modelName}* · Gifted AI\n\n${response.trim()}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });
    } catch (err) {
        console.error(`[ai:${cmd}]`, err.message);
        await sock.sendMessage(chatId, { text: `❌ AI request failed. Try again.\n\n_${err.message}_` }, { quoted: message });
    }
}

module.exports = aiCommand;
