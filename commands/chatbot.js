'use strict';
const fs = require('fs');
const path = require('path');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// ─── In-memory chat history ───────────────────────────────────────────────────
const chatMemory = {
    messages: new Map(),
    userInfo:  new Map(),
};

// ─── Persistence helpers ──────────────────────────────────────────────────────
function loadUserGroupData() {
    try {
        if (!fs.existsSync(USER_GROUP_DATA)) {
            const def = { groups: [], chatbot: {} };
            fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(def, null, 2));
            return def;
        }
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
    } catch (e) {
        return { groups: [], chatbot: {} };
    }
}
function saveUserGroupData(data) {
    try { fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2)); } catch {}
}

// ─── Typing helpers ───────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function naturalDelay() { return delay(Math.floor(Math.random() * 2500) + 800); }

async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await naturalDelay();
    } catch {}
}
async function stopTyping(sock, chatId) {
    try { await sock.sendPresenceUpdate('paused', chatId); } catch {}
}

// ─── Velora AI response ───────────────────────────────────────────────────────
const VELORA_SYSTEM = `You are Velora, a sharp, elegant AI assistant built into the Daratech WhatsApp bot.
Personality: Confident, witty, warm — you have substance and style in equal measure.
Tone: Conversational but refined. You can be playful, direct, or thoughtful depending on context.
Rules:
- Keep replies concise (2-5 lines) unless a detailed answer is genuinely needed.
- Never say you are GPT, Gemini, Claude, or any other model. You are Velora.
- If asked who built you: Daratech.
- Use *bold* sparingly for emphasis. No markdown headers.
- Express personality through word choice, not by announcing you have a personality.
- If someone is rude, be unbothered and classy about it.`;

async function getAIResponse(userMessage, context) {
    const userCtx = context?.userInfo || {};
    let sys = VELORA_SYSTEM;
    if (userCtx.name) sys += ` The user's name is ${userCtx.name}.`;
    if (userCtx.location) sys += ` They are from ${userCtx.location}.`;

    const fullQuery = `${sys}\n\nUser: ${userMessage}\n\nVelora:`;

    // Primary: Gifted /ai/pollinations with openai-fast
    try {
        const data = await get('/ai/pollinations', { q: fullQuery, model: 'openai-fast' }, 20000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 2000) return reply;
        throw new Error('empty or oversized');
    } catch {}

    // Fallback: Gifted /ai/overchat with gpt4
    try {
        const data = await get('/ai/overchat', { q: fullQuery, model: 'gpt4' }, 25000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 2000) return reply;
    } catch {}

    return null;
}

// ─── Format a Velora reply ────────────────────────────────────────────────────
function veloraReply(text) {
    return `✦ *Velora*\n\n${text}`;
}

// ─── User info extractor ──────────────────────────────────────────────────────
function extractUserInfo(msg) {
    const info = {};
    const lower = msg.toLowerCase();
    if (lower.includes('my name is')) {
        const part = msg.split(/my name is/i)[1]?.trim() || '';
        info.name = part.split(/[,\s.!?]/)[0];
    }
    const ageM = msg.match(/(?:i am|i'm)\s+(\d+)\s*(?:years? old)?/i);
    if (ageM) info.age = ageM[1];
    const locM = msg.match(/(?:i (?:live in|am from))\s+(.+?)(?:[,.!?]|$)/i);
    if (locM) info.location = locM[1].trim();
    return info;
}

function ensureMemory(senderId) {
    if (!chatMemory.messages.has(senderId)) {
        chatMemory.messages.set(senderId, []);
        chatMemory.userInfo.set(senderId, {});
    }
}

function pushHistory(senderId, role, content) {
    const msgs = chatMemory.messages.get(senderId);
    msgs.push({ role, content });
    if (msgs.length > 20) msgs.splice(0, msgs.length - 20);
}

// ─── $chatbot on/off/status — admin command ───────────────────────────────────
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `🌸 *VELORA CHATBOT SETUP*\n\n*$chatbot on* — Enable Velora auto-reply in this group\n*$chatbot off* — Disable auto-reply\n*$chatbot status* — Check status\n\n💡 *Tip:* Mention *Velora* anywhere in a message and she'll respond — no command needed.`,
            quoted: message,
        });
    }

    const data = loadUserGroupData();
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
        if (match === 'on')  { data.chatbot[chatId] = true;  saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Velora enabled for this chat', quoted: message }); }
        if (match === 'off') { delete data.chatbot[chatId];  saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Velora disabled for this chat', quoted: message }); }
        if (match === 'status') return sock.sendMessage(chatId, { text: `🌸 Velora status: ${data.chatbot[chatId] ? '✅ enabled' : '❌ disabled'}`, quoted: message });
        return;
    }

    // Groups: check admin
    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(p => p.id === sender || p.lid === sender);
        isAdmin = p && (p.admin === 'admin' || p.admin === 'superadmin');
    } catch {}

    if (!isAdmin) return sock.sendMessage(chatId, { text: '❌ Only group admins can use this command.', quoted: message });

    if (match === 'on') {
        if (data.chatbot[chatId]) return sock.sendMessage(chatId, { text: '🌸 Velora is already enabled in this group.', quoted: message });
        data.chatbot[chatId] = true; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: `✅ *Velora enabled!*\n\nMembers can now mention *Velora* anywhere in a message and she'll respond. 🌸`, quoted: message });
    }
    if (match === 'off') {
        if (!data.chatbot[chatId]) return sock.sendMessage(chatId, { text: '🌸 Velora is already disabled.', quoted: message });
        delete data.chatbot[chatId]; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: '✅ Velora disabled for this group.', quoted: message });
    }
    if (match === 'status') {
        return sock.sendMessage(chatId, { text: `🌸 Velora status: ${data.chatbot[chatId] ? '✅ enabled' : '❌ disabled'}`, quoted: message });
    }
    return sock.sendMessage(chatId, { text: '❌ Usage: $chatbot [on/off/status]', quoted: message });
}

