'use strict';
// imagine.js — delegates to ai.js image generation (Pollinations.ai, free)
const aiCommand = require('./ai');

async function imagineCommand(sock, chatId, message) {
    await aiCommand(sock, chatId, message, message.message?.conversation || message.message?.extendedTextMessage?.text || '');
}

module.exports = imagineCommand;
