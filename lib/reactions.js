const fs = require('fs');
const path = require('path');

// Per-command emoji map — prefix matched (longest wins)
const COMMAND_EMOJIS = {
    // AI
    '$ai': '🤖', '$ask': '🤖', '$gpt4o': '🤖', '$gptlarge': '🤖', '$gptfast': '🤖',
    '$gpt': '🤖', '$gemini': '🤖', '$mistral': '🤖', '$qwen': '🤖',
    '$imagine': '🎨', '$flux': '🎨', '$txt2img': '🎨', '$sora': '🎨',
    // Downloads
    '$play': '🎵', '$song': '🎵', '$ytaudio': '🎵', '$ytaudiodoc': '🎵', '$ytvideo': '📹', '$ytmp4': '📹', '$video': '📹',
    '$tiktok': '📥', '$tt': '📥', '$instagram': '📥', '$facebook': '📥',
    '$spotify': '🎵', '$apk': '📦', '$gitclone': '📦',
    // Movies / Streaming
    '$apimovie': '🎬', '$moviesub': '📜', '$movietrailer': '🎬', '$movie': '🎬', '$animeinfo': '🎌', '$anime': '🎬',
    '$net9ja': '🎬', '$trending': '🎬', '$upcoming': '🎬', '$schedule': '🎬',
    '$livesearch': '📺', '$livestream': '📺', '$live': '📺',
    // Manga
    '$manga': '📚',
    // Group management
    '$kick': '🛡️', '$promote': '🛡️', '$demote': '🛡️',
    '$unmute': '🛡️', '$mute': '🛡️', '$unban': '🛡️', '$ban': '🛡️',
    '$clearwarn': '🛡️', '$warnings': '🛡️', '$warn': '🛡️',
    '$antibadword': '🛡️', '$antilink': '🛡️', '$antitag': '🛡️',
    '$hidetag': '🛡️', '$tagall': '🛡️', '$tag': '🛡️',
    '$listadmins': '🛡️', '$listonline': '🛡️', '$membercount': '🛡️',
    '$groupinfo': '🛡️', '$grouplink': '🛡️', '$resetlink': '🛡️',
    '$topmembers': '🛡️', '$welcome': '🛡️', '$goodbye': '🛡️',
    '$pin': '📌', '$unpin': '📌',
    // Sports
    '$soccerstandings': '🏆', '$nbastandings': '🏆', '$nflstandings': '🏆',
    '$sportsteam': '🏆', '$sportsplayer': '🏆', '$livescores': '🏆',
    '$scoreboard': '🏆', '$sports': '🏆',
    '$flivescore': '⚽', '$fls': '⚽', '$fstream': '📡', '$fstreaming': '📡',
    '$fplayer': '👤', '$fteam': '🏟️', '$fvenue': '🏟️',
    '$fnews': '📰', '$footballnews': '📰', '$fleagues': '🏆',
    '$eplstand': '🏆', '$eplmatches': '📅', '$eplupcoming': '📅', '$eplfixtures': '📅',
    '$laligastand': '🏆', '$laligamatches': '📅', '$laligaupcoming': '📅', '$laligafixtures': '📅',
    '$bundesstand': '🏆', '$bundesliga': '🏆',
    '$blive': '🏀', '$bball': '🏀',
    '$charquote': '💬', '$showquote': '💬',
    // Ephoto
    '$ephoto': '🎨', '$ephoto2': '🎨', '$ephotolist': '🎨',
    // URL Shorteners
    '$tinyurl': '🔗', '$cleanuri': '🔗', '$vgd': '🔗',
    '$rebrandly': '🔗', '$vurl': '🔗', '$adfoc': '🔗', '$ssur': '🔗',
    // Crypto
    '$cryptotrand': '💰', '$cryptoconv': '💰', '$cryptotop': '💰', '$crypto': '💰',
    // Tools & utilities
    '$get': '🌐', '$fetch': '🌐', '$api': '🌐',
    '$weather': '🌤️', '$translate': '🌐', '$tts': '🔊', '$ss': '📸',
    '$createqr': '📱', '$carbon': '💻', '$imgscan': '🔍', '$removebg': '✂️',
    '$remini': '✨', '$netinfo': '🌐', '$url': '🔗',
    '$tempmail': '📧', '$vcf': '📇',
    // Fun & social
    '$funjokes': '😂', '$joke': '😂', '$dare': '🎯', '$truth': '🎯',
    '$rizz': '😏', '$meme': '🐸', '$waifu': '🌸', '$eightball': '🎱',
    '$trivia': '🧠', '$hangman': '🎮', '$tictactoe': '🎮',
    '$ship': '💕', '$simp': '🥺', '$wasted': '💀',
    '$roast': '🔥', '$insult': '🔥', '$compliment': '🌹',
    '$flirt': '😍', '$advice': '💡', '$quote': '📖',
    // Stickers / image
    '$stickertelegram': '🖼️', '$stickercrop': '🖼️', '$sticker': '🖼️',
    '$attp': '✍️', '$emojimix': '🎨',
    // Search / stalk
    '$ytsearch': '🔍', '$yts': '🔍', '$wallpaper': '🖼️', '$pinterest': '🖼️',
    '$lyrics': '🎵', '$slyrics': '🎵', '$news': '📰',
    '$gsearch': '🔍', '$gimage': '🖼️', '$ttsearch': '🎵',
    '$chord': '🎸', '$hearthis': '🎧', '$scsearch': '☁️',
    '$npmpkg': '📦', '$happymod': '📱', '$wattpad': '📖',
    '$stickersearch': '🎭',
    '$ttstalk': '👀', '$ghstalk': '👀', '$igstalk': '👀', '$twstalk': '👀',
    '$steamstalk': '👀',
    // Textpro
    '$textpro': '✨',
    // Code AI
    '$codeai': '💻',
    // WA ID tools
    '$phone': '📱', '$lid': '🔑', '$jid': '📟', '$jidp': '✅',
    // Tempgen
    '$tempphone': '📞', '$smsinbox': '📬',
    // Bible / religion
    '$bible': '✝️',
    // Start / info
    '$autoupdate': '🔄', '$update': '🔄',
    '$menu': '📋', '$help': '📋',
    '$ping': '🏓', '$alive': '💚', '$uptime': '⏱️',
    '$owner': '👤', '$settings': '⚙️', '$calc': '🧮',
    // Session
    '$pair': '🔐', '$unpair': '🔌',
    // Owner tools
    '$autotyping': '⌨️', '$autoread': '👁️', '$autostatus': '🔁',
    '$autoreact': '⚡', '$areact': '⚡',
    '$anticall': '🚫', '$pmblocker': '🚫',
    '$mode': '🔧', '$block': '🚫', '$unblock': '✅',
    '$bc': '📢', '$clearsession': '🗑️', '$cleartmp': '🗑️',
    '$savestatus': '💾', '$afk': '😴',
    '$antidelete': '🔒', '$setpp': '🖼️',
};

