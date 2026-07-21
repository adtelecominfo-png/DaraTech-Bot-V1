'use strict';
/**
 * aitools.js — Extra AI utility commands
 * $humanize  — make AI-sounding text sound natural/human
 * $summarize — summarize long text or quoted message
 * $rewrite   — rewrite text in a different style
 * $grammar   — fix grammar and spelling
 */

const { get } = require('../lib/gifted');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function react(sock, message, emoji) {
    try { await sock.sendMessage(message.key.remoteJid, { react: { text: emoji, key: message.key } }); } catch {}
}

function getInput(message, sliceWords = 1) {
    const raw = message.message?.conversation ||
                message.message?.extendedTextMessage?.text || '';
    const fromCmd = raw.trim().split(/\s+/).slice(sliceWords).join(' ').trim();

    // Also grab quoted text if present
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
        quoted?.conversation ||
        quoted?.extendedTextMessage?.text ||
        quoted?.imageMessage?.caption ||
        quoted?.videoMessage?.caption || '';

    return (quotedText ? quotedText + (fromCmd ? '\n\n' + fromCmd : '') : fromCmd).trim();
}

async function askGifted(endpoint, model, prompt) {
    const data = await get(`/ai/${endpoint}`, { q: prompt, model }, 60000);
    if (!data?.success) throw new Error(data?.message || data?.error || 'No response');
    return typeof data.result === 'string' ? data.result : (data.result?.answer || JSON.stringify(data.result));
}

async function aiToolReply(sock, chatId, message, systemPrompt, userText, label, emoji) {
    if (!userText) {
        const cmd = (message.message?.conversation || message.message?.extendedTextMessage?.text || '')
            .trim().split(' ')[0];
        return sock.sendMessage(chatId, {
            text: `${emoji} *${label.toUpperCase()}*\n\nUsage: *${cmd} <text>*\nor reply to a message with *${cmd}*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '⏳');

    try {
        const fullPrompt = `${systemPrompt}\n\nText:\n${userText}`;
        const reply = await askGifted('overchat', 'deepseek', fullPrompt);

        await react(sock, message, '✅');
        await sock.sendMessage(chatId, {
            text: `${emoji} *${label.toUpperCase()}*\n\n${reply.trim()}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch (err) {
        console.error(`[aitools:${label}]`, err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *${label}* failed.\n\n_${err.message}_\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

// ── $humanize ─────────────────────────────────────────────────────────────────
async function humanizeCommand(sock, chatId, message) {
    const text = getInput(message);
    await aiToolReply(
        sock, chatId, message,
        'Rewrite the following text to sound completely natural, human, and conversational. Remove all AI-sounding phrases, robotic structure, and overly formal language. Make it flow naturally as if written by a real person. Keep the original meaning intact.',
        text, 'Humanize', '🧑'
    );
}

// ── $summarize ────────────────────────────────────────────────────────────────
async function summarizeCommand(sock, chatId, message) {
    const text = getInput(message);
    await aiToolReply(
        sock, chatId, message,
        'Summarize the following text into clear, concise key points. Use bullet points where appropriate. Keep it brief but capture all important information.',
        text, 'Summarize', '📝'
    );
}

// ── $rewrite ──────────────────────────────────────────────────────────────────
async function rewriteCommand(sock, chatId, message) {
    const text = getInput(message);
    await aiToolReply(
        sock, chatId, message,
        'Rewrite the following text to make it clearer, more professional, and better structured. Improve the wording and flow while keeping the original meaning.',
        text, 'Rewrite', '✍️'
    );
}

// ── $grammar ──────────────────────────────────────────────────────────────────
async function grammarCommand(sock, chatId, message) {
    const text = getInput(message);
    await aiToolReply(
        sock, chatId, message,
        'Fix all grammar, spelling, and punctuation errors in the following text. Return only the corrected version with a brief note of major changes made.',
        text, 'Grammar Fix', '✏️'
    );
}

module.exports = { humanizeCommand, summarizeCommand, rewriteCommand, grammarCommand };