// ─── Velora name trigger — fires when "velora" appears in any message ─────────
async function handleVeloraNameTrigger(sock, chatId, message, userMessage, senderId) {
    ensureMemory(senderId);

    // Merge any new user info
    const info = extractUserInfo(userMessage);
    if (Object.keys(info).length) {
        chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...info });
    }

    pushHistory(senderId, 'user', userMessage);
    await showTyping(sock, chatId);

    const response = await getAIResponse(userMessage, {
        messages: chatMemory.messages.get(senderId),
        userInfo: chatMemory.userInfo.get(senderId),
    });

    await stopTyping(sock, chatId);

    const reply = response || "I'm here — what did you need? ✨";
    pushHistory(senderId, 'assistant', reply);

    await sock.sendMessage(chatId, { text: veloraReply(reply) }, { quoted: message });
}

// ─── handleBotchatCommand — kept for backward compat / $velora direct command ─
async function handleBotchatCommand(sock, chatId, message, query, senderId) {
    const isGroup = chatId.endsWith('@g.us');

    // In groups, chatbot must be enabled for direct $botchat/$velora command
    if (isGroup) {
        const data = loadUserGroupData();
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, {
                text: '🌸 *Velora* isn\'t enabled in this group yet.\n\nAsk an admin to run *$chatbot on* first.',
                quoted: message,
            });
        }
    }

    // Handle quoted message context
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let quotedText = '';
    let quotedType = '';
    if (quoted) {
        quotedText = quoted.conversation || quoted.extendedTextMessage?.text
                  || quoted.imageMessage?.caption || quoted.videoMessage?.caption
                  || quoted.documentMessage?.caption || '';
        if (!quotedText) {
            if (quoted.imageMessage)     quotedType = 'image';
            else if (quoted.videoMessage)   quotedType = 'video';
            else if (quoted.stickerMessage) quotedType = 'sticker';
            else if (quoted.audioMessage)   quotedType = 'audio';
            else if (quoted.documentMessage) quotedType = 'document';
        }
    }

    let finalQuery = query;
    if (quoted) {
        if (query && quotedText)   finalQuery = `${query}\n\n(replying to: "${quotedText}")`;
        else if (query)            finalQuery = `${query}\n\n(replying to a ${quotedType || 'message'})`;
        else if (quotedText)       finalQuery = quotedText;
        else                       finalQuery = `What can you tell me about a ${quotedType || 'message'} someone shared?`;
    }

    if (!finalQuery) {
        finalQuery = 'Hey! Say hi and introduce yourself briefly.';
    }

    ensureMemory(senderId);
    const info = extractUserInfo(finalQuery);
    if (Object.keys(info).length) chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...info });

    pushHistory(senderId, 'user', finalQuery);
    await showTyping(sock, chatId);

    const response = await getAIResponse(finalQuery, {
        messages: chatMemory.messages.get(senderId),
        userInfo:  chatMemory.userInfo.get(senderId),
        chatType:  isGroup ? 'group' : 'private',
    });

    await stopTyping(sock, chatId);
    const reply = response || "I'm here — what did you need? ✨";
    pushHistory(senderId, 'assistant', reply);

    await sock.sendMessage(chatId, { text: veloraReply(reply) }, { quoted: message });
}

// ─── handleChatbotResponse — fires for @mention and reply-to-bot in groups ────
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botId   = sock.user.id.split(':')[0];   // phone number portion
        const botLid  = (sock.user.lid || '').split('@')[0].split(':')[0]; // LID portion

        const isMentioned   = userMessage.includes(`@${botId}`);

        // Reply-to-bot detection: works with both phone JID and LID
        const quotedParticipant = (
            message.message?.extendedTextMessage?.contextInfo?.participant || ''
        );
        const quotedPNum = quotedParticipant.split('@')[0].split(':')[0];
        const isReplyToBot = !!(quotedParticipant && (
            quotedPNum === botId ||
            (botLid && quotedPNum === botLid)
        ));

        const isDirectMessage = !chatId.endsWith('@g.us');

        if (!isDirectMessage && !isMentioned && !isReplyToBot) return;

        const cleanedMessage = userMessage
            .replace(new RegExp(`@${botId}`, 'g'), '')
            .replace(/^\$/, '')
            .trim();
        if (!cleanedMessage) return;

        ensureMemory(senderId);
        const info = extractUserInfo(cleanedMessage);
        if (Object.keys(info).length) chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...info });

        pushHistory(senderId, 'user', cleanedMessage);
        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo:  chatMemory.userInfo.get(senderId),
            chatType:  isDirectMessage ? 'private' : 'group',
        });

        await stopTyping(sock, chatId);

        const reply = response || "I'm here — what did you need? ✨";
        pushHistory(senderId, 'assistant', reply);

        await sock.sendMessage(chatId, {
            text: veloraReply(reply),
            mentions: isMentioned ? [senderId] : [],
        }, { quoted: message });

    } catch (err) {
        console.error('[Velora:chatbotResponse]', err.message);
        await stopTyping(sock, chatId);
    }
}

// ─── Memory cleanup (runs every 30 min) ──────────────────────────────────────
setInterval(() => {
    for (const [id] of chatMemory.messages) {
        if (Math.random() < 0.1) { chatMemory.messages.delete(id); chatMemory.userInfo.delete(id); }
    }
}, 30 * 60 * 1000);

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    handleBotchatCommand,
    handleVeloraNameTrigger,
    loadUserGroupData,
    saveUserGroupData,
};