// YouTube download aliases
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');
const AUTO_REACT_EMOJI = '⚡';

function readUserGroupData() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
    } catch (error) { console.error('Error loading user-group data:', error.message); }
    return { groups: [], chatbot: {} };
}

function writeUserGroupData(data) {
    try {
        const dir = path.dirname(USER_GROUP_DATA);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) { console.error('Error saving user-group data:', error.message); }
}

function loadAutoReactionGroups() {
    const data = readUserGroupData();
    if (data.autoReactionGroups && typeof data.autoReactionGroups === 'object') return data.autoReactionGroups;
    // Do not carry the old global flag into every group. It is intentionally retired.
    return {};
}

function isAutoReactionEnabled(chatId) {
    if (!chatId || !chatId.endsWith('@g.us')) return false;
    const groups = loadAutoReactionGroups();
    return groups[chatId] === true || groups[chatId]?.enabled === true;
}

function setAutoReaction(chatId, enabled) {
    const data = readUserGroupData();
    data.autoReactionGroups = data.autoReactionGroups && typeof data.autoReactionGroups === 'object'
        ? data.autoReactionGroups : {};
    data.autoReactionGroups[chatId] = { enabled: Boolean(enabled), emoji: AUTO_REACT_EMOJI, updatedAt: Date.now() };
    writeUserGroupData(data);
}

