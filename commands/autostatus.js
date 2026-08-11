const fs = require('fs');
const path = require('path');
const isOwnerOrSudo = require('../lib/isOwner');
const { isAuthorizedOwnerSession } = require('../lib/isOwner');

const channelInfo = {
    contextInfo: {
    }
};

// Path to store auto status configuration
const configPath = path.join(__dirname, '../data/autoStatus.json');

// Default config
const DEFAULT_CONFIG = {
    enabled: false,
    reactOn: false,
    reactionEmoji: '💚',
    readReceipts: true
};

// Initialize config file if it doesn't exist or migrate missing fields
function loadConfig() {
    try {
        const raw = JSON.parse(fs.readFileSync(configPath));
        // Merge with defaults so new fields are always present
        return Object.assign({}, DEFAULT_CONFIG, raw);
    } catch {
        return { ...DEFAULT_CONFIG };
    }
}

function saveConfig(config) {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// Ensure file exists on startup
if (!fs.existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
}

async function autoStatusCommand(sock, chatId, msg, args) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        
        if (!isAuthorizedOwnerSession(sock) || (!msg.key.fromMe && !isOwner)) {
            await sock.sendMessage(chatId, { 
                text: '❌ This command can only be used by the owner!',
                ...channelInfo
            });
            return;
        }

        let config = loadConfig();

        // No args — show current settings
        if (!args || args.length === 0) {
            await sock.sendMessage(chatId, { 
                text: `🔄 *Auto Status Settings*\n\n` +
                    `📱 *Auto View:* ${config.enabled ? 'on' : 'off'}\n` +
                    `👁️ *Read Receipts:* ${config.readReceipts ? 'on' : 'off'}\n` +
                    `💫 *Auto React:* ${config.reactOn ? 'on' : 'off'}\n` +
                    `😀 *Reaction Emoji:* ${config.reactionEmoji}\n\n` +
                    `*Commands:*\n` +
                    `$autostatus on/off — enable/disable auto view\n` +
                    `$autostatus readreceipts on/off — show/hide read receipts\n` +
                    `$autostatus react on/off — enable/disable auto react\n` +
                    `$autostatus reaction <emoji> — set reaction emoji`,
                ...channelInfo
            });
            return;
        }

        const command = args[0].toLowerCase();

        if (command === 'on') {
            config.enabled = true;
            saveConfig(config);
            await sock.sendMessage(chatId, { text: '✅ Auto status view enabled.', ...channelInfo });

        } else if (command === 'off') {
            config.enabled = false;
            saveConfig(config);
            await sock.sendMessage(chatId, { text: '❌ Auto status view disabled.', ...channelInfo });

        } else if (command === 'readreceipts') {
            const sub = (args[1] || '').toLowerCase();
            if (sub === 'on') {
                config.readReceipts = true;
                saveConfig(config);
                await sock.sendMessage(chatId, { text: '👁️ Read receipts enabled — status posters will see the view.', ...channelInfo });
            } else if (sub === 'off') {
                config.readReceipts = false;
                saveConfig(config);
                await sock.sendMessage(chatId, { text: '🙈 Read receipts disabled — views are silent.', ...channelInfo });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Usage: $autostatus readreceipts on/off', ...channelInfo });
            }

        } else if (command === 'react') {
            const sub = (args[1] || '').toLowerCase();
            if (sub === 'on') {
                config.reactOn = true;
                saveConfig(config);
                await sock.sendMessage(chatId, { text: `💫 Auto react enabled (${config.reactionEmoji}).`, ...channelInfo });
            } else if (sub === 'off') {
                config.reactOn = false;
                saveConfig(config);
                await sock.sendMessage(chatId, { text: '❌ Auto react disabled.', ...channelInfo });
            } else {
                await sock.sendMessage(chatId, { text: '❌ Usage: $autostatus react on/off', ...channelInfo });
            }

        } else if (command === 'reaction') {
            // args[1] is the emoji — keep original casing/form
            const emoji = args[1] || args.slice(1).join('').trim();
            if (!emoji) {
                await sock.sendMessage(chatId, { text: '❌ Usage: $autostatus reaction <emoji>  e.g. $autostatus reaction 🌚', ...channelInfo });
                return;
            }
            config.reactionEmoji = emoji;
            saveConfig(config);
            await sock.sendMessage(chatId, { text: `✅ Reaction emoji set to ${emoji}`, ...channelInfo });

        } else {
            await sock.sendMessage(chatId, { 
                text: '❌ Unknown subcommand. Use $autostatus with no args to see options.',
                ...channelInfo
            });
        }

    } catch (error) {
        console.error('Error in autostatus command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Error: ' + error.message,
            ...channelInfo
        });
    }
}

// Function to check if auto status is enabled
function isAutoStatusEnabled() {
    return loadConfig().enabled;
}

// Function to react to status using proper method
async function reactToStatus(sock, statusKey) {
    try {
        const config = loadConfig();
        if (!config.reactOn) return;

        const emoji = config.reactionEmoji || '💚';

        await sock.relayMessage(
            'status@broadcast',
            {
                reactionMessage: {
                    key: {
                        remoteJid: 'status@broadcast',
                        id: statusKey.id,
                        participant: statusKey.participant || statusKey.remoteJid,
                        fromMe: false
                    },
                    text: emoji
                }
            },
            {
                messageId: statusKey.id,
                statusJidList: [statusKey.remoteJid, statusKey.participant || statusKey.remoteJid]
            }
        );
    } catch (error) {
        console.error('❌ Error reacting to status:', error.message);
    }
}

// Mark a status as read (respects readReceipts setting)
async function markStatusRead(sock, key) {
    const config = loadConfig();
    if (!config.readReceipts) return; // silent view — don't send read receipt
    try {
        await sock.readMessages([key]);
    } catch (err) {
        if (err.message?.includes('rate-overlimit')) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await sock.readMessages([key]);
        } else {
            throw err;
        }
    }
}

// Function to handle status updates
async function handleStatusUpdate(sock, status) {
    try {
        if (!isAutoStatusEnabled()) return;

        // Add delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Handle status from messages.upsert
        if (status.messages && status.messages.length > 0) {
            const msg = status.messages[0];
            if (msg.key && msg.key.remoteJid === 'status@broadcast') {
                await markStatusRead(sock, msg.key);
                await reactToStatus(sock, msg.key);
                return;
            }
        }

        // Handle direct status updates
        if (status.key && status.key.remoteJid === 'status@broadcast') {
            await markStatusRead(sock, status.key);
            await reactToStatus(sock, status.key);
            return;
        }

        // Handle status in reactions
        if (status.reaction && status.reaction.key.remoteJid === 'status@broadcast') {
            await markStatusRead(sock, status.reaction.key);
            await reactToStatus(sock, status.reaction.key);
            return;
        }

    } catch (error) {
        console.error('❌ Error in auto status view:', error.message);
    }
}

module.exports = {
    autoStatusCommand,
    handleStatusUpdate
};
