'use strict';
const axios = require('axios');

async function dadjoke(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 8000 });
        await sock.sendMessage(chatId, { text: `😂 *DAD JOKE*\n\n${data.joke}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch a dad joke.' }, { quoted: message }); }
}

async function chuckCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: 8000 });
        await sock.sendMessage(chatId, { text: `💪 *CHUCK NORRIS JOKE*\n\n${data.value}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch a Chuck Norris joke.' }, { quoted: message }); }
}

async function programmingJokeCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://v2.jokeapi.dev/joke/Programming?blacklistFlags=nsfw,racist', { timeout: 8000 });
        const text = data.type === 'twopart' ? `${data.setup}\n\n${data.delivery}` : data.joke;
        await sock.sendMessage(chatId, { text: `💻 *PROGRAMMING JOKE*\n\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch a programming joke.' }, { quoted: message }); }
}

async function yomammaCommand(sock, chatId, message) {
    const jokes = [
        'Yo mama so fat, when she sat on an iPhone, she made the iPad!',
        'Yo mama so old, her birth certificate says "Expired".',
        'Yo mama so slow, she got outrun by a turtle on a treadmill.',
        'Yo mama so clumsy, she tripped over a wireless network.',
        'Yo mama so old, she knew Burger King when he was still a prince.',
        'Yo mama so big, she uses Google Maps to find her way around herself.',
        'Yo mama so forgetful, she called you the wrong name on your birthday.',
        'Yo mama so short, she does backflips under the bed.',
        'Yo mama so loud, she broke the sound barrier with a sneeze.',
        'Yo mama so slow, her internet connection is faster than her.',
        'Yo mama so old, her selfie is a painting.',
        'Yo mama so big, she needs two time zones to fit in.',
        'Yo mama so silly, she put her phone on airplane mode and tried to fly.',
        'Yo mama so lazy, she got a remote control for her remote control.',
        'Yo mama so unlucky, even her imaginary friends unfollowed her.',
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    await sock.sendMessage(chatId, { text: `😆 *YO MAMA JOKE*\n\n${joke}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function darkJokeCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://v2.jokeapi.dev/joke/Dark?blacklistFlags=racist', { timeout: 8000 });
        const text = data.type === 'twopart' ? `${data.setup}\n\n${data.delivery}` : data.joke;
        await sock.sendMessage(chatId, { text: `🌑 *DARK JOKE*\n\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch a dark joke.' }, { quoted: message }); }
}

module.exports = { dadjoke, chuckCommand, programmingJokeCommand, yomammaCommand, darkJokeCommand };
