const fetch = require('node-fetch');
const store = require('../lib/lightweight_store');

async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await sock.sendMessage(chatId, { text: '🌐 Translating……' }, { quoted: message });

        let textToTranslate = '';
        let lang = '';

        const USAGE = `*TRANSLATOR*\n\nUsage:\n1. Reply to a message: *$translate <lang>*\n2. Direct: *$translate <text> | <lang>*\n\nExamples:\n_$translate hello | fr_\n_$translate buenos días | en_\n\nLanguage codes:\nen - English\nfr - French\nes - Spanish\nde - German\nit - Italian\npt - Portuguese\nru - Russian\nja - Japanese\nko - Korean\nzh - Chinese\nar - Arabic\nhi - Hindi\nha - Hausa\nyo - Yoruba\nig - Igbo\ntpi - Tok Pisin`;

        const query = match.trim();

        // ── Find contextInfo from any message type ────────────────────────────
        const msgContent = message.message || {};

        function findContextInfo(mc) {
            const direct =
                mc.extendedTextMessage?.contextInfo ||
                mc.imageMessage?.contextInfo ||
                mc.videoMessage?.contextInfo ||
                mc.audioMessage?.contextInfo ||
                mc.documentMessage?.contextInfo ||
                mc.stickerMessage?.contextInfo ||
                mc.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
                mc.viewOnceMessage?.message?.extendedTextMessage?.contextInfo ||
                mc.viewOnceMessageV2?.message?.extendedTextMessage?.contextInfo;
            if (direct) return direct;
            // Generic scan — covers any wrapping type
            for (const key of Object.keys(mc)) {
                const val = mc[key];
                if (val && typeof val === 'object') {
                    if (val.contextInfo) return val.contextInfo;
                    for (const k2 of Object.keys(val)) {
                        const v2 = val[k2];
                        if (v2 && typeof v2 === 'object' && v2.contextInfo) return v2.contextInfo;
                    }
                }
            }
            return null;
        }

        const contextInfo = findContextInfo(msgContent);

        // ── Extract text from a message object ────────────────────────────────
        function extractText(msg) {
            if (!msg) return '';
            // Could be a quotedMessage payload or a full stored message
            const m = msg.message || msg;
            return (
                m.conversation ||
                m.extendedTextMessage?.text ||
                m.imageMessage?.caption ||
                m.videoMessage?.caption ||
                m.documentMessage?.caption ||
                m.buttonsMessage?.contentText ||
                m.listMessage?.description ||
                m.ephemeralMessage?.message?.conversation ||
                m.ephemeralMessage?.message?.extendedTextMessage?.text ||
                ''
            );
        }

        // ── Resolve quoted message ────────────────────────────────────────────
        // When replying to a fromMe message, WhatsApp omits quotedMessage and only
        // sends a stanzaId reference. Look it up from the local message store.
        let quotedText = '';

        if (contextInfo) {
            const qm = contextInfo.quotedMessage;
            if (qm) {
                quotedText = extractText(qm);
            }

            if (!quotedText && contextInfo.stanzaId) {
                // Try store lookup — covers fromMe quoted messages
                try {
                    const storedMsg = await store.loadMessage(chatId, contextInfo.stanzaId);
                    if (storedMsg) quotedText = extractText(storedMsg);
                } catch (_) {}
            }
        }

        if (quotedText) {
            // ── Reply mode ────────────────────────────────────────────────────
            lang = query;
            textToTranslate = quotedText;

            if (!lang) {
                return sock.sendMessage(chatId, {
                    text: `❌ Please provide a language code.\nExample: *$translate en*`,
                }, { quoted: message });
            }

        } else {
            // ── Direct mode ───────────────────────────────────────────────────
            if (query.includes('|')) {
                const parts = query.split('|');
                lang = parts.pop().trim();
                textToTranslate = parts.join('|').trim();
            } else {
                // If it looks like a bare lang code the user meant reply mode but
                // the quoted message wasn't stored — give a clear error.
                const looksLikeLangCode = /^[a-zA-Z]{2,5}$/.test(query);
                if (looksLikeLangCode) {
                    // Debug: show what we actually see in the message structure
                    const mc = message.message || {};
                    const ci = findContextInfo(mc);
                    const msgTopKeys = Object.keys(message).join(', ');
                    const etm = mc.extendedTextMessage || {};
                    const debugInfo = [
                        `msg keys: ${msgTopKeys}`,
                        `msg.quoted: ${JSON.stringify(message.quoted)?.slice(0, 100)}`,
                        `msg.msg keys: ${message.msg ? Object.keys(message.msg).join(', ') : 'none'}`,
                        `msg.msg.contextInfo: ${JSON.stringify(message.msg?.contextInfo)?.slice(0, 120)}`,
                        `etm keys: ${Object.keys(etm).join(', ')}`,
                        `etm.contextInfo: ${JSON.stringify(etm.contextInfo)?.slice(0, 120)}`,
                    ].filter(Boolean).join('\n');
                    return sock.sendMessage(chatId, {
                        text: `❌ Couldn't read the quoted message.\n\n_Debug:_\n${debugInfo}\n\nOr paste directly:\n*$translate text here | ${query}*`,
                    }, { quoted: message });
                }

                const args = query.split(/\s+/);
                if (args.length < 2) {
                    return sock.sendMessage(chatId, { text: USAGE }, { quoted: message });
                }
                lang = args.pop();
                textToTranslate = args.join(' ');
            }
        }

        if (!textToTranslate || !lang) {
            return sock.sendMessage(chatId, { text: USAGE }, { quoted: message });
        }

        // ── Translation API chain ─────────────────────────────────────────────
        let translatedText = null;

        // API 1 — Google Translate (unofficial)
        try {
            const res = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(textToTranslate)}`
            );
            if (res.ok) {
                const data = await res.json();
                if (data?.[0]?.[0]?.[0]) translatedText = data[0][0][0];
            }
        } catch (_) {}

        // API 2 — MyMemory
        if (!translatedText) {
            try {
                const res = await fetch(
                    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${lang}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data?.responseData?.translatedText) translatedText = data.responseData.translatedText;
                }
            } catch (_) {}
        }

        // API 3 — Dreaded
        if (!translatedText) {
            try {
                const res = await fetch(
                    `https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${lang}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data?.translated) translatedText = data.translated;
                }
            } catch (_) {}
        }

        if (!translatedText) throw new Error('All translation APIs failed');

        await sock.sendMessage(chatId, { text: translatedText }, { quoted: message });

    } catch (error) {
        console.error('❌ Error in translate command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ Failed to translate. Try:\n*$translate hello | fr*\n\nOr reply to a message with:\n*$translate fr*',
            quoted: message,
        });
    }
}

module.exports = { handleTranslateCommand };
