'use strict';

/**
 * Lobby-based anime quiz.
 *
 * A room belongs to one group, accepts registered economy users for 60 seconds,
 * then runs 45-second multiple-choice rounds until somebody reaches 10 points.
 */

const { get } = require('../lib/gifted');
const {
    loadEconomyDB,
    saveEconomyDB,
    getEconomyUser,
    resolveEconomyJid,
    isOwner: isEconomyOwner,
} = require('./economy');

const LOBBY_MS = 60 * 1000;
const QUESTION_MS = 45 * 1000;
const WINNING_SCORE = 10;
const PRIZE_PER_PLAYER = 10000;
const MAX_PLAYERS = 100;

const sessionsByChat = new Map();
const sessionsByRoom = new Map();

function cleanRoomId(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isAnimeQuizRoom(chatId, roomInput) {
    const roomId = cleanRoomId(roomInput);
    const session = roomId ? sessionsByRoom.get(roomId) : null;
    return Boolean(session && session.chatId === chatId && session.state === 'lobby');
}

function makeRoomId() {
    let id;
    do {
        id = Math.random().toString(36).slice(2, 8).toUpperCase();
    } while (sessionsByRoom.has(id));
    return id;
}

function senderJid(message, fallback) {
    return message.key?.participant || message.key?.remoteJid || fallback || '';
}

function displayName(db, jid) {
    return db[jid]?.name || jid.split('@')[0].split(':')[0] || 'Unknown';
}

function mention(jid) {
    return `@${jid.split('@')[0].split(':')[0]}`;
}

function normalizeAnswer(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/^[\s"'“”‘’([{]*[a-d](?:\s*[.)\-:]|\s+)/i, '')
        .replace(/[.!?,;:]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function optionLetterIndex(value) {
    const match = String(value || '').trim().match(/^[("'“”‘’\[]*([a-d])\s*[.)\-:]?$/i);
    return match ? match[1].toUpperCase().charCodeAt(0) - 65 : -1;
}

function extractResult(data) {
    if (typeof data?.result === 'string') return data.result;
    if (typeof data?.result?.answer === 'string') return data.result.answer;
    return '';
}

function parseQuestion(raw) {
    if (!raw) return null;
    let text = raw.trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) text = text.slice(first, last + 1);

    let parsed;
    try { parsed = JSON.parse(text); } catch { return null; }

    const question = String(parsed.question || parsed.prompt || '').trim();
    const rawOptions = Array.isArray(parsed.options)
        ? parsed.options
        : [parsed.a, parsed.b, parsed.c, parsed.d];
    const options = rawOptions.map(option => {
        if (typeof option === 'string') return option.replace(/^[A-D]\s*[.)-]\s*/i, '').trim();
        return String(option?.text || option?.answer || '').trim();
    }).filter(Boolean);
    if (!question || options.length !== 4 || new Set(options.map(normalizeAnswer)).size !== 4) return null;

    let answerIndex = Number.isInteger(parsed.answerIndex)
        ? parsed.answerIndex
        : Number.isInteger(parsed.correctIndex)
            ? parsed.correctIndex
            : -1;
    const answer = parsed.answer ?? parsed.correctAnswer ?? parsed.correct ?? '';
    if (answerIndex < 0 && /^[A-D]$/i.test(String(answer).trim())) {
        answerIndex = String(answer).trim().toUpperCase().charCodeAt(0) - 65;
    }
    if (answerIndex < 0) {
        const normalized = normalizeAnswer(answer);
        answerIndex = options.findIndex(option => normalizeAnswer(option) === normalized);
    }
    if (answerIndex < 0 || answerIndex > 3) return null;

    return {
        question,
        options,
        answerIndex,
        answerText: options[answerIndex],
    };
}

async function generateQuestion(askedQuestions) {
    const avoidClause = askedQuestions && askedQuestions.size > 0
        ? ` Do NOT repeat or closely paraphrase any of these already-asked questions: ${[...askedQuestions].map(q => `"${q}"`).join('; ')}.`
        : '';
    const prompt = [
        'Create one medium-difficulty anime knowledge quiz question.',
        'Use well-known anime, manga, characters, powers, studios, creators, or story facts.',
        'Avoid obscure trivia, trick questions, ambiguous wording, and questions requiring current information.',
        avoidClause,
        'Return ONLY valid JSON with exactly this shape:',
        '{"question":"...","options":["...","...","...","..."],"answerIndex":0}',
        'answerIndex must be 0, 1, 2, or 3 and identify exactly one correct option.',
    ].filter(Boolean).join(' ');

    const endpoints = [
        { path: '/ai/gemini', params: { q: prompt } },
        { path: '/ai/letmegpt', params: { q: prompt } },
    ];
    for (const endpoint of endpoints) {
        try {
            const data = await get(endpoint.path, endpoint.params, 30000);
            const parsed = parseQuestion(extractResult(data));
            if (parsed) return parsed;
        } catch (error) {
            console.error(`[AnimeQuiz] question generation failed (${endpoint.path}):`, error.message);
        }
    }
    throw new Error('The quiz question service did not return a valid question.');
}

function isRegistered(db, jid) {
    const resolved = resolveEconomyJid(db, jid);
    return {
        jid: resolved,
        user: db[resolved] && getEconomyUser(db, resolved),
        registered: Boolean(db[resolved]?.registered || isEconomyOwner(jid)),
    };
}

function playerMentions(session) {
    return [...session.players];
}

function formatLobby(session, db) {
    const names = [...session.players]
        .map(jid => `• ${mention(jid)} — ${displayName(db, jid)}`)
        .join('\n');
    return (
        `🎌 ANIME QUIZ ROOM\n\n` +
        `🆔 Room ID: ${session.roomId}\n` +
        `👑 Host: ${mention(session.host)}\n` +
        `👥 Players: ${session.players.size}\n\n` +
        `${names || 'No players yet'}\n\n` +
        `⏳ Lobby closes in 1 minute.\n` +
        `Join with: $join ${session.roomId}\n` +
        `Leave with: $leaveroom ${session.roomId}`
    );
}

function optionText(question) {
    return question.options
        .map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`)
        .join('\n');
}

function clearSessionTimers(session) {
    if (session.lobbyTimer) clearTimeout(session.lobbyTimer);
    if (session.questionTimer) clearTimeout(session.questionTimer);
    if (session.nextTimer) clearTimeout(session.nextTimer);
    session.lobbyTimer = null;
    session.questionTimer = null;
    session.nextTimer = null;
}

function removeSession(session) {
    clearSessionTimers(session);
    sessionsByChat.delete(session.chatId);
    sessionsByRoom.delete(session.roomId);
}

async function send(sock, chatId, text, message, mentions) {
    return sock.sendMessage(chatId, {
        text,
        ...(mentions?.length ? { mentions } : {}),
    }, message ? { quoted: message } : undefined);
}

async function startQuestion(sock, session) {
    if (sessionsByChat.get(session.chatId) !== session || session.state === 'ended') return;
    session.state = 'loading';
    try {
        const question = await generateQuestion(session.askedQuestions);
        if (sessionsByChat.get(session.chatId) !== session || session.state === 'ended') return;

        session.askedQuestions.add(question.question);
        session.question = question;
        session.locked = new Set();
        session.state = 'question';
        session.questionNumber += 1;
        const round = session.questionNumber;

        await send(
            sock,
            session.chatId,
            `🎯 ANIME QUIZ — QUESTION ${round}\n\n` +
            `❓ ${question.question}\n\n${optionText(question)}\n\n` +
            `⏳ You have 45 seconds to answer.\n` +
            `Reply with the option letter or the answer.`,
            null,
            playerMentions(session),
        );

        session.questionTimer = setTimeout(() => {
            void finishQuestion(sock, session, round);
        }, QUESTION_MS);
    } catch (error) {
        console.error('[AnimeQuiz] Unable to start question:', error.message);
        await send(sock, session.chatId, '❌ I could not generate the next anime question, so this room has ended.');
        removeSession(session);
    }
}

async function finishQuestion(sock, session, round) {
    if (
        sessionsByChat.get(session.chatId) !== session ||
        session.state !== 'question' ||
        session.questionNumber !== round
    ) return;

    if (session.questionTimer) clearTimeout(session.questionTimer);
    session.questionTimer = null;
    session.state = 'resolving';

    await send(
        sock,
        session.chatId,
        `⏰ Time's up! Nobody got it.\n\n` +
        `✅ The answer was: ${session.question.answerText}\n\n` +
        `⏳ Wait for next question…`,
    );

    session.nextTimer = setTimeout(() => void startQuestion(sock, session), 2200);
}

function scoreRows(session, db) {
    return [...session.players]
        .sort((a, b) => (session.scores.get(b) || 0) - (session.scores.get(a) || 0))
        .map((jid, index) =>
            `  ${index + 1}. ${mention(jid)} — *${session.scores.get(jid) || 0} pts*`
        )
        .join('\n');
}

function payoutShares(count) {
    if (count === 1) return [1];
    if (count === 2) return [0.7, 0.3];
    return [0.5, 0.3, 0.2];
}

async function finishGame(sock, session, winnerJid) {
    if (session.state === 'ended') return;
    session.state = 'ended';
    clearSessionTimers(session);

    const db = loadEconomyDB();
    const ranked = [...session.players]
        .sort((a, b) => {
            const scoreDiff = (session.scores.get(b) || 0) - (session.scores.get(a) || 0);
            return scoreDiff || session.joinOrder.indexOf(a) - session.joinOrder.indexOf(b);
        });
    const prizePool = session.players.size * PRIZE_PER_PLAYER;
    const shares = payoutShares(ranked.length);
    const payouts = new Map();
    ranked.slice(0, shares.length).forEach((jid, index) => {
        const amount = Math.floor(prizePool * shares[index]);
        const resolved = resolveEconomyJid(db, jid);
        const user = getEconomyUser(db, resolved);
        user.wallet = (user.wallet || 0) + amount;
        user.totalEarned = (user.totalEarned || 0) + amount;
        payouts.set(jid, amount);
    });
    saveEconomyDB(db);

    const board = ranked.map(jid => {
        return `${mention(jid)} — ${session.scores.get(jid) || 0} pts`;
    }).join('\n');
    const winner = winnerJid || ranked[0];
    const winnerPrize = payouts.get(winner) || 0;

    await send(
        sock,
        session.chatId,
        `✅ CORRECT! 🎉\n\n` +
        `🏆 ${mention(winner)} WINS THE QUIZ! 🏆\n\n` +
        `💰 Prize: $${winnerPrize.toLocaleString()} added to your wallet!\n\n` +
        `📊 Final Scoreboard:\n\n${board}\n\n` +
        `Thanks for playing! Start a new game with $aquiz`,
        null,
        playerMentions(session),
    );
    removeSession(session);
}

async function startLobby(sock, session) {
    session.lobbyTimer = setTimeout(async () => {
        if (sessionsByChat.get(session.chatId) !== session || session.state !== 'lobby') return;
        if (session.players.size === 0) {
            await send(sock, session.chatId, '⌛ Anime quiz cancelled. Nobody joined the room.');
            removeSession(session);
            return;
        }
        await send(
            sock,
            session.chatId,
            `🎮 The anime quiz is starting!\n\n` +
            `👥 Players: ${session.players.size}\n` +
            `🏆 First to 10 points wins.\n\n` +
            `⏳ Preparing the first question…`,
            null,
            playerMentions(session),
        );
        await startQuestion(sock, session);
    }, LOBBY_MS);
}

async function openAnimeQuiz(sock, chatId, message, senderId) {
    if (!chatId.endsWith('@g.us')) {
        return send(sock, chatId, '❌ Anime Quiz can only be played in groups.', message);
    }

    const db = loadEconomyDB();
    const registration = isRegistered(db, senderId);
    if (!registration.registered) {
        return send(sock, chatId, '❌ You need to register with *$register <name>* before joining an anime quiz.', message);
    }
    if (sessionsByChat.has(chatId)) {
        const existing = sessionsByChat.get(chatId);
        return send(sock, chatId, `❌ A quiz room is already active: *${existing.roomId}*`, message);
    }

    const session = {
        chatId,
        roomId: makeRoomId(),
        host: registration.jid,
        players: new Set([registration.jid]),
        joinOrder: [registration.jid],
        scores: new Map([[registration.jid, 0]]),
        state: 'lobby',
        question: null,
        questionNumber: 0,
        locked: new Set(),
        askedQuestions: new Set(),
        lobbyTimer: null,
        questionTimer: null,
        nextTimer: null,
    };
    sessionsByChat.set(chatId, session);
    sessionsByRoom.set(session.roomId, session);
    await send(sock, chatId, formatLobby(session, db), message, playerMentions(session));
    await startLobby(sock, session);
}

async function joinAnimeQuiz(sock, chatId, message, senderId, roomInput) {
    if (!chatId.endsWith('@g.us')) return send(sock, chatId, '❌ Anime Quiz can only be played in groups.', message);
    const roomId = cleanRoomId(roomInput);
    const session = sessionsByRoom.get(roomId);
    if (!session || session.chatId !== chatId || session.state !== 'lobby') {
        return send(sock, chatId, '❌ That room is not open in this group.', message);
    }

    const db = loadEconomyDB();
    const registration = isRegistered(db, senderId);
    if (!registration.registered) {
        return send(sock, chatId, '❌ Register first with *$register <name>* to join the quiz.', message);
    }
    if (session.players.has(registration.jid)) {
        return send(sock, chatId, '✅ You are already in this quiz room.', message);
    }
    if (session.players.size >= MAX_PLAYERS) {
        return send(sock, chatId, '❌ This quiz room is full.', message);
    }

    session.players.add(registration.jid);
    session.joinOrder.push(registration.jid);
    session.scores.set(registration.jid, 0);
    await send(sock, chatId, `✅ ${mention(registration.jid)} joined room *${session.roomId}*.\n\n${formatLobby(session, db)}`, message, playerMentions(session));
}

async function leaveAnimeQuiz(sock, chatId, message, senderId, roomInput) {
    if (!chatId.endsWith('@g.us')) return send(sock, chatId, '❌ Anime Quiz can only be played in groups.', message);
    const roomId = cleanRoomId(roomInput);
    const session = sessionsByRoom.get(roomId);
    if (!session || session.chatId !== chatId || session.state !== 'lobby') {
        return send(sock, chatId, '❌ You can only leave an open lobby.', message);
    }
    const db = loadEconomyDB();
    const registration = isRegistered(db, senderId);
    if (!registration.registered || !session.players.has(registration.jid)) {
        return send(sock, chatId, '❌ You are not in that quiz room.', message);
    }
    if (registration.jid === session.host) {
        return send(sock, chatId, '❌ The room owner cannot leave the room. Use *$equiz* to end it.', message);
    }
    session.players.delete(registration.jid);
    session.scores.delete(registration.jid);
    session.joinOrder = session.joinOrder.filter(jid => jid !== registration.jid);
    await send(sock, chatId, `✅ ${mention(registration.jid)} left room *${session.roomId}*.`);
}

async function endAnimeQuiz(sock, chatId, message, senderId, roomInput) {
    if (!chatId.endsWith('@g.us')) return send(sock, chatId, '❌ Anime Quiz can only be played in groups.', message);
    const roomId = cleanRoomId(roomInput);
    const session = roomId ? sessionsByRoom.get(roomId) : sessionsByChat.get(chatId);
    if (!session || session.chatId !== chatId) return send(sock, chatId, '❌ No anime quiz room is active here.', message);

    const db = loadEconomyDB();
    const registration = isRegistered(db, senderId);
    if (registration.jid !== session.host) {
        return send(sock, chatId, '❌ Only the room owner can end this quiz.', message);
    }
    removeSession(session);
    await send(sock, chatId, '🛑 *Anime quiz ended by the room owner.*', message);
}

async function handleAnimeQuizAnswer(sock, chatId, message, senderId, answer) {
    const session = sessionsByChat.get(chatId);
    if (!session || session.state !== 'question') return false;

    const db = loadEconomyDB();
    const registration = isRegistered(db, senderId);
    if (!registration.registered || !session.players.has(registration.jid)) return false;
    if (session.locked.has(registration.jid)) return true;

    const input = normalizeAnswer(answer);
    const optionIndex = session.question.options.findIndex(option => normalizeAnswer(option) === input);
    const letterIndex = optionLetterIndex(answer);
    const isCorrect = optionIndex === session.question.answerIndex || letterIndex === session.question.answerIndex;

    if (!isCorrect) {
        session.locked.add(registration.jid);
        await send(
            sock,
            chatId,
            `❌ Wrong answer, ${mention(registration.jid)}! 🔒 You are locked out for this question. Wait for the next question to try again!`,
            message,
            [registration.jid],
        );
        // If every active player is now locked out, end the question immediately.
        if (session.locked.size >= session.players.size && session.state === 'question') {
            if (session.questionTimer) clearTimeout(session.questionTimer);
            session.questionTimer = null;
            void finishQuestion(sock, session, session.questionNumber);
        }
        return true;
    }

    if (session.state !== 'question') return true;
    session.state = 'resolving';
    if (session.questionTimer) clearTimeout(session.questionTimer);
    session.questionTimer = null;
    const score = (session.scores.get(registration.jid) || 0) + 1;
    session.scores.set(registration.jid, score);

    if (score >= WINNING_SCORE) {
        await finishGame(sock, session, registration.jid);
        return true;
    }

    await send(
        sock,
        chatId,
        `✅ CORRECT! 🎌\n\n` +
        `${mention(registration.jid)} got it right! Answer: ${session.question.answerText}\n\n` +
        `🏅 Score: ${score}/10 pts\n\n` +
        `⏳ Wait for next question…`,
        message,
        [registration.jid],
    );
    session.nextTimer = setTimeout(() => void startQuestion(sock, session), 2200);
    return true;
}

module.exports = {
    openAnimeQuiz,
    isAnimeQuizRoom,
    joinAnimeQuiz,
    leaveAnimeQuiz,
    endAnimeQuiz,
    handleAnimeQuizAnswer,
};