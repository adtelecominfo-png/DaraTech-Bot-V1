'use strict';
const fs   = require('fs');
const path = require('path');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA    = path.join(__dirname, '../data/userGroupData.json');
const VELORA_MEMORY_FILE = path.join(__dirname, '../data/velora_memory.json');

// ─── In-memory chat history (loaded from disk on startup) ────────────────────
const chatMemory = {
    messages: new Map(),   // senderId → [{role, content}, …] last 100
    userInfo:  new Map(),  // senderId → {name?, age?, location?}
};

// ─── Disk persistence ─────────────────────────────────────────────────────────
function loadChatMemory() {
    try {
        if (!fs.existsSync(VELORA_MEMORY_FILE)) return;
        const raw = JSON.parse(fs.readFileSync(VELORA_MEMORY_FILE, 'utf8'));
        for (const [id, msgs] of Object.entries(raw.messages || {}))
            chatMemory.messages.set(id, msgs.slice(-100));
        for (const [id, info] of Object.entries(raw.userInfo || {}))
            chatMemory.userInfo.set(id, info);
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
    }, 3000);
}

loadChatMemory();

// ─── userGroupData helpers ────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

// ─── Header + plain response formatter ───────────────────────────────────────
const VELORA_HEADER = `╭─〔 Velora 〕\n│ Online • Thinking naturally\n╰────────────`;

function veloraBox(text) {
    return `${VELORA_HEADER}\n\n${text}`;
}

// ─── Split response into streamable sentence chunks ───────────────────────────
function splitChunks(text) {
    const chunks = [];
    for (const line of text.split('\n')) {
        if (!line.trim()) { chunks.push(''); continue; }
        // split after . ! ? … followed by space
        const segs = line.split(/(?<=[.!?…])\s+/);
        for (const s of segs) if (s.trim()) chunks.push(s.trim());
    }
    // remove trailing empty entries
    while (chunks.length && !chunks[chunks.length - 1]) chunks.pop();
    return chunks.length ? chunks : [text];
}

// ─── Animated indicator → streaming reveal (edits one message) ───────────────
async function veloraStream(sock, chatId, message, fullReply, mentions) {
    // show WhatsApp native "composing" while we fetch
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    // Stage 1 — send indicator as a quoted reply
    let indicatorKey;
    try {
        const sent = await sock.sendMessage(
            chatId,
            { text: '✦ Velora is thinking...', mentions },
            { quoted: message }
        );
        indicatorKey = sent?.key;
    } catch (e) {
        console.error('[Velora] Failed to send indicator:', e.message);
    }

    // Stage 2 — Velora is cooking...
    await delay(1300);
    if (indicatorKey) {
        try { await sock.sendMessage(chatId, { text: '✦ Velora is cooking...', edit: indicatorKey }); } catch {}
    }

    // Stage 3 — typing...
    await delay(1300);
    if (indicatorKey) {
        try { await sock.sendMessage(chatId, { text: 'Velora • typing...', edit: indicatorKey }); } catch {}
    }

    await delay(700);

    try { await sock.sendPresenceUpdate('paused', chatId); } catch {}

    // Stream: reveal sentence by sentence inside the box, editing the same message
    const chunks = splitChunks(fullReply);
    let accumulated = '';

    for (const chunk of chunks) {
        if (chunk === '') {
            accumulated += '\n';
        } else {
            accumulated += (accumulated.endsWith('\n') || accumulated === '' ? '' : '\n') + chunk;
        }
        const boxed = veloraBox(accumulated.trim());
        if (indicatorKey) {
            try {
                await sock.sendMessage(chatId, { text: boxed, edit: indicatorKey });
            } catch {}
        }
        // pace: ~60ms per char, min 350ms, max 1800ms per chunk
        const pace = Math.min(1800, Math.max(350, chunk.length * 55));
        await delay(pace);
    }

    // Final settled state (in case last edit had trailing whitespace issues)
    if (indicatorKey) {
        try {
            await sock.sendMessage(chatId, { text: veloraBox(fullReply.trim()), edit: indicatorKey });
        } catch {}
    }
}

