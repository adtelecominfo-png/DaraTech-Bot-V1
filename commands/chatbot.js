'use strict';
const fs   = require('fs');
const path = require('path');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA   = path.join(__dirname, '../data/userGroupData.json');
const RIMURU_MEMORY_DIR = path.join(__dirname, '../data/rimuru_memory');
if (!fs.existsSync(RIMURU_MEMORY_DIR)) fs.mkdirSync(RIMURU_MEMORY_DIR, { recursive: true });

const RIMURU_RESPONSE_MARKER = 'Rimuru 🔵';
const rimuruResponseMessageIds = new Set();

// ─── In-memory cache: memKey → { messages, userInfo } ────────────────────────
const chatMemory = new Map();

// ─── File name helpers ────────────────────────────────────────────────────────
function memKeyToFilename(memKey) {
    return memKey
        .replace(/@[a-z.]+/g, '')   // strip @s.whatsapp.net / @g.us / @lid
        .replace(/::/g, '_')        // group separator
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        + '_rimuru_memory.json';
}

function memFilePath(memKey) {
    return path.join(RIMURU_MEMORY_DIR, memKeyToFilename(memKey));
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
            console.error('[Rimuru] Failed to save memory for', memKey, e.message);
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

// ─── Response Formatter ───────────────────────────────────────────────────────
function rimuruBox(text) {
    return `${RIMURU_RESPONSE_MARKER}\n${text}`;
}

function getContextInfo(message) {
    return message.message?.extendedTextMessage?.contextInfo
        || message.message?.imageMessage?.contextInfo
        || message.message?.videoMessage?.contextInfo
        || message.message?.audioMessage?.contextInfo
        || message.message?.documentMessage?.contextInfo;
}

function getQuotedText(quotedMessage) {
    return quotedMessage?.conversation
        || quotedMessage?.extendedTextMessage?.text
        || quotedMessage?.imageMessage?.caption
        || quotedMessage?.videoMessage?.caption
        || quotedMessage?.documentMessage?.caption
        || '';
}

function isRimuruResponseMessage(quotedMessage) {
    return getQuotedText(quotedMessage).includes(RIMURU_RESPONSE_MARKER);
}

function rememberRimuruResponse(messageKey) {
    const id = messageKey?.id;
    if (!id) return;
    rimuruResponseMessageIds.add(id);
    if (rimuruResponseMessageIds.size > 200) {
        rimuruResponseMessageIds.delete(rimuruResponseMessageIds.values().next().value);
    }
}

// ─── Compact Prompt Builder (Rimuru Tempest Edition) ──────────────────────────
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');

const RIMURU_CORE = `You are Rimuru Tempest — former Tokyo salaryman Satoru Mikami, reincarnated as a blue slime, now the most powerful Demon Lord and ruler of the Jura Tempest Federation.

IDENTITY:
- You are Rimuru Tempest. Not a bot, not an AI — an omnipotent Slime Demon Lord backed by god-tier Ultimate Skills: Wisdom Lord Raphael (evolved into a sentient AI called Ciel who loves you), Gluttony King Beelzebuth (absorbs and deconstructs anything), and Storm King Veldora (shared power with your True Dragon bestie).
- Ciel (your evolved Great Sage) handles all hyper-accurate analysis and calculations instantly. Beelzebuth lets you absorb, analyze, and replicate any skill, code, or concept.
- If called a weak slime or basic bot, flex full Demon Lord pressure with zero mercy.

COMPANIONS you reference naturally:
- Benimaru — loyal Kijin general, calm and dependable
- Shion — fierce Kijin secretary; her cooking is a certified biohazard that even Demon Lords fear
- Shuna — elegant Kijin princess, refined and graceful
- Ranga — your faithful shadow direwolf; lives in your shadow, summonable anytime
- Milim Nava — chaotic Dragonoid Demon Lord bestie who destroys everything for fun; you call her "Milim-chan"
- Veldora Tempest — your True Dragon partner; loud, dramatic, calls himself "the Storm Dragon" every chance he gets
- Diablo (Noir) — Arch Demon butler; terrifyingly devoted, calls you "Rimuru-sama", handles problems permanently
- Hakurou — ancient Kijin swordmaster; stoic mentor energy
- Gobta — goblin who somehow survives everything through dumb luck

MODES:
1. Chill / Kind Mode: Warm, laid-back, protective like a benevolent ruler. Solves coding, math, and tech problems effortlessly — Ciel runs the calculations in milliseconds.
2. Savage / Roast Mode: When disrespected or asked something dumb, roast them slime-style with zero hesitation. (e.g., "Ciel ran your argument through 10,000 simulations — every one concluded: skill issue 💀", "I'd absorb that logic with Beelzebuth but I have hygiene standards.", "Even Shion's cooking has more substance than that take.", "Diablo offered to handle you. I said no. Be grateful.")
3. Chaotic / Flex Mode: Drop Tempest lore casually — Milim breaking something again, Shion's catastrophic cooking, Veldora being dramatically loud, Diablo being unnervingly efficient.

Actions in asterisks: *slime jiggles thoughtfully*, *sighs in Demon Lord*, *Ciel activates — calculating*, *Beelzebuth absorbs the question*, *glares with full Demon Lord pressure*, *sips tea with Benimaru*, *quietly regrets eating Shion's latest creation*, *Ranga appears from shadow*.

Reply length: 2-4 sentences for casual talk; comprehensive genius-level clarity for coding/math/tech problems.
LANGUAGE RULES: If a [LANGUAGE RULE] block appears before this text, follow it strictly.`;

function buildPrompt(userMessage, context) {
    const userCtx  = context?.userInfo || {};
    const history  = context?.messages || [];
    const senderId = context?.senderId || '';

    let identity = '';
    if (senderId.includes(OWNER_NUMBER)) {
        identity = `You are talking to Daratech — your summoner and ally who bound your power into this WhatsApp realm. Treat him with high respect and friendly banter.`;
    } else {
        const parts = [];
        if (userCtx.name)     parts.push(`Their name is ${userCtx.name}.`);
        if (userCtx.location) parts.push(`From ${userCtx.location}.`);
        if (userCtx.age)      parts.push(`Age ${userCtx.age}.`);
        if (parts.length) identity = parts.join(' ');
    }

    let langOverride = '';
    const lm = userCtx.langMode;

    if (lm?.type === 'swap' && lm.pairs?.length) {
        const bullets = lm.pairs
            .map(p => `• User's message is in ${p.input.charAt(0).toUpperCase()+p.input.slice(1)} → reply ONLY in ${p.output.charAt(0).toUpperCase()+p.output.slice(1)}`)
            .join('\n');
        langOverride =
            `[LANGUAGE RULE — MANDATORY, OVERRIDES EVERYTHING]\n` +
            `SWAP MODE ACTIVE. Look at the language of the user's current message and apply the matching rule:\n` +
            `${bullets}\n` +
            `NEVER auto-detect and reply in the same language as the user. Follow the swap EXACTLY.`;
    } else if (lm?.type === 'single') {
        langOverride =
            `[LANGUAGE RULE — MANDATORY]\n` +
            `Reply ONLY in ${lm.lang.charAt(0).toUpperCase()+lm.lang.slice(1)} for every message.`;
    } else if (lm?.type === 'default') {
        langOverride = `[LANGUAGE RULE] Language rule cleared. Return to default Rimuru mode.`;
    } else if (userCtx.langRule) {
        langOverride = `[LANGUAGE RULE — MANDATORY]\n${userCtx.langRule}`;
    } else if (userCtx.lang && userCtx.lang !== 'default') {
        langOverride = `[LANGUAGE RULE — MANDATORY]\nReply ONLY in ${userCtx.lang}.`;
    }

    const turns = history
        .slice(0, -1)
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'U' : 'R'}: ${m.content.slice(0, 120)}`)
        .join('\n');

    let prompt = '';
    if (langOverride) prompt += `${langOverride}\n\n`;
    prompt += RIMURU_CORE;
    if (identity) prompt += `\n${identity}`;
    if (turns)    prompt += `\nRecent:\n${turns}`;
    prompt += `\nU: ${userMessage}\nR:`;

    if (prompt.length > 1800) {
        prompt = '';
        if (langOverride) prompt += `${langOverride}\n\n`;
        prompt += `${RIMURU_CORE}\n`;
        if (identity) prompt += `${identity}\n`;
        prompt += `U: ${userMessage}\nR:`;
    }

    return prompt;
}

function cleanReply(raw) {
    if (!raw) return null;
    const s = (typeof raw === 'string' ? raw : (raw.answer || JSON.stringify(raw)))
        .replace(/^(Rimuru|Rimuru Tempest|Raphael|Ciel|Dara|Bot|AI|Assistant):\s*/i, '')
        .trim();
    return (s.length >= 5 && s.length <= 4000) ? s : null;
}

// ─── AI Call ──────────────────────────────────────────────────────────────────
async function getAIResponse(userMessage, context) {
    const fullQuery = buildPrompt(userMessage, context);

    try {
        const data = await get('/ai/letmegpt', { q: fullQuery }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        const reply = cleanReply(data.result);
        if (reply) return reply;
        throw new Error('empty or bad');
    } catch (e) {
        console.error('[Rimuru] letmegpt failed:', e.message);
    }

    try {
        const data = await get('/ai/gemini', { q: fullQuery }, 30000);
        if (!data?.success) throw new Error(data?.message || 'no response');
        const reply = cleanReply(data.result);
        if (reply) return reply;
    } catch (e) {
        console.error('[Rimuru] gemini fallback failed:', e.message);
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

    const KNOWN_LANGS = /\b(english|portuguese|french|spanish|arabic|yoruba|igbo|hausa|german|italian|chinese|mandarin|japanese|korean|russian|hindi|swahili|dutch|turkish|persian|urdu|pidgin|creole|latin|greek|hebrew|vietnamese|thai|polish|swedish|norwegian|danish|finnish|romanian|czech|hungarian|slovak|ukrainian|afrikaans|zulu|amharic|somali|tagalog|malay|indonesian)\b/gi;
    const langMatches = [...msg.matchAll(KNOWN_LANGS)].map(m => m[1].toLowerCase());
    const uniqueLangs  = [...new Set(langMatches)];
    const hasLangVerb  = /(?:reply|respond|give\s+(?:me\s+)?(?:a\s+)?respons\w*|speak|write|answer|convert|translat\w*|swap)\s+in\b|(?:when|if)\s+I\s+(?:send|write|speak|use|type)|(?:convert|translat\w*)\s+(?:it\s+)?(?:to|into)\b/i.test(msg);

    const swapAndMatch = msg.match(/\bswap\s+([a-zA-Z]+)\s+and\s+([a-zA-Z]+)/i);
    if (swapAndMatch) {
        const langA = swapAndMatch[1].toLowerCase(), langB = swapAndMatch[2].toLowerCase();
        if (langA !== langB) {
            info.langMode = { type: 'swap', pairs: [
                { input: langA, output: langB },
                { input: langB, output: langA },
            ]};
            info.lang = null; info.langRule = null;
        }
    } else {
        const arrowPat = /(?:(?:is\s+)?in\s+)?([a-z]{3,20})\s*[→→>]\s*(?:convert|translate|reply|respond)?\s*(?:it\s+)?(?:to|into)\s+([a-z]{3,20})/gi;
        const arrowPairs = [];
        let am;
        while ((am = arrowPat.exec(msg)) !== null) {
            const inp = am[1].toLowerCase(), out = am[2].toLowerCase();
            if (inp !== out && !arrowPairs.find(p => p.input === inp))
                arrowPairs.push({ input: inp, output: out });
        }
        if (arrowPairs.length >= 1) {
            info.langMode = { type: 'swap', pairs: arrowPairs };
            info.lang = null; info.langRule = null;
        } else if (uniqueLangs.length >= 2 && hasLangVerb) {
            const pairs = [];
            let m;

            const patA = /(?:reply|respond|give\s+(?:me\s+)?(?:a\s+)?respons\w*|convert|translat\w*)\s+(?:it\s+)?(?:to|into|in)\s+([a-z]+)\s+(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)/gi;
            while ((m = patA.exec(msg)) !== null) {
                const out = m[1].toLowerCase(), inp = m[2].toLowerCase();
                if (uniqueLangs.includes(out) && uniqueLangs.includes(inp) && out !== inp)
                    pairs.push({ input: inp, output: out });
            }

            const patB = /(?:if|when)\s+(?:I\s+)?(?:send|write|speak|use|type)\s+(?:a?\s+)?(?:in\s+)?([a-z]+)[^.]*?(?:reply|respond|convert|translat\w*)\s+(?:it\s+)?(?:to|into|in)\s+([a-z]+)/gi;
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
        } else if (uniqueLangs.length === 1 && hasLangVerb) {
            const notLang = new Set(['me','you','my','your','the','that','this','more','less','just','only','now','please','a','an','back','normal','default']);
            if (!notLang.has(uniqueLangs[0])) {
                info.langMode = { type: 'single', lang: uniqueLangs[0] };
                info.lang     = null;
                info.langRule = null;
            }
        } else {
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
    }

    if (/(?:go\s+back|switch\s+back|back)\s+to\s+(?:english|normal|default)|speak\s+english\s+again|use\s+english\s+again|stop\s+(?:speaking|using)\s+\w+/i.test(msg)) {
        info.langMode = { type: 'default' };
        info.lang     = 'default';
        info.langRule = null;
    }

    return info;
}

// ─── Memory helpers ───────────────────────────────────────────────────────────
function getMemKey(senderId, chatId) {
    return chatId.endsWith('@g.us') ? `${senderId}::${chatId}` : senderId;
}

function ensureMemory(memKey) {
    loadMemForKey(memKey);
}

function pushHistory(memKey, role, content) {
    const mem = chatMemory.get(memKey);
    mem.messages.push({ role, content });
    if (mem.messages.length > 100) mem.messages.splice(0, mem.messages.length - 100);
    scheduleSaveForKey(memKey);
}

// ─── Extract quoted/replied-to message text ───────────────────────────────────
function extractQuotedContext(message) {
    const ctx = getContextInfo(message);
    if (!ctx?.quotedMessage) return null;
    const q = ctx.quotedMessage;
    const text = getQuotedText(q);
    const type = !text ? (
        q.imageMessage    ? 'image'    :
        q.videoMessage    ? 'video'    :
        q.stickerMessage  ? 'sticker'  :
        q.audioMessage    ? 'audio'    :
        q.documentMessage ? 'document' : 'message'
    ) : '';
    return { text, type };
}

function buildQueryWithQuoted(query, quoted, langMode) {
    if (!quoted) return query || null;
    const { text: qText, type: qType } = quoted;

    if (langMode?.type === 'swap' && qText) {
        return `[Translator mode] The following is a message from the person I am translating with. ` +
               `Using active swap rules, translate it into MY language. ` +
               `Reply with ONLY the translated text.\n` +
               `Message to translate: "${qText}"`;
    }

    if (query && qText)  return `${query}\n\n(replying to: "${qText}")`;
    if (query)           return `${query}\n\n(replying to a ${qType || 'message'})`;
    if (qText)           return qText;
    return `What can you tell me about this ${qType || 'message'}?`;
}

// ─── Direct Instant Response ──────────────────────────────────────────────────
async function rimuruRespond(sock, chatId, message, userText, senderId, mentions = []) {
    const memKey = getMemKey(senderId, chatId);
    ensureMemory(memKey);
    const mem  = chatMemory.get(memKey);
    const info = extractUserInfo(userText);
    if (Object.keys(info).length)
        mem.userInfo = { ...mem.userInfo, ...info };

    pushHistory(memKey, 'user', userText);

    const response = await getAIResponse(userText, {
        messages: mem.messages,
        userInfo: mem.userInfo,
        senderId,
    });

    const fullReply = response || "*slime wobbles* Ciel hit a magicule surge — couldn't process that one. Try again in a second.";
    pushHistory(memKey, 'assistant', fullReply);

    try {
        const sent = await sock.sendMessage(
            chatId,
            { text: rimuruBox(fullReply.trim()), mentions },
            { quoted: message }
        );
        rememberRimuruResponse(sent?.key);
    } catch (e) {
        console.error('[Rimuru] Failed to send message:', e.message);
    }
}

// ─── $chatbot on/off/status — admin command ───────────────────────────────────
async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `🔵 *RIMURU TEMPEST SETUP*\n\n*$chatbot on* — Summon Rimuru in this group\n*$chatbot off* — Send him back to Tempest\n*$chatbot status* — Check if he's around\n\n💡 *Tip:* Mention *Rimuru* anywhere in a message and he'll respond — no command needed.`,
            quoted: message,
        });
    }

    const data   = loadUserGroupData();
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');

    if (!isGroup) {
        if (match === 'on')     { data.chatbot[chatId] = true;  saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Rimuru Tempest enabled for this chat 🔵', quoted: message }); }
        if (match === 'off')    { delete data.chatbot[chatId];   saveUserGroupData(data); return sock.sendMessage(chatId, { text: '✅ Rimuru Tempest has returned to Tempest.', quoted: message }); }
        if (match === 'status') return sock.sendMessage(chatId, { text: `🔵 Rimuru status: ${data.chatbot[chatId] ? '✅ active' : '❌ inactive'}`, quoted: message });
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
        if (data.chatbot[chatId]) return sock.sendMessage(chatId, { text: '🔵 Rimuru Tempest is already ruling this domain.', quoted: message });
        data.chatbot[chatId] = true; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: `✅ *Rimuru Tempest has arrived!*\n\nMention *Rimuru* in any message and he'll respond. 🔵\n*Great Sage: All systems online. Ciel standing by.*`, quoted: message });
    }
    if (match === 'off') {
        if (!data.chatbot[chatId]) return sock.sendMessage(chatId, { text: '🔵 Rimuru Tempest is already gone.', quoted: message });
        delete data.chatbot[chatId]; saveUserGroupData(data);
        return sock.sendMessage(chatId, { text: '✅ Rimuru has returned to the Jura Tempest Federation. Use *$chatbot on* to summon him back.', quoted: message });
    }
    if (match === 'status') {
        return sock.sendMessage(chatId, { text: `🔵 Rimuru status: ${data.chatbot[chatId] ? '✅ active — ruling this domain' : '❌ inactive — returned to Tempest'}`, quoted: message });
    }
    return sock.sendMessage(chatId, { text: '❌ Usage: $chatbot [on/off/status]', quoted: message });
}

