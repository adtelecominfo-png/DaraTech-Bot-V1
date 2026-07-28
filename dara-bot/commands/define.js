'use strict';
const axios = require('axios');

const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

async function defineCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const word = text.split(' ').slice(1).join(' ').trim();
    if (!word) return sock.sendMessage(chatId, { text: '📖 Usage: $define <word>\nExample: $define serendipity' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '📖 Searching dictionary……' }, { quoted: message });
        const { data } = await axios.get(`${BASE}/${encodeURIComponent(word)}`, { timeout: 10000 });
        const entry = data[0];
        const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
        const meanings = entry.meanings?.slice(0, 2) || [];
        let txt = `╭━═『 📖 *DEFINE* 』═━╮\n┃ 🔤 *Word:* ${entry.word}\n`;
        if (phonetic) txt += `┃ 🔊 *Phonetic:* ${phonetic}\n`;
        txt += `╰━━━━━━━━━━━━━━━━━╯\n\n`;
        for (const m of meanings) {
            txt += `*${m.partOfSpeech.toUpperCase()}*\n`;
            const defs = m.definitions?.slice(0, 2) || [];
            defs.forEach((d, i) => {
                txt += `${i + 1}. ${d.definition}\n`;
                if (d.example) txt += `   _"${d.example}"_\n`;
            });
            txt += '\n';
        }
        txt += `_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ No definition found for "*${word}*".` }, { quoted: message });
    }
}

async function synonymCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const word = text.split(' ').slice(1).join(' ').trim();
    if (!word) return sock.sendMessage(chatId, { text: '🔁 Usage: $synonym <word>' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '🔁 Searching synonyms……' }, { quoted: message });
        const { data } = await axios.get(`${BASE}/${encodeURIComponent(word)}`, { timeout: 10000 });
        const syns = [];
        for (const m of (data[0]?.meanings || [])) {
            for (const d of (m.synonyms || [])) { if (!syns.includes(d)) syns.push(d); }
            for (const d of (m.definitions || [])) {
                for (const s of (d.synonyms || [])) { if (!syns.includes(s)) syns.push(s); }
            }
        }
        if (!syns.length) return sock.sendMessage(chatId, { text: `❌ No synonyms found for "*${word}*".` }, { quoted: message });
        await sock.sendMessage(chatId, {
            text: `🔁 *SYNONYMS for "${word}"*\n\n${syns.slice(0, 20).join(' · ')}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ No synonyms found for "*${word}*".` }, { quoted: message });
    }
}

async function antonymCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const word = text.split(' ').slice(1).join(' ').trim();
    if (!word) return sock.sendMessage(chatId, { text: '↔️ Usage: $antonym <word>' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '↔️ Searching antonyms……' }, { quoted: message });
        const { data } = await axios.get(`${BASE}/${encodeURIComponent(word)}`, { timeout: 10000 });
        const ants = [];
        for (const m of (data[0]?.meanings || [])) {
            for (const d of (m.antonyms || [])) { if (!ants.includes(d)) ants.push(d); }
            for (const d of (m.definitions || [])) {
                for (const a of (d.antonyms || [])) { if (!ants.includes(a)) ants.push(a); }
            }
        }
        if (!ants.length) return sock.sendMessage(chatId, { text: `❌ No antonyms found for "*${word}*".` }, { quoted: message });
        await sock.sendMessage(chatId, {
            text: `↔️ *ANTONYMS for "${word}"*\n\n${ants.slice(0, 20).join(' · ')}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ No antonyms found for "*${word}*".` }, { quoted: message });
    }
}

async function wordofdayCommand(sock, chatId, message) {
    // Pick a word of the day based on day number (deterministic but changes daily)
    const words = ['ephemeral','serendipity','melancholy','luminous','tenacious','benevolent','cacophony','eloquent','fortitude','gossamer','halcyon','ineffable','jubilant','kaleidoscope','laconic','mirth','nebulous','opulent','panacea','quixotic','resilient','sanguine','temerity','ubiquitous','vivacious','whimsy','xenial','yearning','zealous','aberrant','bucolic','cogent','didactic','evanescent','facetious','gratuitous','hedonism','iconoclast','juxtapose'];
    const today = new Date();
    const dayIndex = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const word = words[dayIndex % words.length];
    try {
        await sock.sendMessage(chatId, { text: '📅 Fetching word of the day……' }, { quoted: message });
        const { data } = await axios.get(`${BASE}/${word}`, { timeout: 10000 });
        const entry = data[0];
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition || 'No definition available.';
        await sock.sendMessage(chatId, {
            text: `📅 *WORD OF THE DAY*\n\n🔤 *${word.toUpperCase()}*\n📖 _${meaning?.partOfSpeech || 'word'}_\n\n${def}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `📅 *WORD OF THE DAY:* ${word.toUpperCase()}\n\n_Daratech_ ⚡` }, { quoted: message });
    }
}

module.exports = { defineCommand, synonymCommand, antonymCommand, wordofdayCommand };
