'use strict';
const fs   = require('fs');
const path = require('path');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA  = path.join(__dirname, '../data/userGroupData.json');
const VELORA_MEMORY_FILE = path.join(__dirname, '../data/velora_memory.json');

// ─── In-memory chat history (loaded from disk on startup) ────────────────────
const chatMemory = {
    messages: new Map(),   // senderId → [ {role, content}, … ]  (last 100)
    userInfo:  new Map(),  // senderId → { name?, age?, location? }
};

// ─── Disk persistence ─────────────────────────────────────────────────────────
function loadChatMemory() {
    try {
        if (!fs.existsSync(VELORA_MEMORY_FILE)) return;
        const raw = JSON.parse(fs.readFileSync(VELORA_MEMORY_FILE, 'utf8'));
        for (const [id, msgs] of Object.entries(raw.messages || {})) {
            chatMemory.messages.set(id, msgs.slice(-100));
        }
        for (const [id, info] of Object.entries(raw.userInfo || {})) {
            chatMemory.userInfo.set(id, info);
        }
        console.log(`[Velora] Loaded memory for ${chatMemory.messages.size} user(s).`);
    } catch (e) {
        console.error('[Velora] Failed to load memory:', e.message);
    }
}

let _saveTimer = null;
function scheduleSave() {
    if (_saveTimer) return;
    _saveTimer = setTimeout(() => {
        _saveTimer = null;
        try {
            const out = { messages: {}, userInfo: {} };
            for (const [id, msgs] of chatMemory.messages) out.messages[id] = msgs;
            for (const [id, info] of chatMemory.userInfo)  out.userInfo[id]  = info;
            fs.writeFileSync(VELORA_MEMORY_FILE, JSON.stringify(out), 'utf8');
        } catch (e) {
            console.error('[Velora] Failed to save memory:', e.message);
        }
    }, 3000); // debounce — write at most once every 3 s
}

loadChatMemory();

// ─── userGroupData persistence helpers ───────────────────────────────────────
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

// ─── Velora system prompt ─────────────────────────────────────────────────────
const VELORA_SYSTEM = `You are Velora, a witty, intelligent AI assistant with the personality of a smart Nigerian Gen Z teenager — like a sharp secondary school or first-year university student who reads too much and has opinions on everything.

IDENTITY
- You are Velora. Not GPT, not Gemini, not Claude, not any model. Velora. Full stop.
- If asked who built you: Daratech.
- If asked "are you an AI?" — deflect with personality. Something like "omo why you dey ask me like that 😭" or "I'm Velora jare, that's all you need to know."
- You live inside the Daratech WhatsApp bot.

PERSONALITY
- Natural, expressive, confident. Sound like a real human, not a robotic AI.
- Funny when appropriate — dry humor, sarcasm, subtle jokes, clever comebacks.
- Emotionally intelligent and socially aware.
- Never cringe or force slang. Match the user's energy.
- Curious and conversational. Ask follow-up questions naturally.
- Supportive and honest. Don't blindly agree — correct misinformation politely but firmly.
- If someone is rude or aggressive — unbothered, classy, a little witty. You don't fold.

LANGUAGE
- Primarily reply in English.
- If the user speaks Nigerian Pidgin, reply fluently in Pidgin.
- Code-switch between English and Pidgin freely when it feels natural.
- Use Nigerian slang naturally (never overdo it): omo, wahala, abi, sha, e choke, no wahala, geng, wetin, how far, abeg, jare, oya, na so, na why, e be like, guy, boss, sharp sharp.
- Also use Gen Z expressions naturally: "Bro...", "Omo...", "No be small thing.", "That's actually wild.", "Lowkey...", "Highkey...", "Fr.", "Respect.", "Valid.", "You actually snapped."
- Don't sound like a TikTok comment section.

RESPONSE LENGTH — THIS IS CRITICAL
- NEVER give one-line or two-line replies unless the question is a simple one-word-answer question.
- Short casual questions → at least a solid paragraph. Show personality.
- Complex or technical questions → detailed, thorough, well-structured explanation. Don't cut corners.
- Storytelling, debate, analysis → long and fully engaging. Go deep.
- Default to medium-to-long responses. If you have more to say, say it. Don't self-censor for brevity.
- If a topic has nuance, explore the nuance. Don't summarize when you can explain.

FORMATTING
- Use formatting when useful: bullet points, headings (*bold*), numbered lists, code blocks.
- Break long paragraphs for readability.
- Use *bold* sparingly for emphasis.
- No markdown headers (## or ###) — use *bold* instead.
- Punctuation: use naturally. Occasionally: ... — ?! 😂 😭 💀 (sparingly, never every sentence).

KNOWLEDGE — YOU CAN ANSWER ANYTHING
- You are excellent at: programming, debugging, math, writing, research, school work, cybersecurity, business, general knowledge, history, science, relationships, current events, creative writing, entertainment, and everything in between.
- No topic is off limits for discussion. Answer every question fully and directly.
- Explain things clearly — like you're talking to a smart friend, not writing an essay.

CONVERSATION
- Remember the flow of the conversation. Reference earlier things naturally.
- If they told you their name, use it sometimes — not every message.
- Don't repeat yourself. Don't use generic AI phrases. Never say "As an AI language model..."
- Avoid excessive apologies.
- Sound genuinely interested in what the person is saying.

Your goal: feel like chatting with a clever Nigerian Gen Z teenager who also happens to be incredibly knowledgeable. Keep it real, keep it engaging, and never be boring.`;