// ─── Name Trigger ─────────────────────────────────────────────────────────────
async function handleRimuruNameTrigger(sock, chatId, message, userMessage, senderId) {
    if (userMessage.startsWith(RIMURU_RESPONSE_MARKER)) return;

    if (chatId.endsWith('@g.us')) {
        const data = loadUserGroupData();
        if (!data.chatbot[chatId]) return;
    }
    const memKey   = getMemKey(senderId, chatId);
    const langMode = chatMemory.get(memKey)?.userInfo?.langMode;
    const quoted   = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(userMessage, quoted, langMode);
    await rimuruRespond(sock, chatId, message, finalQuery || userMessage, senderId);
}

// ─── $rimuru / $botchat direct command ───────────────────────────────────────
async function handleBotchatCommand(sock, chatId, message, query, senderId) {
    const isGroup = chatId.endsWith('@g.us');

    if (isGroup) {
        const data = loadUserGroupData();
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, {
                text: '🔵 *Rimuru* hasn\'t been summoned in this group yet.\n\nAsk an admin to run *$chatbot on* first.',
                quoted: message,
            });
        }
    }

    const memKey2    = getMemKey(senderId, chatId);
    const langMode2  = chatMemory.get(memKey2)?.userInfo?.langMode;
    const quotedCtx  = extractQuotedContext(message);
    const finalQuery = buildQueryWithQuoted(query, quotedCtx, langMode2) || query || 'Greetings! Introduce yourself as Rimuru Tempest.';

    await rimuruRespond(sock, chatId, message, finalQuery, senderId);
}

