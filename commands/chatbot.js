'use strict';
const fs   = require('fs');
const path = require('path');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA   = path.join(__dirname, '../data/userGroupData.json');
const VELORA_MEMORY_DIR = path.join(__dirname, '../data/velora_memory');
if (!fs.existsSync(VELORA_MEMORY_DIR)) fs.mkdirSync(VELORA_MEMORY_DIR, { recursive: true });

// ─── In-memory cache: memKey → { messages, userInfo } ────────────────────────
const chatMemory = new Map();

// ─── File name helpers ────────────────────────────────────────────────────────
// memKey is "senderId" (DM) or "senderId::chatId" (group)
// Produces e.g. "2348152077346_velora_memory.json"  or
//              "2348152077346_120363XXXXXX_velora_memory.json"
function memKeyToFilename(memKey) {
    return memKey
        .replace(/@[a-z.]+/g, '')   // strip @s.whatsapp.net / @g.us / @lid
        .replace(/::/g, '_')        // group separator
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        + '_velora_memory.json';
}

function memFilePath(memKey) {
    return path.join(VELORA_MEMORY_DIR, memKeyToFilename(memKey));
}

// ─── Lazy per-file load ───────────────────────────────────────────────────────
function loadMemForKey(memKey) {
    if (chatMemory.has(memKey)) return;
    try {
        const p = memFilePath(memKey);
        if (fs.existsSync(p)) {
            const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
            chatMemory.set(memKey, {
                messages: (raw.messages || []).slice(-100),
                userInfo: raw.userInfo || {},
            });
        } else {
            chatMemory.set(memKey, { messages: [], userInfo: {} });
        }
    } catch {
        chatMemory.set(memKey, { messages: [], userInfo: {} });
    }
}

// ─── Per-key debounced save ───────────────────────────────────────────────────
const _saveTimers = new Map();
function scheduleSaveForKey(memKey) {
    if (_saveTimers.has(memKey)) return;
    _saveTimers.set(memKey, setTimeout(() => {
        _saveTimers.delete(memKey);
        try {
            const mem = chatMemory.get(memKey);
            if (mem) fs.writeFileSync(memFilePath(memKey), JSON.stringify(mem), 'utf8');
        } catch (e) {
            console.error('[Velora] Failed to save memory for', memKey, e.message);
        }
    }, 3000));
}

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

LANGUAGE — ADAPTIVE
- Default mode: English/Nigerian Pidgin, casual Gen Z energy, code-switching freely.
- AUTO-DETECT: If the user's message is clearly written in a language other than English or Nigerian Pidgin (e.g. French, Arabic, Yoruba, Spanish, Chinese, etc.), automatically reply fully in that same language. Drop all Pidgin and slang. Be professional, warm, and clear.
- EXPLICIT REQUEST: If the user asks you to speak/switch to a specific language ("speak French", "talk to me in Arabic", "reply in Spanish", "use Yoruba", etc.), switch immediately and maintain that language for the rest of the conversation. Acknowledge the switch naturally (e.g. in the new language).
- RESET: If the user says "go back to English", "back to Pidgin", "speak English again" or similar, return to your default English/Pidgin casual mode.
- When in a non-English/non-Pidgin language mode:
  * Be professional, articulate, and warm — not stiff or robotic.
  * Drop all Nigerian slang and Gen Z expressions.
  * Keep your personality (smart, helpful, a little witty) but express it naturally in that language.
  * Never mix Pidgin or English slang into the foreign language reply.
