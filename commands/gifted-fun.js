'use strict';
/**
 * commands/gifted-fun.js
 * New seasonal / themed fun commands powered by https://api.gifted.co.ke/api/fun/
 *
 * Commands:
 *   $friendship  $lovetext   $heartbreak  $gratitude   $thankyou
 *   $newyear     $xmas       $halloween   $valentines
 *   $mothersday  $fathersday $bfday       $gfday
 */

const { funGet } = require('../lib/gifted');

/** Helper to send a simple fun-API text reply */
async function funSend(sock, chatId, message, endpoint, emoji, title) {
    try {
        const data = await funGet(endpoint);
        const text = data?.result;
        if (!text || typeof text !== 'string') throw new Error('Empty response');
        await sock.sendMessage(chatId, {
            text: `${emoji} *${title}*\n\n${text}\n\n_Daratech_ ⚡`,
        }, { quoted: message });
    } catch (err) {
        console.error(`[gifted-fun:${endpoint}]`, err.message);
        await sock.sendMessage(chatId, { text: `❌ Could not fetch ${title.toLowerCase()}. Try again!` }, { quoted: message });
    }
}

const friendshipCommand  = (s, c, m) => funSend(s, c, m, 'friendship',    '🤝', 'FRIENDSHIP');
const lovetextCommand    = (s, c, m) => funSend(s, c, m, 'love',           '❤️', 'LOVE');
const heartbreakCommand  = (s, c, m) => funSend(s, c, m, 'heartbreak',     '💔', 'HEARTBREAK');
const gratitudeCommand   = (s, c, m) => funSend(s, c, m, 'gratitude',      '🙏', 'GRATITUDE');
const thankyouCommand    = (s, c, m) => funSend(s, c, m, 'thankyou',       '💌', 'THANK YOU');
const newyearCommand     = (s, c, m) => funSend(s, c, m, 'newyear',        '🎆', 'NEW YEAR');
const xmasCommand        = (s, c, m) => funSend(s, c, m, 'christmas',      '🎄', 'CHRISTMAS');
const halloweenCommand   = (s, c, m) => funSend(s, c, m, 'halloween',      '🎃', 'HALLOWEEN');
const valentinesCommand  = (s, c, m) => funSend(s, c, m, 'valentines',     '💝', 'VALENTINES');
const mothersdayCommand  = (s, c, m) => funSend(s, c, m, 'mothersday',     '🌸', 'MOTHER\'S DAY');
const fathersdayCommand  = (s, c, m) => funSend(s, c, m, 'fathersday',     '👔', 'FATHER\'S DAY');
const bfdayCommand       = (s, c, m) => funSend(s, c, m, 'boyfriendsday',  '💑', 'BOYFRIEND\'S DAY');
const gfdayCommand       = (s, c, m) => funSend(s, c, m, 'girlfriendsday', '💕', 'GIRLFRIEND\'S DAY');

module.exports = {
    friendshipCommand, lovetextCommand, heartbreakCommand, gratitudeCommand,
    thankyouCommand, newyearCommand, xmasCommand, halloweenCommand,
    valentinesCommand, mothersdayCommand, fathersdayCommand, bfdayCommand, gfdayCommand,
};
