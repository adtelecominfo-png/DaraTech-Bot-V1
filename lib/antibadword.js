const { setAntiBadword, getAntiBadword, removeAntiBadword, incrementWarningCount, resetWarningCount } = require('../lib/index');
const fs = require('fs');
const path = require('path');

// Load antibadword config
function loadAntibadwordConfig(groupId) {
    try {
        const configPath = path.join(__dirname, '../data/userGroupData.json');
        if (!fs.existsSync(configPath)) {
            return {};
        }
        const data = JSON.parse(fs.readFileSync(configPath));
        return data.antibadword?.[groupId] || {};
    } catch (error) {
        console.error('❌ Error loading antibadword config:', error.message);
        return {};
    }
}

async function handleAntiBadwordCommand(sock, chatId, message, match) {
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `*ANTIBADWORD SETUP*\n\n*$antibadword on*\nTurn on antibadword\n\n*$antibadword set <action>*\nSet action: delete/kick/warn\n\n*$antibadword off*\nDisables antibadword in this group`
        }, { quoted: message });
    }

    if (match === 'on') {
        const existingConfig = await getAntiBadword(chatId, 'on');
        if (existingConfig?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiBadword is already enabled for this group*' });
        }
        await setAntiBadword(chatId, 'on', 'delete');
        return sock.sendMessage(chatId, { text: '*AntiBadword has been enabled. Use $antibadword set <action> to customize action*' }, { quoted: message });
    }

    if (match === 'off') {
        const config = await getAntiBadword(chatId, 'on');
        if (!config?.enabled) {
            return sock.sendMessage(chatId, { text: '*AntiBadword is already disabled for this group*' }, { quoted: message } );
        }
        await removeAntiBadword(chatId);
        return sock.sendMessage(chatId, { text: '*AntiBadword has been disabled for this group*' }, { quoted: message } );
    }

    if (match.startsWith('set')) {
        const action = match.split(' ')[1];
        if (!action || !['delete', 'kick', 'warn'].includes(action)) {
            return sock.sendMessage(chatId, { text: '*Invalid action. Choose: delete, kick, or warn*' }, { quoted: message } );
        }
        await setAntiBadword(chatId, 'on', action);
        return sock.sendMessage(chatId, { text: `*AntiBadword action set to: ${action}*` }, { quoted: message } );
    }

    return sock.sendMessage(chatId, { text: '*Invalid command. Use $antibadword to see usage*' }, { quoted: message } );
}

