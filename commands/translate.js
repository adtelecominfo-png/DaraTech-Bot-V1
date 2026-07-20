const fetch = require('node-fetch');

async function handleTranslateCommand(sock, chatId, message, match) {
    try {
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);
        await sock.sendMessage(chatId, { text: '🌐 Translating……' }, { quoted: message });

        let textToTranslate = '';
        let lang = '';

        const USAGE = `*TRANSLATOR*\n\nUsage:\n1. Reply to a message: *$translate <lang>*\n2. Direct: *$translate <text> | <lang>*\n\nExamples:\n_$translate hello | fr_\n_$translate buenos días | en_\n\nLanguage codes:\nen - English\nfr - French\nes - Spanish\nde - German\nit - Italian\npt - Portuguese\nru - Russian\nja - Japanese\nko - Korean\nzh - Chinese\nar - Arabic\nhi - Hindi\nha - Hausa\nyo - Yoruba\nig - Igbo\ntpi - Tok Pisin`;

        // Extract quoted message from any message type that carries contextInfo
        const msgContent = message.message || {};
        const contextInfo = (
            msgContent.extendedTextMessage?.contextInfo ||
            msgContent.imageMessage?.contextInfo ||
            msgContent.videoMessage?.contextInfo ||
            msgContent.audioMessage?.contextInfo ||
            msgContent.documentMessage?.contextInfo ||
            msgContent.stickerMessage?.contextInfo ||
            null
        );
        const quotedMessage = contextInfo?.quotedMessage || null;

        // Extract text from the quoted message (cover all common types)
        function quotedText(qm) {
            if (!qm) return '';
            return (
                qm.conversation ||
                qm.extendedTextMessage?.text ||
                qm.imageMessage?.caption ||
                qm.videoMessage?.caption ||
                qm.documentMessage?.caption ||
                qm.ephemeralMessage?.message?.conversation ||
                qm.ephemeralMessage?.message?.extendedTextMessage?.text ||
                ''
            );
        }

        if (quotedMessage) {
            textToTranslate = quotedText(quotedMessage);
            lang = match.trim();
        } else {
            // Direct: support both "text | lang" and legacy "text lang" (last word)
            if (match.includes('|')) {
                const parts = match.split('|');
                lang = parts.pop().trim();
                textToTranslate = parts.join('|').trim();
            } else {
                // Legacy: last space-separated token is the language
                const args = match.trim().split(' ');
                if (args.length < 2) {
                    return sock.sendMessage(chatId, { text: USAGE, quoted: message });
                }
                lang = args.pop();
                textToTranslate = args.join(' ');
            }
        }

        if (!textToTranslate || !lang) {
            return sock.sendMessage(chatId, { text: USAGE, quoted: message });
        }

        // Try multiple translation APIs in sequence
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
            text: '❌ Failed to translate. Try: *$translate hello | fr*\n\nOr reply to a message with: *$translate fr*',
            quoted: message
        });
    }
}

module.exports = { handleTranslateCommand };
