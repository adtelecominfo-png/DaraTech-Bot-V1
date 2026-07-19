'use strict';
const axios = require('axios');

// Emoji Kitchen metadata from xsalazar/emoji-kitchen-backend
// Cached in memory for the lifetime of the process
let _metaCache = null;
let _metaFetchedAt = 0;
const META_URL = 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getMeta() {
    const now = Date.now();
    if (_metaCache && now - _metaFetchedAt < CACHE_TTL) return _metaCache;
    const { data } = await axios.get(META_URL, { timeout: 15000 });
    _metaCache = data.data;
    _metaFetchedAt = now;
    return _metaCache;
}

/**
 * Convert an emoji string to its primary Unicode codepoint (hex, no leading u).
 * Handles multi-codepoint sequences — uses only the first scalar.
 */
function emojiToCodepoint(emoji) {
    const cp = emoji.codePointAt(0);
    return cp ? cp.toString(16) : null;
}

/**
 * Look up the gstatic URL for an emoji pair from the metadata.
 * Tries both orderings (e1+e2 and e2+e1).
 */
async function getKitchenUrl(emoji1, emoji2) {
    const meta = await getMeta();
    const cp1 = emojiToCodepoint(emoji1);
    const cp2 = emojiToCodepoint(emoji2);
    if (!cp1 || !cp2) return null;

    // Try cp1 → cp2
    const entry1 = meta[cp1]?.combinations?.[cp2];
    if (entry1 && entry1.length > 0) return entry1[0].gStaticUrl;

    // Try cp2 → cp1
    const entry2 = meta[cp2]?.combinations?.[cp1];
    if (entry2 && entry2.length > 0) return entry2[0].gStaticUrl;

    return null;
}

async function emojimixCommand(sock, chatId, msg) {
    try {
        const text = msg.message?.conversation?.trim() || msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        if (!args[0] || !args[0].includes('+')) {
            return sock.sendMessage(chatId, {
                text: '🎴 *EMOJI MIX*\n\nUsage: .emojimix 😎+🥰\n\nSeparate two emojis with a *+* sign',
            }, { quoted: msg });
        }

        const [emoji1, emoji2] = args[0].split('+').map(e => e.trim());
        if (!emoji1 || !emoji2) {
            return sock.sendMessage(chatId, { text: '❌ Please provide two emojis. Example: .emojimix 😎+🥰' }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: `🎭 Mixing ${emoji1} + ${emoji2}...` }, { quoted: msg });

        const imgUrl = await getKitchenUrl(emoji1, emoji2);
        if (!imgUrl) {
            return sock.sendMessage(chatId, {
                text: `❌ No mix found for ${emoji1}+${emoji2}. This combination may not exist in Emoji Kitchen.\n\nTry different emojis.`,
            }, { quoted: msg });
        }

        // Download the image and send as sticker-like image
        const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000 });
        await sock.sendMessage(chatId, {
            image: Buffer.from(imgRes.data),
            caption:
                `╭━═『 *EMOJI MIX* 』═━╮\n` +
                `┃ 😂 *Emoji 1:* ${emoji1}\n` +
                `┃ 🙄 *Emoji 2:* ${emoji2}\n` +
                `╰━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`,
        }, { quoted: msg });
    } catch (err) {
        console.error('[emojimix]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to mix emojis. Try different ones.\n\nExample: .emojimix 😎+🥰',
        }, { quoted: msg });
    }
}

module.exports = emojimixCommand;
