'use strict';

function getArgs(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    return text.split(' ').slice(1);
}

async function bmiCommand(sock, chatId, message) {
    const args = getArgs(message);
    const weight = parseFloat(args[0]);
    const height = parseFloat(args[1]);
    if (!weight || !height) return sock.sendMessage(chatId, { text: '⚖️ Usage: $bmi <weight_kg> <height_m>\nExample: $bmi 70 1.75' }, { quoted: message });
    const bmi = (weight / (height * height)).toFixed(1);
    let category = '', emoji = '';
    if (bmi < 18.5) { category = 'Underweight'; emoji = '😟'; }
    else if (bmi < 25) { category = 'Normal weight'; emoji = '✅'; }
    else if (bmi < 30) { category = 'Overweight'; emoji = '⚠️'; }
    else { category = 'Obese'; emoji = '🔴'; }
    await sock.sendMessage(chatId, {
        text: `⚖️ *BMI CALCULATOR*\n\n▸ Weight: ${weight} kg\n▸ Height: ${height} m\n▸ BMI: *${bmi}*\n▸ Category: ${emoji} *${category}*\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function ageCommand(sock, chatId, message) {
    const args = getArgs(message);
    const dateStr = args.join(' ').trim();
    if (!dateStr) return sock.sendMessage(chatId, { text: '🎂 Usage: $age <YYYY-MM-DD>\nExample: $age 2000-05-15' }, { quoted: message });
    const birth = new Date(dateStr);
    if (isNaN(birth)) return sock.sendMessage(chatId, { text: '❌ Invalid date. Use format YYYY-MM-DD' }, { quoted: message });
    const now = new Date();
    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    const totalDays = Math.floor((now - birth) / 86400000);
    await sock.sendMessage(chatId, {
        text: `🎂 *AGE CALCULATOR*\n\n▸ Birthday: ${birth.toDateString()}\n▸ Age: *${years} years, ${months} months, ${days} days*\n▸ Total days lived: *${totalDays.toLocaleString()}*\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function celsiusCommand(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '🌡️ Usage: $celsius <fahrenheit>\nExample: $celsius 98.6' }, { quoted: message });
    const result = ((val - 32) * 5 / 9).toFixed(2);
    await sock.sendMessage(chatId, { text: `🌡️ *${val}°F = ${result}°C*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function fahrenheitCommand(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '🌡️ Usage: $fahrenheit <celsius>\nExample: $fahrenheit 37' }, { quoted: message });
    const result = ((val * 9 / 5) + 32).toFixed(2);
    await sock.sendMessage(chatId, { text: `🌡️ *${val}°C = ${result}°F*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function kmtomilesCommand(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '📏 Usage: $kmtomiles <km>\nExample: $kmtomiles 100' }, { quoted: message });
    const result = (val * 0.621371).toFixed(4);
    await sock.sendMessage(chatId, { text: `📏 *${val} km = ${result} miles*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function milestokmCommand(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '📏 Usage: $milestokm <miles>\nExample: $milestokm 60' }, { quoted: message });
    const result = (val * 1.60934).toFixed(4);
    await sock.sendMessage(chatId, { text: `📏 *${val} miles = ${result} km*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function kgtolbsCommand(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '⚖️ Usage: $kgtolbs <kg>\nExample: $kgtolbs 70' }, { quoted: message });
    const result = (val * 2.20462).toFixed(3);
    await sock.sendMessage(chatId, { text: `⚖️ *${val} kg = ${result} lbs*\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function lbstokg(sock, chatId, message) {
    const args = getArgs(message);
    const val = parseFloat(args[0]);
    if (isNaN(val)) return sock.sendMessage(chatId, { text: '⚖️ Usage: $lbstokg <lbs>\nExample: $lbstokg 154' }, { quoted: message });
    const result = (val * 0.453592).toFixed(3);
    await sock.sendMessage(chatId, { text: `⚖️ *${val} lbs = ${result} kg*\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { bmiCommand, ageCommand, celsiusCommand, fahrenheitCommand, kmtomilesCommand, milestokmCommand, kgtolbsCommand, lbstokg };
