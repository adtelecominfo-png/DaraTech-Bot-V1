'use strict';
const axios = require('axios');

async function apodCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', { timeout: 15000 });
        const txt =
            `╭━═『 🌌 *NASA — APOD* 』═━╮\n` +
            `┃ 🔭 *${data.title}*\n` +
            `┃ 📅 *Date:* ${data.date}\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
            `${(data.explanation || '').slice(0, 600)}${data.explanation?.length > 600 ? '...' : ''}\n\n` +
            `_Daratech_ ⚡`;
        const imgUrl = data.url;
        if (imgUrl && (imgUrl.endsWith('$jpg') || imgUrl.endsWith('$png') || imgUrl.endsWith('$jpeg'))) {
            await sock.sendMessage(chatId, { image: { url: imgUrl }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt + (imgUrl ? `\n\n🔗 ${imgUrl}` : '') }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch NASA APOD right now.' }, { quoted: message });
    }
}

async function issLocationCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('http://api.open-notify.org/iss-now.json', { timeout: 8000 });
        const { latitude, longitude } = data.iss_position;
        const txt =
            `🛸 *ISS LOCATION — RIGHT NOW*\n\n` +
            `📍 *Latitude:* ${parseFloat(latitude).toFixed(4)}°\n` +
            `📍 *Longitude:* ${parseFloat(longitude).toFixed(4)}°\n` +
            `🗺️ *Map:* https://maps.google.com/?q=${latitude},${longitude}\n\n` +
            `_The ISS orbits Earth every ~90 minutes at ~28,000 km/h_\n\n_Daratech_ ⚡`;
        await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch ISS location.' }, { quoted: message });
    }
}

async function spacefactCommand(sock, chatId, message) {
    const facts = [
        'A day on Venus is longer than a year on Venus. It takes 243 Earth days to rotate once, but only 225 Earth days to orbit the Sun.',
        'Neutron stars are so dense that a teaspoon of their material would weigh about a billion tons.',
        'The Sun makes up 99.86% of the total mass of our solar system.',
        'There are more stars in the universe than grains of sand on all of Earth\'s beaches.',
        'The footprints left by Apollo astronauts on the Moon will remain there for at least 100 million years.',
        'Light from the Sun takes about 8 minutes to reach Earth — traveling at 300,000 km/s.',
        'Saturn\'s rings are made mostly of ice and rock and are only about 10 meters thick on average.',
        'The Milky Way galaxy is about 100,000 light-years across.',
        'A black hole\'s gravity is so strong that not even light can escape it.',
        'Mars has the tallest volcano in the solar system — Olympus Mons, 3× the height of Mount Everest.',
        'Jupiter has 95 known moons — more than any other planet.',
        'The universe is about 13.8 billion years old.',
        'One million Earths could fit inside the Sun.',
        'Pluto is smaller than the United States.',
        'The temperature on the Moon swings from -173°C at night to 127°C during the day.',
    ];
    const fact = facts[Math.floor(Math.random() * facts.length)];
    await sock.sendMessage(chatId, { text: `🌌 *SPACE FACT*\n\n${fact}\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { apodCommand, issLocationCommand, spacefactCommand };
