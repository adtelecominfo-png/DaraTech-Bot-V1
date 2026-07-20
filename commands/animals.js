'use strict';
const axios = require('axios');

const SRA = 'https://some-random-api.com/animal';

// CF-bypass headers for some-random-api.com endpoints
const SRA_HEADERS = {
    'User-Agent': 'curl/7.68.0',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchImgBuf(url) {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    return Buffer.from(res.data);
}

async function catfactCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://catfact.ninja/fact', { timeout: 8000 });
        await sock.sendMessage(chatId, { text: `🐱 *CAT FACT*\n\n${data.fact}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat fact.' }, { quoted: message });
    }
}

async function catimageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/cat`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🐱 *RANDOM CAT* 🐱\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat image.' }, { quoted: message });
    }
}

async function dogfactCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/dog`, { timeout: 10000 });
        await sock.sendMessage(chatId, { text: `🐶 *DOG FACT*\n\n${data.fact}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog fact.' }, { quoted: message });
    }
}

async function dogimageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/dog`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🐶 *RANDOM DOG* 🐶\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog image.' }, { quoted: message });
    }
}

// ─── $fox — randomfox.ca (primary) + SRA fallback ────────────────────────────

async function foxImageCommand(sock, chatId, message) {
    try {
        let imgUrl, fact = '';
        try {
            const { data } = await axios.get('https://randomfox.ca/floof/', { timeout: 10000 });
            imgUrl = data.image;
        } catch {
            const { data } = await axios.get(`${SRA}/fox`, { timeout: 10000, headers: SRA_HEADERS });
            imgUrl = data.image;
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(imgUrl),
            caption: `🦊 *RANDOM FOX*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch fox image.' }, { quoted: message });
    }
}

// ─── $panda — SRA (CF-bypass headers) ────────────────────────────────────────

async function pandaImageCommand(sock, chatId, message) {
    try {
        let imgUrl, fact = '';
        try {
            // Try SRA with curl-style headers to bypass CF bot check
            const { data } = await axios.get(`${SRA}/panda`, { timeout: 10000, headers: SRA_HEADERS });
            imgUrl = data.image;
            fact   = data.fact || '';
        } catch {
            // Fallback: randomfox.ca won't help for panda, so try SRA with normal headers
            const { data } = await axios.get(`${SRA}/panda`, { timeout: 12000 });
            imgUrl = data.image;
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(imgUrl),
            caption: `🐼 *RANDOM PANDA*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch panda image.' }, { quoted: message });
    }
}

async function koalaImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/koala`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🐨 *RANDOM KOALA*\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch koala image.' }, { quoted: message });
    }
}

// ─── $birb — shibe.online (primary) + SRA fallback ───────────────────────────

async function birbCommand(sock, chatId, message) {
    try {
        let imgUrl, fact = '';
        try {
            // shibe.online returns an array of URLs — fast, reliable, no CF
            const { data } = await axios.get('https://shibe.online/api/birds?count=1', { timeout: 10000 });
            if (!Array.isArray(data) || !data[0]) throw new Error('No bird URL');
            imgUrl = data[0];
        } catch {
            // Fallback to SRA with CF-bypass headers
            const { data } = await axios.get(`${SRA}/birb`, { timeout: 10000, headers: SRA_HEADERS });
            imgUrl = data.image;
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(imgUrl),
            caption: `🐦 *RANDOM BIRD*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch bird image.' }, { quoted: message });
    }
}

// ─── $raccoon — SRA (CF-bypass headers) ──────────────────────────────────────

async function raccoonCommand(sock, chatId, message) {
    try {
        let imgUrl, fact = '';
        try {
            const { data } = await axios.get(`${SRA}/raccoon`, { timeout: 10000, headers: SRA_HEADERS });
            imgUrl = data.image;
            fact   = data.fact || '';
        } catch {
            const { data } = await axios.get(`${SRA}/raccoon`, { timeout: 12000 });
            imgUrl = data.image;
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(imgUrl),
            caption: `🦝 *RANDOM RACCOON*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch raccoon image.' }, { quoted: message });
    }
}

module.exports = { catfactCommand, catimageCommand, dogfactCommand, dogimageCommand, foxImageCommand, pandaImageCommand, koalaImageCommand, birbCommand, raccoonCommand };