function getEmojiForCommand(userMessage) {
    if (!userMessage) return '⏳';
    const lower = userMessage.toLowerCase().trim();
    const sorted = Object.keys(COMMAND_EMOJIS).sort((a, b) => b.length - a.length);
    for (const prefix of sorted) {
        if (lower === prefix || lower.startsWith(prefix + ' ')) return COMMAND_EMOJIS[prefix];
    }
    return '⏳';
}

async function addCommandReaction(sock, message, userMessage) {
    try {
        if (!message?.key?.id) return;
        await sock.sendMessage(message.key.remoteJid, { react: { text: getEmojiForCommand(userMessage), key: message.key } });
    } catch (error) { console.error('Error adding command reaction:', error.message); }
}

function cleanJid(value) {
    return String(value || '').split(':')[0].split('@')[0];
}

function getMentionedJids(message) {
    const context = message?.message?.extendedTextMessage?.contextInfo
        || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo
        || {};
    return context.mentionedJid || [];
}

function isBotMentioned(sock, message) {
    const botJids = [sock?.user?.id, sock?.user?.lid]
        .map(cleanJid).filter(Boolean);
    return getMentionedJids(message).some(jid => botJids.includes(cleanJid(jid)));
}

// Auto-react only in enabled groups, and only to paired-owner/sudo messages or
// messages that explicitly mention the bot. This prevents a group-wide reaction storm.
async function handleAutoReactionMessage(sock, chatId, message, isOwnerOrSudo) {
    if (!chatId?.endsWith('@g.us') || message?.key?.fromMe || !isAutoReactionEnabled(chatId)) return false;
    const senderAllowed = Boolean(isOwnerOrSudo);
    if (!senderAllowed && !isBotMentioned(sock, message)) return false;
    try {
        const groups = loadAutoReactionGroups();
        const emoji = groups[chatId]?.emoji || AUTO_REACT_EMOJI;
        await sock.sendMessage(chatId, { react: { text: emoji, key: message.key } });
        return true;
    } catch (error) {
        console.error('Error adding group auto-reaction:', error.message);
        return false;
    }
}

async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!chatId?.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '❌ Auto-reactions can only be configured inside a group.', quoted: message });
            return;
        }
        if (!isOwner) {
            await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo.', quoted: message });
            return;
        }
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const action = text.trim().split(/\s+/)[1]?.toLowerCase();
        const enabled = isAutoReactionEnabled(chatId);
        if (action === 'on') {
            if (enabled) return sock.sendMessage(chatId, { text: 'ℹ️ Auto-reactions are already *enabled* in this group.', quoted: message });
            setAutoReaction(chatId, true);
            return sock.sendMessage(chatId, { text: '✅ Auto-reactions enabled for this group only.\nI will react to paired-owner/sudo messages and messages that tag the bot.', quoted: message });
        }
        if (action === 'off') {
            if (!enabled) return sock.sendMessage(chatId, { text: 'ℹ️ Auto-reactions are already *disabled* in this group.', quoted: message });
            setAutoReaction(chatId, false);
            return sock.sendMessage(chatId, { text: '✅ Auto-reactions disabled for this group.', quoted: message });
        }
        await sock.sendMessage(chatId, {
            text: `⚡ *GROUP AUTO-REACTION*\n\nStatus: *${enabled ? 'enabled' : 'disabled'}*\nScope: this group only\nTargets: paired owner/sudo messages or messages tagging the bot\n\nUse:\n$areact on\n$areact off`,
            quoted: message,
        });
    } catch (error) {
        console.error('Error handling areact command:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Error controlling group auto-reactions.', quoted: message });
    }
}

module.exports = { addCommandReaction, handleAreactCommand, handleAutoReactionMessage, isAutoReactionEnabled };