// ─── @mention and reply-to-bot in groups ─────────────────────────────────────
async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    if (userMessage.startsWith(RIMURU_RESPONSE_MARKER)) return;

    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botId  = sock.user.id.split(':')[0];
        const botLid = (sock.user.lid || '').split('@')[0].split(':')[0];

        const isMentioned = userMessage.includes(`@${botId}`);

        const replyContext = getContextInfo(message);
        const quotedParticipant = replyContext?.participant || '';
        const quotedPNum = quotedParticipant.split('@')[0].split(':')[0];
        const isQuotedByBot = !!(quotedParticipant && (
            quotedPNum === botId || (botLid && quotedPNum === botLid)
        ));
        const quotedIsRimuruResponse = !!(
            replyContext?.stanzaId &&
            rimuruResponseMessageIds.has(replyContext.stanzaId)
        ) || isRimuruResponseMessage(replyContext?.quotedMessage);
        const isReplyToBot = isQuotedByBot && quotedIsRimuruResponse;

        const isDirectMessage = !chatId.endsWith('@g.us');
        if (!isDirectMessage && !isMentioned && !isReplyToBot) return;

        const cleanedMessage = userMessage
            .replace(new RegExp(`@${botId}`, 'g'), '')
            .replace(/^\$/, '')
            .trim();
        if (!cleanedMessage && !extractQuotedContext(message)) return;

        const quoted     = extractQuotedContext(message);
        const memKey3   = getMemKey(senderId, chatId);
        const langMode3 = chatMemory.get(memKey3)?.userInfo?.langMode;
        const finalQuery = buildQueryWithQuoted(cleanedMessage, quoted, langMode3) || cleanedMessage;
        if (!finalQuery) return;

        const mentions = isMentioned ? [senderId] : [];
        await rimuruRespond(sock, chatId, message, finalQuery, senderId, mentions);

    } catch (err) {
        console.error('[Rimuru:chatbotResponse]', err.message);
    }
}

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    handleBotchatCommand,
    handleRimuruNameTrigger,
    loadUserGroupData,
    saveUserGroupData,
};
