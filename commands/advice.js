'use strict';
const axios = require('axios');

async function adviceCommand(sock, chatId, message) {
    try {
        const { funGet } = require('../lib/gifted');
        const data = await funGet('advice');
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty');
        await sock.sendMessage(chatId, {
            text: `💡 *ADVICE*\n\n"${text}"\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch { await sock.sendMessage(chatId, { text: '❌ Could not fetch advice.' }, { quoted: message }); }
}

const WYR = [
    "Would you rather be invisible OR be able to fly?",
    "Would you rather always be 10 minutes late OR always be 20 minutes early?",
    "Would you rather lose all your money OR lose all your photos/memories?",
    "Would you rather be able to talk to animals OR speak every human language?",
    "Would you rather have unlimited money but no friends OR be broke but surrounded by true friends?",
    "Would you rather live without music OR live without social media?",
    "Would you rather be famous but unhappy OR anonymous but happy?",
    "Would you rather be able to read minds OR be able to see the future?",
    "Would you rather live in the past OR live in the future?",
    "Would you rather never have to sleep again OR never have to eat again?",
    "Would you rather be the funniest person in the room OR the smartest?",
    "Would you rather have no phone for a month OR no friends for a month?",
    "Would you rather be 3 feet tall OR 10 feet tall?",
    "Would you rather have free Wi-Fi everywhere you go OR free food everywhere you go?",
    "Would you rather know when you will die OR how you will die?",
    "Would you rather always sweat OR always have bad breath?",
    "Would you rather be able to stop time OR travel through time?",
    "Would you rather meet your great-great-grandparents OR your great-great-grandchildren?",
    "Would you rather be locked in a library for a week OR locked in an amusement park for a week?",
    "Would you rather fight 10 duck-sized horses OR 1 horse-sized duck?",
];

async function wouldyouCommand(sock, chatId, message) {
    const q = WYR[Math.floor(Math.random() * WYR.length)];
    await sock.sendMessage(chatId, { text: `🤔 *WOULD YOU RATHER?*\n\n${q}\n\nReply A or B!\n\n_Daratech_ ⚡` }, { quoted: message });
}

async function yesnoCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://yesno.wtf/api', { timeout: 8000 });
        await sock.sendMessage(chatId, {
            image: { url: data.image },
            caption: `🎱 *YES OR NO?*\n\n*${data.answer.toUpperCase()}*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        const ans = Math.random() > 0.5 ? 'YES' : 'NO';
        await sock.sendMessage(chatId, { text: `🎱 *YES OR NO?*\n\n*${ans}*\n\n_Daratech_ ⚡` }, { quoted: message });
    }
}

async function neverhaveieverCommand(sock, chatId, message) {
    const prompts = [
        "Never have I ever lied to get out of plans.",
        "Never have I ever googled myself.",
        "Never have I ever stalked an ex on social media.",
        "Never have I ever pretended to be busy to avoid someone.",
        "Never have I ever cried watching a movie.",
        "Never have I ever fallen asleep in class.",
        "Never have I ever eaten food off the floor.",
        "Never have I ever re-gifted a present.",
        "Never have I ever sent a text to the wrong person.",
        "Never have I ever laughed so hard I cried.",
        "Never have I ever pulled an all-nighter.",
        "Never have I ever eaten a whole pizza by myself.",
        "Never have I ever sung in the shower.",
        "Never have I ever stayed up past 3am just scrolling.",
        "Never have I ever said 'I'm on my way' when I hadn't even started getting ready.",
    ];
    const p = prompts[Math.floor(Math.random() * prompts.length)];
    await sock.sendMessage(chatId, { text: `🙋 *NEVER HAVE I EVER*\n\n${p}\n\n👍 = I have  |  👎 = I haven't\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { adviceCommand, wouldyouCommand, yesnoCommand, neverhaveieverCommand };
