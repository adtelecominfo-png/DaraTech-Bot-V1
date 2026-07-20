const fetch = require('node-fetch');

async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await sock.sendMessage(chatId, { text: '🌐 Translating……' }, { quoted: message });

        let textToTranslate = '';
        let lang = '';

        const USAGE = `*TRANSLATOR*\n\nUsage:\n1. Reply to a message: *$translate <lang>*\n2. Direct: *$translate <text> | <lang>*\n\nExamples:\n_$translate hello | fr_\n_$translate buenos días | en_\n\nLanguage codes:\nen - English\nfr - French\nes - Spanish\nde - German\nit - Italian\npt - Portuguese\nru - Russian\nja - Japanese\nko - Korean\nzh - Chinese\nar - Arabic\nhi - Hindi\nha - Hausa\nyo - Yoruba\nig - Igbo\ntpi - Tok Pisin`;

        const query = match.trim();

        // ── Extract contextInfo from ANY message type ─────────────────────────
        const msgContent = message.message || {};

        function findContextInfo(mc) {
            // Check all known types that carry contextInfo
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

            // Generic scan: check every top-level key for a contextInfo property
            for (const key of Object.keys(mc)) {
                const val = mc[key];
                if (val && typeof val === 'object') {
                    if (val.contextInfo) return val.contextInfo;
                    // one level deeper (e.g. wrapping messages)
                    for (const k2 of Object.keys(val)) {
                        const v2 = val[k2];
                        if (v2 && typeof v2 === 'object' && v2.contextInfo) return v2.contextInfo;
                    }
                }
            }
            return null;
        }

        const contextInfo = findContextInfo(msgContent);
        const quotedMessage = contextInfo?.quotedMessage || null;

        // ── Extract text from quoted message (all common sub-types) ───────────
        function quotedText(qm) {
            if (!qm) return '';
            return (
                qm.conversation ||
                qm.extendedTextMessage?.text ||
                qm.imageMessage?.caption ||
                qm.videoMessage?.caption ||
                qm.documentMessage?.caption ||
                qm.buttonsMessage?.contentText ||
                qm.listMessage?.description ||
                qm.ephemeralMessage?.message?.conversation ||
                qm.ephemeralMessage?.message?.extendedTextMessage?.text ||
                ''
            );
        }

        if (quotedMessage) {
            // ── Reply mode: $translate <lang> ─────────────────────────────────
            textToTranslate = quotedText(quotedMessage);
            lang = query;

            if (!textToTranslate) {
                return sock.sendMessage(chatId, {
                    text: `❌ Couldn't read the quoted message text.\nTry: *$translate <text> | ${lang || 'en'}*`,
                }, { quoted: message });
            }
            if (!lang) {
                return sock.sendMessage(chatId, {
                    text: `❌ Please provide a language code.\nExample: *$translate en*`,
                }, { quoted: message });
            }

        } else {
            // ── Direct mode: $translate <text> | <lang> ───────────────────────
            if (query.includes('|')) {
                const parts = query.split('|');
                lang = parts.pop().trim();
                textToTranslate = parts.join('|').trim();
            } else {
                // If input looks like a plain lang code (no spaces, ≤5 chars),
                // the user almost certainly meant reply mode but the reply wasn't detected.
                const looksLikeLangCode = /^[a-zA-Z]{2,5}$/.test(query);
                if (looksLikeLangCode) {
                    return sock.sendMessage(chatId, {
                        text: `❌ No quoted message found.\n\nTo translate, *reply* to the message you want to translate, then send:\n*$translate ${query}*\n\nOr translate text directly:\n*$translate Hello world | ${query}*`,
                    }, { quoted: message });
                }

                // Legacy: last space-separated token is the lang
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

        // ── Try translation APIs in sequence ──────────────────────────────────
        let translatedText = null;

        // API 1 — Google Translate (unofficial)
        try {
            const response = await fetch(
                `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(lang)}&dt=t&q=${encodeURIComponent(textToTranslate)}`
            );
            if (response.ok) {
                const data = await response.json();
                if (data?.[0]?.[0]?.[0]) translatedText = data[0][0][0];
            }
        } catch (_) {}

        // API 2 — MyMemory
        if (!translatedText) {
            try {
                const response = await fetch(
                    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${lang}`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data?.responseData?.translatedText) translatedText = data.responseData.translatedText;
                }
            } catch (_) {}
        }

        // API 3 — Dreaded
        if (!translatedText) {
            try {
                const response = await fetch(
                    `https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${lang}`
                );
                if (response.ok) {
                    const data = await response.json();
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
