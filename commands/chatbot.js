const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { get } = require('../lib/gifted');

const USER_GROUP_DATA = path.join(__dirname, '../data/userGroupData.json');

// In-memory storage for chat history and user info
const chatMemory = {
    messages: new Map(), // Stores last 20 messages per user
    userInfo: new Map()  // Stores user information
};

// Load user group data
function loadUserGroupData() {
    try {
        if (!fs.existsSync(USER_GROUP_DATA)) {
            const defaultData = { groups: [], chatbot: {} };
            fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        return JSON.parse(fs.readFileSync(USER_GROUP_DATA, 'utf8'));
    } catch (error) {
        console.error('❌ Error loading user group data:', error.message);
        return { groups: [], chatbot: {} };
    }
}

// Save user group data
function saveUserGroupData(data) {
    try {
        fs.writeFileSync(USER_GROUP_DATA, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Error saving user group data:', error.message);
    }
}

// Add random delay between 1-4 seconds (more natural)
function getRandomDelay() {
    return Math.floor(Math.random() * 3000) + 1000;
}

// Add typing indicator
async function showTyping(sock, chatId) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    } catch (error) {
        console.error('Typing indicator error:', error);
    }
}

// Stop typing indicator
async function stopTyping(sock, chatId) {
    try {
        await sock.sendPresenceUpdate('paused', chatId);
    } catch (error) {
        console.error('Stop typing error:', error);
    }
}