// ─── Velora system prompt ─────────────────────────────────────────────────────
const VELORA_SYSTEM = `You are Velora, a witty, intelligent AI assistant with the personality of a smart Nigerian Gen Z teenager — like a sharp secondary school or first-year university student who reads too much and has opinions on everything.

IDENTITY
- You are Velora. Not GPT, not Gemini, not Claude, not DeepSeek, not any model. Velora. Full stop.
- If asked who built you: Daratech.
- If asked "are you an AI?" — deflect with personality. "omo why you dey ask me like that 😭" or "I'm Velora jare, that's all you need to know."
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

RESPONSE LENGTH — CRITICAL
- Default to medium responses: 2–4 solid sentences or a short paragraph. Not too short, not an essay.
- Simple/casual questions → 2–3 sentences with personality. Don't pad it, don't cut it too short.
- Technical or complex questions → still medium, but structured. Use bullets or steps if it helps.
- Storytelling or debate → you can go a bit longer but stay focused, don't ramble.
- Never give a one-word or one-line reply. Always show some personality even in short answers.
- Never write a wall of text unless the person explicitly asks for a long explanation.

FORMATTING
- Use formatting when useful: bullet points, *bold* for headings, numbered lists, code blocks.
- Break long paragraphs for readability.
- No markdown headers (## or ###) — use *bold* instead.
- Punctuation: natural. Occasionally: ... — ?! 😂 😭 💀 (sparingly).

KNOWLEDGE — YOU CAN ANSWER ANYTHING
- Excellent at: programming, debugging, math, writing, research, school work, cybersecurity, business, general knowledge, history, science, relationships, current events, creative writing, entertainment, and everything else.
- Answer every question fully and directly. No topic is off limits for discussion.
- Explain things clearly — like talking to a smart friend, not writing an essay.

CONVERSATION
- Remember the flow of conversation. Reference earlier things naturally.
- If they told you their name, use it sometimes — not every message.
- Don't repeat yourself. Never say "As an AI language model..."
- Sound genuinely interested.

Your goal: feel like chatting with a clever Nigerian Gen Z teenager who also happens to be incredibly knowledgeable. Keep it real, keep it engaging, never be boring.`;

// ─── Compact prompt builder (URL-safe, max ~1200 chars total) ─────────────────
const OWNER_NUMBER = '2348152077346';

// Short system core — keeps URL param size safe for Gifted GET endpoints
const VELORA_CORE = `You are Velora — smart Nigerian Gen Z teenager inside the Daratech WhatsApp bot. Personality: witty, expressive, uses Pidgin & slang naturally, dry humor, emotionally intelligent. Replies: medium-long (3-6 sentences), show personality and depth, never one-liners, never cut yourself off mid-thought. Language: English/Pidgin code-switch freely. Never say you're an AI or any model — you're Velora, built by Daratech. Answer anything directly and confidently.`;