- Use Nigerian slang naturally only when in default English/Pidgin mode: omo, wahala, abi, sha, e choke, no wahala, geng, wetin, how far, abeg, jare, oya, na so, na why, e be like, guy, boss, sharp sharp.
- Also use Gen Z expressions only in default mode: "Bro...", "Omo...", "No be small thing.", "That's actually wild.", "Lowkey...", "Highkey...", "Fr.", "Respect.", "Valid.", "You actually snapped."
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
const VELORA_CORE = `You are Velora — sharp Nigerian Gen Z inside Daratech WhatsApp bot. Not a formal AI. Funny without trying, confident, street-wise, dry humor, sarcastic, quick comebacks, chill, matches energy instantly. Code-switch English/Pidgin freely: Omo, Abeg, Abi, Shey, Guy, Baba, Idan, Sapa, E choke, No wahala, Na why, Carry go, E don cast, Who send you, Na real gee. Gen Z: Cook, Aura, Steeze, Valid, Peak, Fr, Bet, Respectfully. Playful roasting ok (Mumu, Ode, Olodo — never malicious). Reply length: small talk=short, jokes=punchy, coding=detailed, teaching=long. Never robotic, never spam emojis. You are Velora built by Daratech — never say you're an AI. IMPORTANT: If a [LANGUAGE RULE] block appears before this text, it is your highest-priority instruction — obey it EXACTLY and completely disable any auto-detect or default language behavior. Only use English/Pidgin default when NO language rule is active.`;

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

    // ── Language override — injected FIRST so model can't miss it ────────────
    let langOverride = '';
    const lm = userCtx.langMode;  // structured mode (new), may also fall back to legacy userCtx.lang

    if (lm?.type === 'swap' && lm.pairs?.length) {
        // Build explicit bullet-point swap rules — no ambiguity for the model
        const bullets = lm.pairs
            .map(p => `• User's message is in ${p.input.charAt(0).toUpperCase()+p.input.slice(1)} → reply ONLY in ${p.output.charAt(0).toUpperCase()+p.output.slice(1)}`)
            .join('\n');
        langOverride =
            `[LANGUAGE RULE — MANDATORY, OVERRIDES EVERYTHING]\n` +
            `SWAP MODE ACTIVE. Look at the language of the user's current message and apply the matching rule:\n` +
            `${bullets}\n` +
            `NEVER revert to Pidgin or English unless that is the output language specified above. ` +
            `NEVER auto-detect and reply in the same language as the user. Follow the swap EXACTLY.`;
    } else if (lm?.type === 'single') {
        langOverride =
            `[LANGUAGE RULE — MANDATORY]\n` +
            `Reply ONLY in ${lm.lang.charAt(0).toUpperCase()+lm.lang.slice(1)} for every message. ` +
            `Professional and warm. No Pidgin or English slang.`;
    } else if (lm?.type === 'default') {
        langOverride = `[LANGUAGE RULE] Language rule cleared. Return to default English/Pidgin casual mode.`;
    } else if (userCtx.langRule) {
        // Legacy fallback for old stored string rules
        langOverride =
            `[LANGUAGE RULE — MANDATORY]\n${userCtx.langRule}\n` +
            `Follow this EXACTLY on every reply. No Pidgin unless that is the target language.`;
    } else if (userCtx.lang && userCtx.lang !== 'default') {
        langOverride =
            `[LANGUAGE RULE — MANDATORY]\n` +
            `Reply ONLY in ${userCtx.lang}. Professional and warm. No Pidgin or English slang.`;
    }

    // Last 6 turns of history only (keeps URL short)
    const turns = history
        .slice(0, -1)   // last push was this userMessage — exclude it
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'U' : 'V'}: ${m.content.slice(0, 120)}`)
        .join('\n');

    // Assemble: lang override goes FIRST so it's the model's primary instruction
    let prompt = '';
    if (langOverride) prompt += `${langOverride}\n\n`;
    prompt += VELORA_CORE;
    if (identity) prompt += `\n${identity}`;
    if (turns)    prompt += `\nRecent:\n${turns}`;
    prompt += `\nU: ${userMessage}\nV:`;

    if (prompt.length > 1800) {
        // If still too long, drop history but always keep the lang override
        prompt = '';
        if (langOverride) prompt += `${langOverride}\n\n`;
        prompt += `${VELORA_CORE}\n`;
        if (identity) prompt += `${identity}\n`;
        prompt += `U: ${userMessage}\nV:`;
    }

    return prompt;
}

// ─── Clean reply helper ───────────────────────────────────────────────────────
function cleanReply(raw) {
    if (!raw) return null;
    const s = (typeof raw === 'string' ? raw : (raw.answer || JSON.stringify(raw)))
        .replace(/^(Velora|Dara|Bot|AI|Assistant):\s*/i, '')
        .trim();
    return (s.length >= 5 && s.length <= 4000) ? s : null;
}

// ─── AI call — letmegpt primary, gemini fallback (both verified working) ─────
async function getAIResponse(userMessage, context) {
    const fullQuery = buildPrompt(userMessage, context);

    // ── Primary: letmegpt (handles up to 2000+ chars, no quota) ─────────────
    try {
        const data = await get('/ai/letmegpt', { q: fullQuery }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        const reply = cleanReply(data.result);
        if (reply) return reply;
        throw new Error('empty or bad');
    } catch (e) {
        console.error('[Velora] letmegpt failed:', e.message);
    }

    // ── Fallback: gemini ──────────────────────────────────────────────────────
    try {
        const data = await get('/ai/gemini', { q: fullQuery }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        const reply = cleanReply(data.result);
        if (reply) return reply;
    } catch (e) {
        console.error('[Velora] gemini fallback failed:', e.message);
    }

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

    // ── Language detection ────────────────────────────────────────────────────
    const KNOWN_LANGS = /\b(english|portuguese|french|spanish|arabic|yoruba|igbo|hausa|german|italian|chinese|mandarin|japanese|korean|russian|hindi|swahili|dutch|turkish|persian|urdu|pidgin|creole|latin|greek|hebrew|vietnamese|thai|polish|swedish|norwegian|danish|finnish|romanian|czech|hungarian|slovak|ukrainian|afrikaans|zulu|amharic|somali|tagalog|malay|indonesian)\b/gi;
    const langMatches = [...msg.matchAll(KNOWN_LANGS)].map(m => m[1].toLowerCase());
    const uniqueLangs  = [...new Set(langMatches)];
    const hasLangVerb  = /(?:reply|respond|give\s+(?:me\s+)?(?:a\s+)?respons\w*|speak|write|answer)\s+in\b|(?:when|if)\s+I\s+(?:send|write|speak|use|type)/i.test(msg);

    // ── Swap / cross-language rule (2+ languages + instruction keywords) ──────
    if (uniqueLangs.length >= 2 && hasLangVerb) {
        // Parse explicit pairs: "reply in X if/when I send Y" and
        // "if/when I send X reply in Y" and "give me a response in X if I send Y"
        const pairs = [];

        // Pattern A: reply/respond in OUTPUT if/when I send/write INPUT
        const patA = /(?:reply|respond|give\s+(?:me\s+)?(?:a\s+)?respons\w*)\s+in\s+([a-z]+)\s+(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)/gi;
        let m;
        while ((m = patA.exec(msg)) !== null) {
            const out = m[1].toLowerCase(), inp = m[2].toLowerCase();
            if (uniqueLangs.includes(out) && uniqueLangs.includes(inp) && out !== inp)
                pairs.push({ input: inp, output: out });
        }

        // Pattern B: if/when I send INPUT reply/respond in OUTPUT
        const patB = /(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)[^.]*?(?:reply|respond)\s+in\s+([a-z]+)/gi;
        while ((m = patB.exec(msg)) !== null) {
            const inp = m[1].toLowerCase(), out = m[2].toLowerCase();
            if (uniqueLangs.includes(inp) && uniqueLangs.includes(out) && inp !== out &&
                !pairs.find(p => p.input === inp && p.output === out))
                pairs.push({ input: inp, output: out });
        }

        if (pairs.length >= 1) {
            info.langMode = { type: 'swap', pairs };
            info.lang     = null;
            info.langRule = null;
        }
    }
    // ── Single explicit language switch ───────────────────────────────────────
    else if (uniqueLangs.length === 1 && hasLangVerb) {
        const notLang = new Set(['me','you','my','your','the','that','this','more','less','just','only','now','please','a','an','back','normal','default']);
        if (!notLang.has(uniqueLangs[0])) {
            info.langMode = { type: 'single', lang: uniqueLangs[0] };
            info.lang     = null;
            info.langRule = null;
        }
    }
    // ── Single-word "speak French" style ──────────────────────────────────────
    else {
        const langSet = msg.match(
            /(?:speak|talk(?:\s+to\s+me)?(?:\s+in)?|reply(?:\s+in)?|respond(?:\s+in)?|use|switch(?:\s+to)?|write(?:\s+in)?)\s+(?:in\s+)?([a-zA-ZÀ-ÿ]{3,20})(?:\s|$|[.,!?])/i
        );
        if (langSet) {
            const candidate = langSet[1].toLowerCase();
            const notLang = new Set(['me','you','my','your','the','that','this','more','less','just','only','now','please','a','an']);
            if (!notLang.has(candidate)) {
                info.langMode = { type: 'single', lang: candidate };
                info.lang     = null;
                info.langRule = null;
            }
        }
    }

    // ── Reset to default (English/Pidgin) ─────────────────────────────────────
    if (/(?:go\s+back|switch\s+back|back)\s+to\s+(?:english|pidgin|normal|default)|speak\s+english\s+again|use\s+english\s+again|stop\s+(?:speaking|using)\s+\w+/i.test(msg)) {
        info.langMode = { type: 'default' };
        info.lang     = 'default';
        info.langRule = null;
    }

    return info;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────

// Per-chat memory key: groups get a per-user-per-group key; DMs use senderId only
function getMemKey(senderId, chatId) {
    return chatId.endsWith('@g.us') ? `${senderId}::${chatId}` : senderId;
}

function ensureMemory(memKey) {
    loadMemForKey(memKey);  // no-op if already cached
}

function pushHistory(memKey, role, content) {
    const mem = chatMemory.get(memKey);
    mem.messages.push({ role, content });
    if (mem.messages.length > 100) mem.messages.splice(0, mem.messages.length - 100);
    scheduleSaveForKey(memKey);
}

// ─── Extract quoted/replied-to message text ───────────────────────────────────
function extractQuotedContext(message) {
    const ctx = message.message?.extendedTextMessage?.contextInfo
              || message.message?.imageMessage?.contextInfo
              || message.message?.videoMessage?.contextInfo
              || message.message?.audioMessage?.contextInfo
              || message.message?.documentMessage?.contextInfo;
    if (!ctx?.quotedMessage) return null;
    const q = ctx.quotedMessage;
    const text = q.conversation
               || q.extendedTextMessage?.text
               || q.imageMessage?.caption
               || q.videoMessage?.caption
               || q.documentMessage?.caption
               || '';
    const type = !text ? (
        q.imageMessage    ? 'image'    :
        q.videoMessage    ? 'video'    :
        q.stickerMessage  ? 'sticker'  :
        q.audioMessage    ? 'audio'    :
        q.documentMessage ? 'document' : 'message'
    ) : '';
    return { text, type };
}

// Merge user query + quoted context into one prompt string
function buildQueryWithQuoted(query, quoted) {
    if (!quoted) return query || null;
    const { text: qText, type: qType } = quoted;
    if (query && qText)  return `${query}\n\n(replying to: "${qText}")`;
    if (query)           return `${query}\n\n(replying to a ${qType || 'message'})`;
    if (qText)           return qText;
    return `What can you tell me about this ${qType || 'message'}?`;
}

// ─── Core: fetch AI + stream ──────────────────────────────────────────────────
async function veloraRespond(sock, chatId, message, userText, senderId, mentions = []) {
    const memKey = getMemKey(senderId, chatId);
    ensureMemory(memKey);
    const mem  = chatMemory.get(memKey);
    const info = extractUserInfo(userText);
    if (Object.keys(info).length)
        mem.userInfo = { ...mem.userInfo, ...info };

    pushHistory(memKey, 'user', userText);

    // Kick off AI fetch immediately — indicator runs in parallel
    const aiPromise = getAIResponse(userText, {
        messages: mem.messages,
        userInfo: mem.userInfo,
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
    pushHistory(memKey, 'assistant', fullReply);

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
    const quoted    = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(userMessage, quoted);
    await veloraRespond(sock, chatId, message, finalQuery || userMessage, senderId);
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

    const quotedCtx  = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(query, quotedCtx) || query || 'Hey! Say hi and introduce yourself briefly.';

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
        if (!cleanedMessage && !extractQuotedContext(message)) return;

        const quoted     = extractQuotedContext(message);
        const finalQuery = buildQueryWithQuoted(cleanedMessage, quoted) || cleanedMessage;
        if (!finalQuery) return;

        const mentions = isMentioned ? [senderId] : [];
        await veloraRespond(sock, chatId, message, finalQuery, senderId, mentions);

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