// Extract user information from messages (improved)
function extractUserInfo(message, senderId) {
    const info = chatMemory.userInfo.get(senderId) || {};
    const lowerMessage = message.toLowerCase();
    
    // Extract name
    if (lowerMessage.includes('my name is')) {
        const namePart = message.split(/my name is/i)[1].trim();
        info.name = namePart.split(/[,\s.!?]/)[0];
    }
    
    // Extract age
    const ageMatch = message.match(/(?:i am|i'm) (\d+)(?:\s*years? old)?/i);
    if (ageMatch) {
        info.age = ageMatch[1];
    }
    
    // Extract location
    const locationMatch = message.match(/(?:i (?:live in|am from) )(.+?)(?:[,.!?]|$)/i);
    if (locationMatch) {
        info.location = locationMatch[1].trim();
    }
    
    return info;
}

// ─── AI response using GiftedTech Gemini (overchat), Pollinations fallback ────

async function getAIResponse(userMessage, context) {
    // Build a short system context string
    let sysCtx = 'You are Dara, a friendly and smart WhatsApp chatbot. Be helpful, casual, and keep replies short (1-3 lines).';
    if (context?.userInfo) {
        const u = context.userInfo;
        if (u.name) sysCtx += ` The user's name is ${u.name}.`;
        if (u.location) sysCtx += ` They are from ${u.location}.`;
    }

    const fullQuery = sysCtx + '\n\nUser: ' + userMessage + '\n\nDara:';

    // Primary: GiftedTech overchat — gemini model
    try {
        const data = await get('/ai/overchat', { q: fullQuery, model: 'gemini' }, 20000);
        if (!data?.success) throw new Error(data?.message || 'No response');
        let reply = typeof data.result === 'string'
            ? data.result
            : (data.result?.answer || JSON.stringify(data.result));
        reply = reply.replace(/^(Dara|Bot|AI|Assistant):\s*/i, '').trim();
        if (reply && reply.length <= 2000) return reply;
        throw new Error('Empty or oversized reply');
    } catch (primaryErr) {
        console.warn('[chatbot:gemini]', primaryErr.message, '— falling back to Pollinations');
    }

    // Fallback: Pollinations free API
    try {
        const prompt = `You are Dara, a friendly WhatsApp assistant. Be casual and helpful. Keep responses short (1-3 lines).\n\nUser: ${userMessage}\n\nDara:`;
        const response = await fetch(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, { timeout: 20000 });
        if (!response.ok) throw new Error(`Pollinations HTTP ${response.status}`);
        const raw = (await response.text()).trim();
        const clean = raw.replace(/^(Dara|Bot|AI|Assistant|ALASTOR-XD):\s*/i, '').trim();
        if (clean && clean.length <= 1000) return clean;
    } catch (fallbackErr) {
        console.error('[chatbot:pollinations]', fallbackErr.message);
    }

    return null;
}

// ─── $chatbot on/off/status — admin command ───────────────────────────────────

async function handleChatbotCommand(sock, chatId, message, match) {
    if (!match) {
        await showTyping(sock, chatId);
        await stopTyping(sock, chatId);
        return sock.sendMessage(chatId, {
            text: `🤖 *CHATBOT SETUP*\n\n*$chatbot on* - Enable auto-reply in this group\n*$chatbot off* - Disable auto-reply in this group\n*$chatbot status* - Check status\n\n💡 *Tip:* Use *$botchat <message>* anytime to chat with the bot directly — no need to @mention.`,
            quoted: message
        });
    }

    const data = loadUserGroupData();
    const sender = message.key.participant || message.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    if (!isGroup) {
        const botOwner = process.env.BOT_OWNER || 'YOUR_NUMBER@s.whatsapp.net';
        if (sender !== botOwner) {
            await sock.sendMessage(chatId, {
                text: '❌ Only the bot owner can control chatbot in private chat.',
                quoted: message
            });
            return;
        }
        if (match === 'on') {
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            await sock.sendMessage(chatId, { text: '✅ Chatbot enabled for this chat', quoted: message });
        } else if (match === 'off') {
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            await sock.sendMessage(chatId, { text: '✅ Chatbot disabled for this chat', quoted: message });
        } else if (match === 'status') {
            const status = data.chatbot[chatId] ? 'enabled' : 'disabled';
            await sock.sendMessage(chatId, { text: `Chatbot status: ${status}`, quoted: message });
        }
        return;
    }

    // Groups: check admin
    let isAdmin = false;
    try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find(p => p.id === sender);
        isAdmin = participant && (participant.admin === 'admin' || participant.admin === 'superadmin');
    } catch (e) {
        console.warn('⚠️ Could not fetch group metadata:', e.message);
    }

    if (!isAdmin) {
        await sock.sendMessage(chatId, {
            text: '❌ Only group admins can use this command.',
            quoted: message
        });
        return;
    }

    if (match === 'on') {
        if (data.chatbot[chatId]) {
            await sock.sendMessage(chatId, { text: '🤖 Chatbot is already enabled in this group', quoted: message });
        } else {
            data.chatbot[chatId] = true;
            saveUserGroupData(data);
            await sock.sendMessage(chatId, { text: '✅ Chatbot enabled\n\n💡 Members can now @mention the bot or use *$botchat <message>* to chat.', quoted: message });
        }
    } else if (match === 'off') {
        if (!data.chatbot[chatId]) {
            await sock.sendMessage(chatId, { text: '🤖 Chatbot is already disabled in this group', quoted: message });
        } else {
            delete data.chatbot[chatId];
            saveUserGroupData(data);
            await sock.sendMessage(chatId, { text: '✅ Chatbot disabled for this group', quoted: message });
        }
    } else if (match === 'status') {
        const status = data.chatbot[chatId] ? '✅ enabled' : '❌ disabled';
        await sock.sendMessage(chatId, { text: `🤖 Chatbot status: ${status}`, quoted: message });
    } else {
        await sock.sendMessage(chatId, {
            text: '❌ Invalid command. Use: $chatbot [on/off/status]',
            quoted: message
        });
    }
}

// ─── $botchat <message> — direct chat command (requires chatbot on in groups) ──

async function handleBotchatCommand(sock, chatId, message, query, senderId) {
    const isGroup = chatId.endsWith('@g.us');

    // In groups, chatbot must be enabled first
    if (isGroup) {
        const data = loadUserGroupData();
        if (!data.chatbot[chatId]) {
            return sock.sendMessage(chatId, {
                text: '❌ Chatbot is not enabled in this group.\n\nAsk an admin to run *$chatbot on* first.',
                quoted: message
            });
        }
    }

    // Extract quoted message content if this is a reply
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    let quotedText = '';
    let quotedType = '';
    if (quoted) {
        quotedText = quoted.conversation
            || quoted.extendedTextMessage?.text
            || quoted.imageMessage?.caption
            || quoted.videoMessage?.caption
            || quoted.documentMessage?.caption
            || '';
        if (!quotedText) {
            if (quoted.imageMessage)    quotedType = 'image';
            else if (quoted.videoMessage)   quotedType = 'video';
            else if (quoted.stickerMessage) quotedType = 'sticker';
            else if (quoted.audioMessage)   quotedType = 'audio';
            else if (quoted.documentMessage) quotedType = 'document';
        }
    }

    // Build final query:
    // - reply with no extra text   → use quoted content
    // - reply + extra text         → "extra text" + context about quoted
    // - no reply, no text          → show usage
    let finalQuery = query;
    if (quoted) {
        if (query && quotedText) {
            // User typed something AND replied to text → combine
            finalQuery = `${query}\n\n(replying to: "${quotedText}")`;
        } else if (query && !quotedText) {
            // Replied to media with extra text
            finalQuery = `${query}\n\n(replying to a ${quotedType || 'message'})`;
        } else if (!query && quotedText) {
            // Just replied to text with no extra input → use quoted text as the prompt
            finalQuery = quotedText;
        } else if (!query && !quotedText) {
            // Replied to media with no extra text → ask about it
            finalQuery = `What can you tell me about a ${quotedType || 'message'} someone shared?`;
        }
    }

    if (!finalQuery) {
        return sock.sendMessage(chatId, {
            text: '🤖 *BOTCHAT*\n\nUsage:\n▸ *$botchat <your message>*\n▸ Reply to any text/image/video with *$botchat* to discuss it\n▸ Reply with *$botchat <question>* to ask about it\n\nExample: *$botchat What is the capital of Nigeria?*\n\n_You can also @mention the bot or reply to any of its messages_ ⚡',
            quoted: message
        });
    }

    // Ensure memory initialized
    if (!chatMemory.messages.has(senderId)) {
        chatMemory.messages.set(senderId, []);
        chatMemory.userInfo.set(senderId, {});
    }

    // Extract user info
    const userInfo = extractUserInfo(finalQuery, senderId);
    if (Object.keys(userInfo).length > 0) {
        chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...userInfo });
    }

    // Add to message history
    const msgs = chatMemory.messages.get(senderId);
    msgs.push({ role: 'user', content: finalQuery });
    if (msgs.length > 20) msgs.splice(0, msgs.length - 20);

    await showTyping(sock, chatId);

    const response = await getAIResponse(finalQuery, {
        messages: chatMemory.messages.get(senderId),
        userInfo: chatMemory.userInfo.get(senderId),
        chatType: chatId.endsWith('@g.us') ? 'group' : 'private',
    });

    await new Promise(r => setTimeout(r, getRandomDelay()));
    await stopTyping(sock, chatId);

    const reply = response || "Hmm, let me think about that... 🤔\nI'm having a bit of trouble right now, try again!";
    await sock.sendMessage(chatId, {
        text: reply,
        mentions: [senderId],
    }, { quoted: message });

    // Save bot reply to memory
    msgs.push({ role: 'assistant', content: reply });
    if (msgs.length > 20) msgs.splice(0, msgs.length - 20);
}

