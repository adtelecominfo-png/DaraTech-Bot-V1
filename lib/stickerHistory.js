'use strict';

const fs = require('fs');
const path = require('path');

// Keep a bounded per-chat history so $takeall can collect stickers without
// increasing the size of the general message store.
const MAX_STICKERS_PER_CHAT = 500;
const HISTORY_FILE = path.join(__dirname, '../data/takeall-stickers.json');
const histories = new Map();

function reviveBuffers(key, value) {
    if (value?.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data);
    }
    return value;
}

function loadHistory() {
    try {
        if (!fs.existsSync(HISTORY_FILE)) return;
        const saved = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'), reviveBuffers);
        for (const [chatId, messages] of Object.entries(saved || {})) {
            if (Array.isArray(messages) && messages.length) {
                histories.set(chatId, messages.slice(-MAX_STICKERS_PER_CHAT));
            }
        }
    } catch (error) {
        console.warn('[stickerHistory] Could not load saved history:', error.message);
    }
}

function saveHistory() {
    try {
        fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
        const data = Object.fromEntries(histories);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(data));
    } catch (error) {
        console.warn('[stickerHistory] Could not save history:', error.message);
    }
}

function unwrapMessage(message) {
    let current = message;
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

function recordStickerMessage(message) {
    const chatId = message?.key?.remoteJid;
    const stickerMessage = unwrapMessage(message?.message);
    const messageId = message?.key?.id;
    if (!chatId || !stickerMessage || !messageId) return false;

    const history = histories.get(chatId) || [];
    if (history.some(item => item.key?.id === messageId)) return false;

    history.push({
        key: message.key,
        message: message.message,
        messageTimestamp: message.messageTimestamp,
    });

    if (history.length > MAX_STICKERS_PER_CHAT) {
        history.splice(0, history.length - MAX_STICKERS_PER_CHAT);
    }
    histories.set(chatId, history);
    saveHistory();
    return true;
}

function getStickerHistory(chatId) {
    return [...(histories.get(chatId) || [])];
}

function clearStickerHistory(chatId) {
    histories.delete(chatId);
    saveHistory();
}

loadHistory();

module.exports = {
    recordStickerMessage,
    getStickerHistory,
    clearStickerHistory,
    MAX_STICKERS_PER_CHAT,
};