async function handleBadwordDetection(sock, chatId, message, userMessage, senderId) {
    const config = loadAntibadwordConfig(chatId);
    if (!config.enabled) return;

    // Skip if not group
    if (!chatId.endsWith('@g.us')) return;

    // Skip if message is from bot
    if (message.key.fromMe) return;

    // Get antibadword config first
    const antiBadwordConfig = await getAntiBadword(chatId, 'on');
    if (!antiBadwordConfig?.enabled) {
        console.log('Antibadword not enabled for this group');
        return;
    }

    // Convert message to lowercase and clean it
    const cleanMessage = userMessage.toLowerCase()
        .replace(/[^\w\s]/g, ' ')  // Replace special chars with space
        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
        .trim();

    // List of bad words
    const badWords = [
        'gandu', 'madarchod', 'bhosdike', 'bsdk', 'fucker', 'bhosda', 
        'lauda', 'laude', 'betichod', 'chutiya', 'maa ki chut', 'behenchod', 
        'behen ki chut', 'tatto ke saudagar', 'machar ki jhant', 'jhant ka baal', 
        'randi', 'chuchi', 'boobs', 'boobies', 'tits', 'idiot', 'nigga', 'fuck', 
        'dick', 'bitch', 'bastard', 'asshole', 'asu', 'awyu', 'teri ma ki chut', 
        'teri maa ki', 'lund', 'lund ke baal', 'mc', 'lodu', 'benchod',
    
        // Additional offensive words
        'shit', 'damn', 'hell', 'piss', 'crap', 'bastard', 'slut', 'whore', 'prick',
        'motherfucker', 'cock', 'cunt', 'pussy', 'twat', 'wanker', 'douchebag', 'jackass', 
        'moron', 'retard', 'scumbag', 'skank', 'slutty', 'arse', 'bugger', 'sod off',
    
        'chut', 'laude ka baal', 'madar', 'behen ke lode', 'chodne', 'sala kutta',
        'harami', 'randi ki aulad', 'gaand mara', 'chodu', 'lund le', 'gandu saala',
        'kameena', 'haramzada', 'chamiya', 'chodne wala', 'chudai', 'chutiye ke baap',
    
        'fck', 'fckr', 'fcker', 'fuk', 'fukk', 'fcuk', 'btch', 'bch', 'bsdk', 'f*ck','assclown',
        'a**hole', 'f@ck', 'b!tch', 'd!ck', 'n!gga', 'f***er', 's***head', 'a$$', 'l0du', 'lund69',
    
        'spic', 'chink', 'cracker', 'towelhead', 'gook', 'kike', 'paki', 'honky', 
        'wetback', 'raghead', 'jungle bunny', 'sand nigger', 'beaner',
    
        'blowjob', 'handjob', 'cum', 'cumshot', 'jizz', 'deepthroat', 'fap', 
        'hentai', 'MILF', 'anal', 'orgasm', 'dildo', 'vibrator', 'gangbang', 
        'threesome', 'porn', 'sex', 'xxx',
    
        'fag', 'faggot', 'dyke', 'tranny', 'homo', 'sissy', 'fairy', 'lesbo',
    
        'weed', 'pot', 'coke', 'heroin', 'meth', 'crack', 'dope', 'bong', 'kush', 
        'hash', 'trip', 'rolling'
    ];
    
    // Split message into words
    const messageWords = cleanMessage.split(' ');
    let containsBadWord = false;

    // Check for exact word matches only
    for (const word of messageWords) {
        // Skip empty words or very short words
        if (word.length < 2) continue;

        // Check if this word exactly matches any bad word
        if (badWords.includes(word)) {
            containsBadWord = true;
            break;
        }

        // Also check for multi-word bad words
        for (const badWord of badWords) {
            if (badWord.includes(' ')) {  // Multi-word bad phrase
                if (cleanMessage.includes(badWord)) {
                    containsBadWord = true;
                    break;
                }
            }
        }
        if (containsBadWord) break;
    }

    if (!containsBadWord) return;

    // Check if bot is admin before taking action
    const groupMetadata = await sock.groupMetadata(chatId);
    const rawBotId = sock.user?.id || '';
    const botId = rawBotId.includes(':') ? rawBotId.split(':')[0] + '@s.whatsapp.net' : rawBotId;
    const bot = groupMetadata.participants.find(p => p.id === botId);
    if (!bot?.admin) {
        // Bot not admin — can't delete, but at least warn
        await sock.sendMessage(chatId, {
            text: `⚠️ *@${senderId.split('@')[0]} bad words are not allowed here*\n_Make bot admin to enable auto-delete._`,
            mentions: [senderId]
        });
        return;
    }

    // Delete message immediately
    let deleted = false;
    try {
        await sock.sendMessage(chatId, { delete: message.key });
        deleted = true;
    } catch (err) {
        console.error('[antibadword] delete failed:', err.message);
    }

    // Check if sender is a group admin (can't kick admins; only skip kick/warn auto-kick)
    const senderParticipant = groupMetadata.participants.find(p => p.id === senderId);
    const senderIsAdmin = Boolean(senderParticipant?.admin);

    // Take action based on config
    switch (antiBadwordConfig.action) {
        case 'delete':
            await sock.sendMessage(chatId, {
                text: `🚫 *@${senderId.split('@')[0]} bad words are not allowed here*`,
                mentions: [senderId]
            });
            break;

        case 'kick':
            if (senderIsAdmin) {
                // Can't kick an admin — delete + warn instead
                await sock.sendMessage(chatId, {
                    text: `⚠️ *@${senderId.split('@')[0]} bad words are not allowed here* _(admin — cannot kick)_`,
                    mentions: [senderId]
                });
            } else {
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await sock.sendMessage(chatId, {
                        text: `🚫 *@${senderId.split('@')[0]} has been kicked for using bad words*`,
                        mentions: [senderId]
                    });
                } catch (error) {
                    console.error('[antibadword] kick failed:', error.message);
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *@${senderId.split('@')[0]} bad words are not allowed here* _(kick failed)_`,
                        mentions: [senderId]
                    });
                }
            }
            break;

        case 'warn': {
            const warningCount = await incrementWarningCount(chatId, senderId);
            if (warningCount >= 3 && !senderIsAdmin) {
                try {
                    await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                    await resetWarningCount(chatId, senderId);
                    await sock.sendMessage(chatId, {
                        text: `🚫 *@${senderId.split('@')[0]} has been kicked after 3 warnings for bad words*`,
                        mentions: [senderId]
                    });
                } catch (error) {
                    console.error('[antibadword] kick-after-warn failed:', error.message);
                    await sock.sendMessage(chatId, {
                        text: `⚠️ *@${senderId.split('@')[0]} final warning ${warningCount}/3 — bad words are not allowed*`,
                        mentions: [senderId]
                    });
                }
            } else {
                await sock.sendMessage(chatId, {
                    text: `⚠️ *@${senderId.split('@')[0]} warning ${warningCount}/3 — bad words are not allowed here*`,
                    mentions: [senderId]
                });
            }
            break;
        }
    }
}

module.exports = {
    handleAntiBadwordCommand,
    handleBadwordDetection
}; 