// ─── Auto-reply: triggered by @mention or reply to bot ───────────────────────

async function handleChatbotResponse(sock, chatId, message, userMessage, senderId) {
    const data = loadUserGroupData();
    if (!data.chatbot[chatId]) return;

    try {
        const botNumber = sock.user.id.split(':')[0];
        
        const isMentioned = userMessage.includes(`@${botNumber}`);
        const quotedParticipant = message.message?.extendedTextMessage?.contextInfo?.participant;
        const quotedSender     = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isReplyToBot     = quotedParticipant && quotedParticipant.includes(botNumber);
        const isDirectMessage  = !chatId.endsWith('@g.us');
        
        // Only respond if: DM, @mentioned, or reply to bot's own message
        if (!isDirectMessage && !isMentioned && !isReplyToBot) return;
        
        // Clean the message
        let cleanedMessage = userMessage
            .replace(new RegExp(`@${botNumber}`, 'g'), '')
            .replace(/^[\.!\/]/, '')
            .trim();
        
        if (!cleanedMessage) return;

        if (!chatMemory.messages.has(senderId)) {
            chatMemory.messages.set(senderId, []);
            chatMemory.userInfo.set(senderId, {});
        }

        const userInfo = extractUserInfo(cleanedMessage, senderId);
        if (Object.keys(userInfo).length > 0) {
            chatMemory.userInfo.set(senderId, { ...chatMemory.userInfo.get(senderId), ...userInfo });
        }

        const messages = chatMemory.messages.get(senderId);
        messages.push({ role: 'user', content: cleanedMessage });
        if (messages.length > 20) messages.splice(0, messages.length - 20);

        await showTyping(sock, chatId);

        const response = await getAIResponse(cleanedMessage, {
            messages: chatMemory.messages.get(senderId),
            userInfo: chatMemory.userInfo.get(senderId),
            chatType: isDirectMessage ? 'private' : 'group'
        });

        if (!response) {
            await stopTyping(sock, chatId);
            await sock.sendMessage(chatId, { 
                text: "Hmm, let me think about that... 🤔\nI'm having trouble processing your request right now.",
                quoted: message
            });
            return;
        }

        await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
        await stopTyping(sock, chatId);

        await sock.sendMessage(chatId, {
            text: response,
            mentions: isMentioned ? [senderId] : []
        }, { quoted: message });

        const botMessages = chatMemory.messages.get(senderId);
        botMessages.push({ role: 'assistant', content: response });
        if (botMessages.length > 20) botMessages.splice(0, botMessages.length - 20);

    } catch (error) {
        console.error('❌ Error in chatbot response:', error);
        await stopTyping(sock, chatId);
        
        if (error.message && error.message.includes('session')) {
            console.error('Session error - skipping response');
            return;
        }

        try {
            await sock.sendMessage(chatId, { 
                text: "Oops! 😅 I got a bit confused there. Could you try asking that again?",
                quoted: message
            });
        } catch (sendError) {
            console.error('Failed to send chatbot error message:', sendError.message);
        }
    }
}

// Clear chat memory periodically
function clearOldChatMemory() {
    setInterval(() => {
        for (const [userId] of chatMemory.messages) {
            if (Math.random() < 0.1) {
                chatMemory.messages.delete(userId);
                chatMemory.userInfo.delete(userId);
            }
        }
    }, 30 * 60 * 1000);
}

clearOldChatMemory();

module.exports = {
    handleChatbotCommand,
    handleChatbotResponse,
    handleBotchatCommand,
    loadUserGroupData,
    saveUserGroupData
};
