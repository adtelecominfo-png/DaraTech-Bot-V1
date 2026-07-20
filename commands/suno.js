// AI music generation via Runflix songgenerator endpoint.
// The endpoint is currently returning 500 (server-side issue).
// The command shows a polite "unavailable" message until it recovers.

async function sunoCommand(sock, chatId, message) {
    await sock.sendMessage(chatId, {
        text: '⚠️ *AI Music Generator*\n\nAI music generation is temporarily unavailable — the upstream provider is down.\n\nTry again later or use *$spotify <song>* to search for existing music.',
    }, { quoted: message });
}

module.exports = sunoCommand;
