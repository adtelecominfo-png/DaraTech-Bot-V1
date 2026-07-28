'use strict';
const axios = require('axios');

const RIDDLES = [
    { q: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?", a: "An echo" },
    { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
    { q: "I have cities, but no houses live there. I have mountains, but no trees grow there. I have water, but no fish swim there. What am I?", a: "A map" },
    { q: "What has hands but can't clap?", a: "A clock" },
    { q: "I'm light as a feather, but the strongest person can't hold me for more than 5 minutes. What am I?", a: "Breath" },
    { q: "What can run but never walks, has a mouth but never talks, has a head but never weeps, has a bed but never sleeps?", a: "A river" },
    { q: "The more you have of it, the less you see. What is it?", a: "Darkness" },
    { q: "I have keys but no locks. I have space but no room. You can enter, but you can't go inside. What am I?", a: "A keyboard" },
    { q: "What goes up but never comes down?", a: "Your age" },
    { q: "I have a head, a tail, but no body. What am I?", a: "A coin" },
    { q: "What can you catch but not throw?", a: "A cold" },
    { q: "What has teeth but cannot bite?", a: "A comb" },
    { q: "Forward I am heavy, but backward I am not. What am I?", a: "The word 'ton'" },
    { q: "What has one eye but can't see?", a: "A needle" },
    { q: "I have branches but no fruit, trunk or leaves. What am I?", a: "A bank" },
    { q: "What comes once in a minute, twice in a moment, but never in a thousand years?", a: "The letter M" },
    { q: "What is always in front of you but can't be seen?", a: "The future" },
    { q: "What has many keys but can't open a single lock?", a: "A piano" },
    { q: "I'm not alive, but I can grow. I don't have lungs, but I need air. I don't have a mouth, but water kills me. What am I?", a: "Fire" },
    { q: "What gets wetter as it dries?", a: "A towel" },
];

const active = {};

async function riddleCommand(sock, chatId, message) {
    const riddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)];
    active[chatId] = riddle.a.toLowerCase();
    await sock.sendMessage(chatId, {
        text: `🧩 *RIDDLE TIME!*\n\n${riddle.q}\n\n_Reply with your answer! Type_ *$riddleanswer* _to reveal._\n\n_Daratech_ ⚡`
    }, { quoted: message });
}

async function riddleAnswerCommand(sock, chatId, message) {
    const answer = active[chatId];
    if (!answer) return sock.sendMessage(chatId, { text: '❓ No active riddle. Start one with *$riddle*' }, { quoted: message });
    delete active[chatId];
    await sock.sendMessage(chatId, { text: `💡 *RIDDLE ANSWER:*\n\n${answer.charAt(0).toUpperCase() + answer.slice(1)}\n\n_Daratech_ ⚡` }, { quoted: message });
}

module.exports = { riddleCommand, riddleAnswerCommand };