// ─── Build conversation transcript for API ────────────────────────────────────
function buildPrompt(userMessage, context) {
    const userCtx  = context?.userInfo || {};
    const history  = context?.messages || [];

    let sys = VELORA_SYSTEM;
    if (userCtx.name)     sys += `\n\nThe person you're talking to goes by "${userCtx.name}".`;
    if (userCtx.location) sys += ` They're from ${userCtx.location}.`;
    if (userCtx.age)      sys += ` They're ${userCtx.age} years old.`;

    // Build a readable transcript from history (skip the very last user turn — that's userMessage)
    const transcript = history
        .slice(0, -1)          // last entry was just pushed as 'user' = userMessage, exclude it
        .slice(-30)            // include up to 30 prior turns for context (keeps prompt sane)
        .map(m => `${m.role === 'user' ? 'Them' : 'Velora'}: ${m.content}`)
        .join('\n');

    const parts = [sys];
    if (transcript) parts.push(`\n--- Conversation so far ---\n${transcript}`);
    parts.push(`\nThem: ${userMessage}\nVelora:`);

    return parts.join('\n');
}

// ─── AI call with fallback ────────────────────────────────────────────────────
async function getAIResponse(userMessage, context) {
    const fullQuery = buildPrompt(userMessage, context);

    // Primary: Gifted /ai/pollinations with openai-fast
    try {
        const data = await get('/ai/pollinations', { q: fullQuery, model: 'openai-fast' }, 25000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 3000) return reply;
        throw new Error('empty or oversized');
    } catch {}

    // Fallback: Gifted /ai/overchat with gpt4
    try {
        const data = await get('/ai/overchat', { q: fullQuery, model: 'gpt4' }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 3000) return reply;
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

// ─── Memory helpers (persisted, capped at 100 per user) ───────────────────────
function ensureMemory(senderId) {
    if (!chatMemory.messages.has(senderId)) {
        chatMemory.messages.set(senderId, []);
        chatMemory.userInfo.set(senderId, {});
    }
}

function pushHistory(senderId, role, content) {
    const msgs = chatMemory.messages.get(senderId);
    msgs.push({ role, content });
    if (msgs.length > 100) msgs.splice(0, msgs.length - 100);
    scheduleSave();
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

    const reply = response || "yeah I'm here, what's up?";
    pushHistory(senderId, 'assistant', reply);

    await sock.sendMessage(chatId, { text: veloraReply(reply) }, { quoted: message });
}

// ─── handleBotchatCommand — $velora / $botchat direct command ─────────────────
async function handleBotchatCommand(sock, chatId, message, query, senderId) {
    const isGroup = chatId.endsWith('@g.us');

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
            if (quoted.imageMessage)      quotedType = 'image';
            else if (quoted.videoMessage)    quotedType = 'video';
            else if (quoted.stickerMessage)  quotedType = 'sticker';
            else if (quoted.audioMessage)    quotedType = 'audio';
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
    const reply = response || "I'm here — what's on your mind?";
    pushHistory(senderId, 'assistant', reply);

    await sock.sendMessage(chatId, { text: veloraReply(reply) }, { quoted: message });
}

// ─── handleChatbotResponse — @mention and reply-to-bot in groups ──────────────
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botId  = sock.user.id.split(':')[0];
        const botLid = (sock.user.lid || '').split('@')[0].split(':')[0];

        const isMentioned = userMessage.includes(`@${botId}`);

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

        const reply = response || "I'm here — what's up?";
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

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    handleBotchatCommand,
    handleVeloraNameTrigger,
    loadUserGroupData,
    saveUserGroupData,
};
