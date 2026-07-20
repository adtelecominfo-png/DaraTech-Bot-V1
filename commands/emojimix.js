'use strict';
const axios = require('axios');
const { toolsGet } = require('../lib/gifted');

// ─── Gstatic Emoji Kitchen fallback ──────────────────────────────────────────
let _metaCache = null;
let _metaFetchedAt = 0;
const META_URL = 'https://raw.githubusercontent.com/xsalazar/emoji-kitchen-backend/main/app/metadata.json';
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getMeta() {
    const now = Date.now();
    if (_metaCache && now - _metaFetchedAt < CACHE_TTL) return _metaCache;
    const { data } = await axios.get(META_URL, { timeout: 15000 });
    _metaCache = data.data;
    _metaFetchedAt = now;
    return _metaCache;
}

function emojiToCodepoint(emoji) {
    const cp = emoji.codePointAt(0);
    return cp ? cp.toString(16) : null;
}

async function getKitchenUrl(emoji1, emoji2) {
    const meta = await getMeta();
    const cp1 = emojiToCodepoint(emoji1);
    const cp2 = emojiToCodepoint(emoji2);
    if (!cp1 || !cp2) return null;
    const entry1 = meta[cp1]?.combinations?.[cp2];
    if (entry1 && entry1.length > 0) return entry1[0].gStaticUrl;
    const entry2 = meta[cp2]?.combinations?.[cp1];
    if (entry2 && entry2.length > 0) return entry2[0].gStaticUrl;
    return null;
}

// ─── Main command ─────────────────────────────────────────────────────────────

async function emojimixCommand(sock, chatId, msg) {
    try {
        const text = msg.message?.conversation?.trim() ||
                     msg.message?.extendedTextMessage?.text?.trim() || '';
        const args = text.split(' ').slice(1);

        if (!args[0] || !args[0].includes('+')) {
            return sock.sendMessage(chatId, {
                text: '🎴 *EMOJI MIX*\n\nUsage: $emojimix 😎+🥰\n\nSeparate two emojis with a *+* sign',
            }, { quoted: msg });
        }

        const [emoji1, emoji2] = args[0].split('+').map(e => e.trim());
        if (!emoji1 || !emoji2) {
            return sock.sendMessage(chatId, {
                text: '❌ Please provide two emojis. Example: $emojimix 😎+🥰',
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, { text: `🎭 Mixing ${emoji1} + ${emoji2}...` }, { quoted: msg });

        let imgBuffer = null;

        // ── Primary: GiftedTech API ───────────────────────────────────────────
        try {
            const data = await toolsGet('emojimix', { emoji1, emoji2 });
            const imgUrl = data?.result || data?.image_url || data?.url;
            if (data?.success && imgUrl) {
                const res = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 15000 });
                imgBuffer = Buffer.from(res.data);
            }
        } catch (_) {
            // fall through to gstatic
        }

        // ── Fallback: Gstatic Emoji Kitchen ──────────────────────────────────
        if (!imgBuffer) {
            const kitchenUrl = await getKitchenUrl(emoji1, emoji2);
            if (kitchenUrl) {
                const res = await axios.get(kitchenUrl, { responseType: 'arraybuffer', timeout: 15000 });
                imgBuffer = Buffer.from(res.data);
            }
        }

        if (!imgBuffer) {
            return sock.sendMessage(chatId, {
                text: `❌ No mix found for ${emoji1}+${emoji2}. This combination may not exist.\n\nTry different emojis.`,
            }, { quoted: msg });
        }

        await sock.sendMessage(chatId, {
            image: imgBuffer,
            caption:
                `╭━═『 *EMOJI MIX* 』═━╮\n` +
                `┃ 😂 *Emoji 1:* ${emoji1}\n` +
                `┃ 🙄 *Emoji 2:* ${emoji2}\n` +
                `╰━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`,
        }, { quoted: msg });

    } catch (err) {
        console.error('[emojimix]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to mix emojis. Try different ones.\n\nExample: $emojimix 😎+🥰',
        }, { quoted: msg });
    }
}

module.exports = emojimixCommand;
