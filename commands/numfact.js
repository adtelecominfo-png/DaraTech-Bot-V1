'use strict';
const axios = require('axios');

async function numfactCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const num = text.split(' ')[1]?.trim() || Math.floor(Math.random() * 1000).toString();
    try {
        const { data } = await axios.get(`http://numbersapi.com/${num}?json=true`, { timeout: 8000 });
        await sock.sendMessage(chatId, {
            text: `🔢 *NUMBER FACT — ${num}*\n\n${data.text}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Could not fetch a fact for ${num}.` }, { quoted: message });
    }
}

async function datefactCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const input = text.split(' ').slice(1).join(' ').trim();
    const today = new Date();
    const dateStr = input || `${today.getMonth() + 1}/${today.getDate()}`;
    const [month, day] = dateStr.split('/');
    if (!month || !day) return sock.sendMessage(chatId, { text: '📅 Usage: $datefact <month/day>\nExample: $datefact 7/4' }, { quoted: message });
    try {
        const { data } = await axios.get(`http://numbersapi.com/${month}/${day}/date?json=true`, { timeout: 8000 });
        await sock.sendMessage(chatId, {
            text: `📅 *DATE FACT — ${month}/${day}*\n\n${data.text}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch date fact.' }, { quoted: message });
    }
}

async function yearfactCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const year = text.split(' ')[1]?.trim() || new Date().getFullYear().toString();
    try {
        const { data } = await axios.get(`http://numbersapi.com/${year}/year?json=true`, { timeout: 8000 });
        await sock.sendMessage(chatId, {
            text: `📆 *YEAR FACT — ${year}*\n\n${data.text}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Could not fetch year fact for ${year}.` }, { quoted: message });
    }
}

async function mathfactCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const num = text.split(' ')[1]?.trim() || Math.floor(Math.random() * 500).toString();
    try {
        const { data } = await axios.get(`http://numbersapi.com/${num}/math?json=true`, { timeout: 8000 });
        await sock.sendMessage(chatId, {
            text: `➕ *MATH FACT — ${num}*\n\n${data.text}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: `❌ Could not fetch math fact for ${num}.` }, { quoted: message });
    }
}

module.exports = { numfactCommand, datefactCommand, yearfactCommand, mathfactCommand };
