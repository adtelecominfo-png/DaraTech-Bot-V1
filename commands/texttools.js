'use strict';
const crypto = require('crypto');

function getArgs(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    return text.split(' ').slice(1).join(' ').trim();
}

async function reverseCommand(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '🔄 Usage: $reverse <text>' }, { quoted: message });
    await sock.sendMessage(chatId, { text: `🔄 *REVERSED:*\n${input.split('').reverse().join('')}\n\n_Daratech_ ⚡` }, { quoted: message });
}

const MORSE = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.','.':'.-.-.-',',':'--..--','?':'..--..','!':'-.-.--',' ':'/' };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k,v]) => [v,k]));

async function morseCommand(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '📡 Usage: $morse <text>\nExample: $morse Hello World' }, { quoted: message });
    const encoded = input.toUpperCase().split('').map(c => MORSE[c] || c).join(' ');
    await sock.sendMessage(chatId, { text: `📡 *MORSE CODE:*\n${encoded}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function unmorseCommand(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '📡 Usage: $unmorse <morse code>\nExample: $unmorse .... . .-.. .-.. ---' }, { quoted: message });
    const decoded = input.split(' / ').map(word =>
        word.split(' ').map(code => MORSE_REV[code] || '?').join('')
    ).join(' ');
    await sock.sendMessage(chatId, { text: `📡 *DECODED:*\n${decoded}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function binaryCommand(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '💻 Usage: $binary <text>\nExample: $binary Hi' }, { quoted: message });
    const bin = input.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    await sock.sendMessage(chatId, { text: `💻 *BINARY:*\n${bin}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function unbinaryCommand(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '💻 Usage: $unbinary <binary>\nExample: $unbinary 01001000 01101001' }, { quoted: message });
    try {
        const text = input.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join('');
        await sock.sendMessage(chatId, { text: `💻 *DECODED:*\n${text}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Invalid binary input.' }, { quoted: message });
    }
}

async function base64Command(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '🔐 Usage: $base64 <text>' }, { quoted: message });
    const encoded = Buffer.from(input).toString('base64');
    await sock.sendMessage(chatId, { text: `🔐 *BASE64 ENCODED:*\n${encoded}\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function unbase64Command(sock, chatId, message) {
    const input = getArgs(message);
    if (!input) return sock.sendMessage(chatId, { text: '🔓 Usage: $unbase64 <base64>' }, { quoted: message });
    try {
        const decoded = Buffer.from(input, 'base64').toString('utf8');
        await sock.sendMessage(chatId, { text: `🔓 *BASE64 DECODED:*\n${decoded}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Invalid base64 input.' }, { quoted: message });
    }
}

async function passwordCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const len = parseInt(text.split(' ')[1]) || 16;
    const safeLen = Math.min(Math.max(len, 8), 64);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+[]{}';
    let pass = '';
    const bytes = crypto.randomBytes(safeLen);
    for (let i = 0; i < safeLen; i++) pass += chars[bytes[i] % chars.length];
    await sock.sendMessage(chatId, {
        text: `🔑 *GENERATED PASSWORD* (${safeLen} chars)\n\n\`${pass}\`\n\n⚠️ _Save it somewhere safe!_\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function uuidCommand(sock, chatId, message) {
    const id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    await sock.sendMessage(chatId, { text: `🔑 *UUID:*\n\`${id}\`\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { reverseCommand, morseCommand, unmorseCommand, binaryCommand, unbinaryCommand, base64Command, unbase64Command, passwordCommand, uuidCommand };
