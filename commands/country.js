'use strict';
const axios = require('axios');

async function countryCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const name = text.split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, { text: '🌍 Usage: .country <name>\nExample: .country Nigeria' }, { quoted: message });
    try {
        const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 10000 });
        const c = data[0];
        const currencies = Object.values(c.currencies || {}).map(v => `${v.name} (${v.symbol || '-'})`).join(', ') || '-';
        const languages = Object.values(c.languages || {}).join(', ') || '-';
        const capital = (c.capital || []).join(', ') || '-';
        const pop = (c.population || 0).toLocaleString();
        const area = (c.area || 0).toLocaleString();
        const region = `${c.region || '-'} / ${c.subregion || '-'}`;
        const txt =
            `╭━═『 🌍 *COUNTRY INFO* 』═━╮\n` +
            `┃ 🏴 *${c.name?.common || name}* (${c.cca2 || '-'})\n` +
            `┃ 🗺️ *Official:* ${c.name?.official || '-'}\n` +
            `┃ 🏙️ *Capital:* ${capital}\n` +
            `┃ 🌐 *Region:* ${region}\n` +
            `┃ 👥 *Population:* ${pop}\n` +
            `┃ 📐 *Area:* ${area} km²\n` +
            `┃ 💰 *Currency:* ${currencies}\n` +
            `┃ 🗣️ *Languages:* ${languages}\n` +
            `┃ 📞 *Dial:* +${(c.idd?.root || '') + (c.idd?.suffixes?.[0] || '')}\n` +
            `┃ 🚗 *Drive:* ${c.car?.side || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`;
        const flag = c.flags?.png || c.flags?.svg;
        if (flag) {
            await sock.sendMessage(chatId, { image: { url: flag }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Country "*${name}*" not found.` }, { quoted: message });
    }
}

async function capitalCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const name = text.split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, { text: '🏙️ Usage: .capital <country>' }, { quoted: message });
    try {
        const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 10000 });
        const c = data[0];
        const capital = (c.capital || ['Unknown']).join(', ');
        await sock.sendMessage(chatId, {
            text: `🏙️ The capital of *${c.name?.common}* is *${capital}* ${c.flag || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Country "*${name}*" not found.` }, { quoted: message });
    }
}

async function flagCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const name = text.split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, { text: '🚩 Usage: .flag <country>' }, { quoted: message });
    try {
        const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 10000 });
        const c = data[0];
        const flag = c.flags?.png || c.flags?.svg;
        if (!flag) return sock.sendMessage(chatId, { text: `❌ No flag found for "*${name}*".` }, { quoted: message });
        await sock.sendMessage(chatId, {
            image: { url: flag },
            caption: `🚩 *Flag of ${c.name?.common}* ${c.flag || ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Country "*${name}*" not found.` }, { quoted: message });
    }
}

async function timezoneCountryCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const name = text.split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, { text: '🕐 Usage: .countrytime <country>' }, { quoted: message });
    try {
        const { data } = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 10000 });
        const c = data[0];
        const zones = (c.timezones || []).join(', ') || '-';
        await sock.sendMessage(chatId, {
            text: `🕐 *${c.name?.common}* timezone(s):\n\n${zones}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Country "*${name}*" not found.` }, { quoted: message });
    }
}

module.exports = { countryCommand, capitalCommand, flagCommand, timezoneCountryCommand };
