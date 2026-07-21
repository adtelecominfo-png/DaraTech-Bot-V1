const fs = require('fs');
const path = require('path');

// Per-command emoji map — prefix matched (longest wins)
const COMMAND_EMOJIS = {
    // AI
    '$ai': '🤖', '$ask': '🤖', '$gpt4o': '🤖', '$gptlarge': '🤖', '$gptfast': '🤖',
    '$gpt': '🤖', '$gemini': '🤖', '$mistral': '🤖', '$qwen': '🤖',
    '$imagine': '🎨', '$flux': '🎨', '$txt2img': '🎨', '$sora': '🎨',
    // Downloads
    '$play': '🎵', '$song': '🎵', '$ytmp4': '📹', '$video': '📹',
    '$tiktok': '📥', '$tt': '📥', '$instagram': '📥', '$facebook': '📥',
    '$spotify': '🎵', '$apk': '📦', '$gitclone': '📦',
    // Movies / Streaming
    '$movietrailer': '🎬', '$movie': '🎬', '$animeinfo': '🎌', '$anime': '🎬',
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

// Path for storing auto-reaction state
const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// Load auto-reaction state from file
function loadAutoReactionState() {
    try {
        if (fs.existsSync(USER_GROUP_DATA)) {
            const data = JSON.parse(fs.readFileSync(USER_GROUP_DATA));
            return data.autoReaction || false;
        }
    } catch (error) {
        console.error('Error loading auto-reaction state:', error);
    }
    return false;
}

// Save auto-reaction state to file
function saveAutoReactionState(state) {
    try {
        const data = fs.existsSync(USER_GROUP_DATA) 
            ? JSON.parse(fs.readFileSync(USER_GROUP_DATA))
            : { groups: [], chatbot: {} };
        
        data.autoReaction = state;
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving auto-reaction state:', error);
    }
}

// Store auto-reaction state
let isAutoReactionEnabled = loadAutoReactionState();

// Look up the right emoji for a command, falling back to ⏳
function getEmojiForCommand(userMessage) {
    if (!userMessage) return '⏳';
    const lower = userMessage.toLowerCase().trim();
    // Try longest matching prefix first (e.g. $gpt4o before $gpt)
    const sorted = Object.keys(COMMAND_EMOJIS).sort((a, b) => b.length - a.length);
    for (const prefix of sorted) {
        if (lower === prefix || lower.startsWith(prefix + ' ')) {
            return COMMAND_EMOJIS[prefix];
        }
    }
    return '⏳';
}

// Function to add reaction to a command message — always fires, no toggle needed
async function addCommandReaction(sock, message, userMessage) {
    try {
        if (!message?.key?.id) return;
        const emoji = getEmojiForCommand(userMessage);
        await sock.sendMessage(message.key.remoteJid, {
            react: {
                text: emoji,
                key: message.key
            }
        });
    } catch (error) {
        console.error('Error adding command reaction:', error);
    }
}

// Function to handle areact command
async function handleAreactCommand(sock, chatId, message, isOwner) {
    try {
        if (!isOwner) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command is only available for the owner!',
                quoted: message
            });
            return;
        }

        const args = message.message?.conversation?.split(' ') || [];
        const action = args[1]?.toLowerCase();

        if (action === 'on') {
            isAutoReactionEnabled = true;
            saveAutoReactionState(true);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been enabled globally',
                quoted: message
            });
        } else if (action === 'off') {
            isAutoReactionEnabled = false;
            saveAutoReactionState(false);
            await sock.sendMessage(chatId, { 
                text: '✅ Auto-reactions have been disabled globally',
                quoted: message
            });
        } else {
            const currentState = isAutoReactionEnabled ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { 
                text: `Auto-reactions are currently ${currentState} globally.\n\nUse:\n.areact on - Enable auto-reactions\n.areact off - Disable auto-reactions`,
                quoted: message
            });
        }
    } catch (error) {
        console.error('Error handling areact command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error controlling auto-reactions',
            quoted: message
        });
    }
}

module.exports = {
    addCommandReaction,
    handleAreactCommand
}; 