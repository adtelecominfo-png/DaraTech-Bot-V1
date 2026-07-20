'use strict';
const axios = require('axios');

async function loremCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const count = parseInt(text.split(' ')[1]) || 1;
    const sentences = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
        'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.',
        'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet.',
        'Ut labore et dolore magnam aliquam quaerat voluptatem.',
        'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.',
        'Nam libero tempore cum soluta nobis eligendi optio cumque nihil impedit.',
    ];
    const n = Math.min(Math.max(count, 1), 10);
    const result = Array.from({ length: n }, (_, i) => sentences[i % sentences.length]).join(' ');
    await sock.sendMessage(chatId, { text: `📝 *LOREM IPSUM* (${n} sentence${n > 1 ? 's' : ''})\n\n${result}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function fakenameCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://randomuser.me/api/?nat=us,gb,au,ca', { timeout: 10000 });
        const u = data.results?.[0];
        if (!u) throw new Error('no user');
        const name = `${u.name.first} ${u.name.last}`;
        const email = u.email;
        const phone = u.phone;
        const location = `${u.location.city}, ${u.location.country}`;
        const dob = u.dob?.date?.split('T')[0] || '-';
        const gender = u.gender;
        await sock.sendMessage(chatId, {
            image: { url: u.picture.large },
            caption:
                `👤 *RANDOM PERSON*\n\n` +
                `▸ 👤 *Name:* ${name}\n` +
                `▸ ⚧️ *Gender:* ${gender}\n` +
                `▸ 🎂 *DOB:* ${dob}\n` +
                `▸ 📧 *Email:* ${email}\n` +
                `▸ 📞 *Phone:* ${phone}\n` +
                `▸ 📍 *Location:* ${location}\n\n` +
                `⚠️ _This is a randomly generated fake identity._\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not generate a fake name.' }, { quoted: message });
    }
}

async function genemailCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const name = text.split(' ').slice(1).join('').toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'proton.me', 'icloud.com'];
    const suffixes = ['', '123', '99', '_2', '$biz', '007', String(Math.floor(Math.random() * 999))];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const email = `${name}${suffix}@${domain}`;
    await sock.sendMessage(chatId, {
        text: `📧 *GENERATED EMAIL*\n\n\`${email}\`\n\n⚠️ _This is a generated email, not a real account._\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function randomnumCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const parts = text.split(' ').slice(1);
    const min = parseInt(parts[0]) || 1;
    const max = parseInt(parts[1]) || 100;
    if (min >= max) return sock.sendMessage(chatId, { text: '🎲 Usage: $randomnum <min> <max>\nExample: $randomnum 1 100' }, { quoted: message });
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    await sock.sendMessage(chatId, {
        text: `🎲 *RANDOM NUMBER*\n\nRange: ${min} – ${max}\nResult: *${result}*\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function coinflipCommand(sock, chatId, message) {
    const result = Math.random() > 0.5 ? '🪙 HEADS' : '🪙 TAILS';
    await sock.sendMessage(chatId, { text: `🪙 *COIN FLIP*\n\n*${result}*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function dicerollCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const sides = parseInt(text.split(' ')[1]) || 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await sock.sendMessage(chatId, { text: `🎲 *DICE ROLL* (d${sides})\n\nYou rolled: *${result}*\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { loremCommand, fakenameCommand, genemailCommand, randomnumCommand, coinflipCommand, dicerollCommand };
