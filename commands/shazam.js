'use strict';
/**
 * shazam.js
 * $shazam | $findsong | $whatsong
 *
 * Reply to an audio or video message to identify the track via AudD.
 * Returns title, artist, album, release date + Spotify / Apple Music links.
 */

const axios = require('axios');
const FormData = require('form-data');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function react(sock, message, emoji) {
    try {
        await sock.sendMessage(message.key.remoteJid, {
            react: { text: emoji, key: message.key }
        });
    } catch {}
}

/** Stream a Baileys media message into a Buffer */
async function mediaToBuffer(mediaMsg, type) {
    const stream = await downloadContentFromMessage(mediaMsg, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function shazamCommand(sock, chatId, message) {
    // ── Resolve audio/video — own message or quoted ──────────────────────
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    const audioMsg = message.message?.audioMessage || quoted?.audioMessage || null;
    const videoMsg = message.message?.videoMessage || quoted?.videoMessage || null;

    if (!audioMsg && !videoMsg) {
        return sock.sendMessage(chatId, {
            text:
                `╭━━━「 🎧 *SHAZAM — SONG FINDER* 」━━━\n` +
                `┃\n` +
                `┃ *Reply to an audio or video clip* with:\n` +
                `┃ $shazam  |  $findsong  |  $whatsong\n` +
                `┃\n` +
                `┃ The bot will identify the track for you!\n` +
                `┃\n` +
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }

    await react(sock, message, '🎧');
    await sock.sendMessage(chatId, {
        text: `🎧 *Listening to the music…*\n_Identifying track via AudD database…_`
    }, { quoted: message });

    try {
        // ── Download media buffer ────────────────────────────────────────
        const mediaMsg  = audioMsg || videoMsg;
        const mediaType = audioMsg ? 'audio' : 'video';
        const buf = await mediaToBuffer(mediaMsg, mediaType);

        // ── Upload to AudD ───────────────────────────────────────────────
        const form = new FormData();
        form.append('file', buf, { filename: 'clip.mp3', contentType: 'audio/mpeg' });
        form.append('api_token', 'test');
        form.append('return', 'apple_music,spotify');

        const { data } = await axios.post('https://api.audd.io/', form, {
            headers: form.getHeaders(),
            timeout: 30000,
        });

        // ── Handle response ──────────────────────────────────────────────
        if (data?.status === 'success' && data.result) {
            const song = data.result;

            let txt = `🎤 *MATCH FOUND!*\n━━━━━━━━━━━━━━━━━━━\n\n`;
            txt += `🎵 *Title:*   ${song.title}\n`;
            txt += `👤 *Artist:*  ${song.artist}\n`;
            txt += `💿 *Album:*   ${song.album}\n`;
            txt += `📅 *Release:* ${song.release_date}\n`;

            if (song.spotify?.external_urls?.spotify) {
                txt += `\n🟢 *Spotify:*     ${song.spotify.external_urls.spotify}`;
            }
            if (song.apple_music?.url) {
                txt += `\n🍎 *Apple Music:* ${song.apple_music.url}`;
            }

            txt += `\n\n_Daratech_ ⚡`;

            const coverUrl = song.song_link || null;

            if (coverUrl) {
                try {
                    await sock.sendMessage(chatId,
                        { image: { url: coverUrl }, caption: txt },
                        { quoted: message });
                } catch {
                    await sock.sendMessage(chatId, { text: txt }, { quoted: message });
                }
            } else {
                await sock.sendMessage(chatId, { text: txt }, { quoted: message });
            }

            await react(sock, message, '✅');

        } else {
            await react(sock, message, '❌');
            await sock.sendMessage(chatId, {
                text: `❌ *No match found.*\n\nThe clip might be too short, too noisy, or not in the database.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

    } catch (err) {
        console.error('[shazam]', err.message);
        await react(sock, message, '❌');
        await sock.sendMessage(chatId, {
            text: `❌ *Shazam failed:* ${err.message}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    }
}

module.exports = shazamCommand;