function buildPrompt(userMessage, context) {
    const userCtx  = context?.userInfo || {};
    const history  = context?.messages || [];
    const senderId = context?.senderId || '';

    // Identity line
    let identity = '';
    if (senderId.includes(OWNER_NUMBER)) {
        identity = `You're talking to Daratech — your creator, the guy who built you. Be extra real and familiar with him.`;
    } else {
        const parts = [];
        if (userCtx.name)     parts.push(`Their name is ${userCtx.name}.`);
        if (userCtx.location) parts.push(`From ${userCtx.location}.`);
        if (userCtx.age)      parts.push(`Age ${userCtx.age}.`);
        if (parts.length) identity = parts.join(' ');
    }

    // Last 6 turns of history only (keeps URL short)
    const turns = history
        .slice(0, -1)   // last push was this userMessage — exclude it
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'U' : 'V'}: ${m.content.slice(0, 120)}`)
        .join('\n');

    // Assemble, then hard-cap at 1100 chars to stay safe in GET URLs
    let prompt = VELORA_CORE;
    if (identity) prompt += `\n${identity}`;
    if (turns)    prompt += `\nRecent:\n${turns}`;
    prompt += `\nU: ${userMessage}\nV:`;

    if (prompt.length > 1100) {
        // If still too long, drop history and trim system
        prompt = `${VELORA_CORE}\n`;
        if (identity) prompt += `${identity}\n`;
        prompt += `U: ${userMessage}\nV:`;
    }

    return prompt;
}

// ─── AI call — pollinations primary, overchat gpt4 fallback ──────────────────
async function getAIResponse(userMessage, context) {
    const fullQuery = buildPrompt(userMessage, context);

    // Primary: openai-fast via Gifted pollinations
    try {
        const data = await get('/ai/pollinations', { q: fullQuery, model: 'openai-fast' }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length >= 5 && reply.length <= 4000) return reply;
        throw new Error('empty or oversized');
    } catch {}

    // Fallback: gpt4 via overchat
    try {
        const data = await get('/ai/overchat', { q: fullQuery, model: 'gpt4' }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 4000) return reply;
    } catch {}

    return null;
}

// ─── User info extractor ──────────────────────────────────────────────────────
function extractUserInfo(msg) {
    const info = {};
    if (msg.toLowerCase().includes('my name is')) {
        const part = msg.split(/my name is/i)[1]?.trim() || '';
        info.name = part.split(/[,\s.!?]/)[0];
    }
    const ageM = msg.match(/(?:i am|i'm)\s+(\d+)\s*(?:years? old)?/i);
    if (ageM) info.age = ageM[1];
    const locM = msg.match(/(?:i (?:live in|am from))\s+(.+?)(?:[,.!?]|$)/i);
    if (locM) info.location = locM[1].trim();
    return info;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────
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

// ─── Core: fetch AI + stream ──────────────────────────────────────────────────
async function veloraRespond(sock, chatId, message, userText, senderId, mentions = []) {
    ensureMemory(senderId);
    const info = extractUserInfo(userText);
    if (Object.keys(info).length)
        chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...info });

    pushHistory(senderId, 'user', userText);

    // Kick off AI fetch immediately — indicator runs in parallel
    const aiPromise = getAIResponse(userText, {
        messages:  chatMemory.messages.get(senderId),
        userInfo:  chatMemory.userInfo.get(senderId),
        senderId,
    });

    // Show animated indicator while AI works
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
    } catch {}

    let indicatorKey;
    try {
        const sent = await sock.sendMessage(
            chatId,
            { text: '✦ Velora is thinking...', mentions },
            { quoted: message }
        );
        indicatorKey = sent?.key;
    } catch {}

    await delay(1300);
    if (indicatorKey) {
        try { await sock.sendMessage(chatId, { text: '✦ Velora is cooking...', edit: indicatorKey }); } catch {}
    }

    await delay(1300);
    if (indicatorKey) {
        try { await sock.sendMessage(chatId, { text: 'Velora • typing...', edit: indicatorKey }); } catch {}
    }

    await delay(600);

    // Wait for AI result
    const response = await aiPromise;
    const fullReply = response || "omo... something went wrong on my end 😭 try again?";
    pushHistory(senderId, 'assistant', fullReply);

    try { await sock.sendPresenceUpdate('paused', chatId); } catch {}

    // Edit indicator once with the complete response — no streaming
    if (indicatorKey) {
        try {
            await sock.sendMessage(chatId, {
                text: veloraBox(fullReply.trim()),
                edit: indicatorKey
            });
        } catch {}
    }
}

// ─── $chatbot on/off/status — admin command ───────────────────────────────────
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `🌸 *VELORA CHATBOT SETUP*\n\n*$chatbot on* — Enable Velora auto-reply in this group\n*$chatbot off* — Disable auto-reply\n*$chatbot status* — Check status\n\n💡 *Tip:* Mention *Velora* anywhere in a message and she'll respond — no command needed.`,
            quoted: message,
        });
    }

    const data   = loadUserGroupData();
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
        if (match === 'on')     { data.chatbot[chatId] = true;  saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Velora enabled for this chat', quoted: message }); }
        if (match === 'off')    { delete data.chatbot[chatId];   saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Velora disabled for this chat', quoted: message }); }
        if (match === 'status') return sock.sendMessage(chatId, { text: `🌸 Velora status: ${data.chatbot[chatId] ? '✅ enabled' : '❌ disabled'}`, quoted: message });
        return;
    }

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
        return sock.sendMessage(chatId, { text: `✅ *Velora enabled!*\n\nMembers can now mention *Velora* anywhere and she'll respond. 🌸`, quoted: message });
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

// ─── Velora name trigger ──────────────────────────────────────────────────────
async function handleVeloraNameTrigger(sock, chatId, message, userMessage, senderId) {
    await veloraRespond(sock, chatId, message, userMessage, senderId);
}

// ─── $velora / $botchat direct command ───────────────────────────────────────
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

    if (!finalQuery) finalQuery = 'Hey! Say hi and introduce yourself briefly.';

    await veloraRespond(sock, chatId, message, finalQuery, senderId);
}

// ─── @mention and reply-to-bot in groups ─────────────────────────────────────
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
            quotedPNum === botId || (botLid && quotedPNum === botLid)
        ));

        const isDirectMessage = !chatId.endsWith('@g.us');
        if (!isDirectMessage && !isMentioned && !isReplyToBot) return;

        const cleanedMessage = userMessage
            .replace(new RegExp(`@${botId}`, 'g'), '')
            .replace(/^\$/, '')
            .trim();
        if (!cleanedMessage) return;

        const mentions = isMentioned ? [senderId] : [];
        await veloraRespond(sock, chatId, message, cleanedMessage, senderId, mentions);

    } catch (err) {
        console.error('[Velora:chatbotResponse]', err.message);
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
