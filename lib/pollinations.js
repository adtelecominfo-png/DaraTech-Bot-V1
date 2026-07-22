'use strict';
/**
 * lib/pollinations.js — Pollinations.ai helper
 * Free AI inference — no paid API key required.
 *
 * Text: https://text.pollinations.ai / https://gen.pollinations.ai/v1
 * Image: https://image.pollinations.ai/prompt/{prompt}
 */

const axios = require('axios');

const BASE     = 'https://text.pollinations.ai/openai';
const IMG_BASE = 'https://image.pollinations.ai/prompt';

const MODELS = {
    openai:    'openai',
    fast:      'openai-fast',
    large:     'openai-large',
    mistral:   'mistral',
    qwen:      'qwen-coder',
    gemini:    'gemini',
};

/**
 * Call Pollinations chat completions (single user message + optional system prompt)
 * @returns {Promise<string>} AI response text
 */
async function callPollinationsAI(message, model = 'openai', systemPrompt = null, maxTokens = 1000, temperature = 0.9) {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: message });

    const response = await axios.post(`${BASE}/chat/completions`, {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response content from Pollinations AI');
    return content;
}

/**
 * Call Pollinations with a full messages array (supports conversation history)
 * @param {Array<{role: string, content: string}>} messages - Full messages array
 * @returns {Promise<string>} AI response text
 */
async function callPollinationsChat(messages, model = 'openai', maxTokens = 1000, temperature = 0.9) {
    const response = await axios.post(`${BASE}/chat/completions`, {
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        stream: false,
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response content from Pollinations AI');
    return content;
}

/**
 * Generate an image via Pollinations image API
 * @returns {string} Direct image URL
 */
function getImageUrl(prompt, model = 'flux', width = 1024, height = 1024) {
    const encoded = encodeURIComponent(prompt);
    return `${IMG_BASE}/${encoded}?model=${model}&width=${width}&height=${height}&nologo=true`;
}

module.exports = { callPollinationsAI, callPollinationsChat, getImageUrl, MODELS, BASE, IMG_BASE };
