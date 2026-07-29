'use strict';
const axios = require('axios');

/**
 * $get <url> — fetch data, images, videos, audio, JSON or files from any URL
 * Aliases: $fetch, $api
 */
async function getCommand(sock, chatId, message) {
    const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        '';
    const url = text.split(' ').slice(1).join(' ').trim();

    if (!url) {
        return sock.sendMessage(chatId, {
            text:
`┌─〔 🌐 *API FETCHER* 〕
├◆ 📌 Usage: *$get <url>*
├◆ 🧪 Examples:
│   $get https://api.example.com/data
│   $get https://example.com/image.jpg
│   $get https://example.com/video.mp4
└─────────────◆`,
        }, { quoted: message });
    }

    if (!/^https?:\/\//i.test(url)) {
        return sock.sendMessage(chatId, {
            text: '❌ Please provide a valid URL starting with http:// or https://',
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Daratech-Bot/1.0',
                'Accept': '*/*',
            },
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        const contentType = (res.headers['content-type'] || '').toLowerCase();
        const rawData = Buffer.from(res.data);

        // ── Try to detect JSON even without correct content-type header ──────────
        let isJson = false;
        let parsedJson = null;
        try {
            const preview = rawData.slice(0, 300).toString();
            if (preview.trim().startsWith('{') || preview.trim().startsWith('[')) {
                parsedJson = JSON.parse(rawData.toString());
                isJson = true;
            }
        } catch { /* not JSON */ }

        // ── JSON ──────────────────────────────────────────────────────────────────
        if (contentType.includes('application/json') || isJson) {
            const formatted = JSON.stringify(
                parsedJson || JSON.parse(rawData.toString()),
                null, 2
            );
            const truncated = formatted.length > 3000
                ? formatted.slice(0, 3000) + '\n...(truncated)'
                : formatted;
            await sock.sendMessage(chatId, {
                text: `🌐 *API RESPONSE*\n📡 ${url.slice(0, 80)}\n\n\`\`\`\n${truncated}\n\`\`\``,
            }, { quoted: message });

        // ── IMAGE ─────────────────────────────────────────────────────────────────
        } else if (contentType.startsWith('image/')) {
            await sock.sendMessage(chatId, {
                image: rawData,
                caption: `🖼️ *IMAGE FETCHED*\n🌐 Source: ${url}`,
            }, { quoted: message });

        // ── AUDIO ─────────────────────────────────────────────────────────────────
        } else if (contentType.startsWith('audio/')) {
            await sock.sendMessage(chatId, {
                audio: rawData,
                mimetype: contentType || 'audio/mpeg',
                ptt: false,
            }, { quoted: message });

        // ── VIDEO ─────────────────────────────────────────────────────────────────
        } else if (contentType.startsWith('video/')) {
            await sock.sendMessage(chatId, {
                video: rawData,
                mimetype: contentType || 'video/mp4',
                caption: `🎥 *VIDEO FETCHED*\n🌐 Source: ${url}`,
            }, { quoted: message });

        // ── OTHER / BINARY FILES ──────────────────────────────────────────────────
        } else {
            const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
            await sock.sendMessage(chatId, {
                document: rawData,
                mimetype: contentType || 'application/octet-stream',
                fileName: `response.${ext}`,
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('[GET CMD ERROR]', err.message);

        let errorMessage = '❌ Unknown error occurred.';
        if (err.response)       errorMessage = `❌ API responded with status ${err.response.status}`;
        else if (err.request)   errorMessage = '⚠️ No response received from the server.';
        else if (err.message)   errorMessage = `❌ ${err.message}`;

        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `❌ *FETCH FAILED*\n${errorMessage}`,
        }, { quoted: message });
    }
}

module.exports = getCommand;
