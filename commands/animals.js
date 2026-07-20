'use strict';
const axios = require('axios');

const SRA = 'https://some-random-api.com/animal';

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

async function foxImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/fox`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🦊 *RANDOM FOX*\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch fox image.' }, { quoted: message });
    }
}

async function pandaImageCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/panda`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🐼 *RANDOM PANDA*\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
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

async function birbCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/birb`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🐦 *RANDOM BIRD*\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch bird image.' }, { quoted: message });
    }
}

async function raccoonCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/raccoon`, { timeout: 10000 });
        await sock.sendMessage(chatId, {
            image: await fetchImgBuf(data.image),
            caption: `🦝 *RANDOM RACCOON*\n\n💡 ${data.fact || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch raccoon image.' }, { quoted: message });
    }
}

module.exports = { catfactCommand, catimageCommand, dogfactCommand, dogimageCommand, foxImageCommand, pandaImageCommand, koalaImageCommand, birbCommand, raccoonCommand };
