const gTTS = require('gtts');
const fs   = require('fs');
const path = require('path');

async function ttsCommand(sock, chatId, text, message, language = 'en') {
    if (!text) {
        await sock.sendMessage(chatId, { text: 'Please provide the text for TTS conversion.' });
        return;
    }

    const tmpDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const fileName = `tts-${Date.now()}.mp3`;
    const filePath = path.join(tmpDir, fileName);

    await sock.sendMessage(chatId, { text: '🗣️ Converting text to speech…' }, { quoted: message });

    const gtts = new gTTS(text, language);

    await new Promise((resolve, reject) => {
        gtts.save(filePath, err => (err ? reject(err) : resolve()));
    });

    try {
        // Read file into Buffer — WhatsApp cannot fetch a local file via URL
        const audioBuf = fs.readFileSync(filePath);
        await sock.sendMessage(chatId, {
            audio:    audioBuf,
            mimetype: 'audio/mpeg',
            ptt:      false,
        }, { quoted: message });
    } finally {
        // Always clean up temp file
        try { fs.unlinkSync(filePath); } catch {}
    }
}

module.exports = ttsCommand;
