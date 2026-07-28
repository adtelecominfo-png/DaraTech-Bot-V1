'use strict';
const axios = require('axios');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BASE      = 'https://api.alquran.cloud/v1';
const TRANS_EN  = 'en.asad';   // Muhammad Asad English translation
const TRANS_AR  = 'ar.alafasy'; // Arabic (Mishary Alafasy)

// A small pool of well-known ayahs for the daily pick
const DAILY_AYAHS = [
    '2:255', '2:286', '3:173', '18:10', '94:5', '94:6',
    '65:3', '2:153', '39:53', '13:28', '3:185', '55:13',
    '4:103', '17:9', '57:22', '2:216', '3:139', '9:51',
    '16:128', '29:69', '7:180', '20:114', '6:162', '112:1',
    '1:1', '2:1', '3:26', '4:1', '5:3', '24:35',
];

async function fetchAyah(ref) {
    const [en, ar] = await Promise.all([
        axios.get(`${BASE}/ayah/${ref}/${TRANS_EN}`,  { timeout: 12000 }),
        axios.get(`${BASE}/ayah/${ref}/${TRANS_AR}`,  { timeout: 12000 }),
    ]);
    return { en: en.data?.data, ar: ar.data?.data };
}

function ayahCard(en, ar) {
    const ref   = `Surah ${en.surah?.englishName} (${en.surah?.name}) — Ayah ${en.numberInSurah}`;
    const juz   = `Juz ${en.juz}  •  Page ${en.page}`;
    return [
        `╭━═『 📿 *QURAN* 』═━╮`,
        `┃ 📜 *${ref}*`,
        `┃ ${juz}`,
        `╰━━━━━━━━━━━━━━━━━━━╯`,
        ``,
        `*Arabic:*`,
        ar?.text || '',
        ``,
        `*English (Asad):*`,
        en.text,
        ``,
        `_Daratech_ ⚡`,
    ].join('\n');
}

// ─── $quran <surah>:<ayah>  or  $quran <surah> ───────────────────────────────

async function quranCommand(sock, chatId, message) {
    const body = (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text || ''
    ).trim();
    const arg  = body.split(/\s+/).slice(1).join('').trim();

    if (!arg) {
        return sock.sendMessage(chatId, {
            text: [
                `📿 *QURAN Command Usage*`,
                ``,
                `*$quran <surah>:<ayah>*  — fetch a specific verse`,
                `  e.g.  $quran 2:255`,
                ``,
                `*$quran <surah>*         — surah info + first verse`,
                `  e.g.  $quran 18`,
                ``,
                `*$dailyayah*             — random daily ayah`,
            ].join('\n'),
        }, { quoted: message });
    }

    // Surah-only: show surah metadata + ayah 1
    if (/^\d+$/.test(arg)) {
        const surahNum = parseInt(arg, 10);
        if (surahNum < 1 || surahNum > 114) {
            return sock.sendMessage(chatId, { text: '❌ Surah number must be between 1 and 114.' }, { quoted: message });
        }
        try {
            await sock.sendMessage(chatId, { text: '📿 Fetching surah info……' }, { quoted: message });
            const { data } = await axios.get(`${BASE}/surah/${surahNum}`, { timeout: 12000 });
            const s = data?.data;
            if (!s) throw new Error('no data');
            const text = [
                `╭━═『 📿 *QURAN — Surah Info* 』═━╮`,
                `┃ 📖 *${s.englishName}* (${s.name})`,
                `┃ 📛 Meaning: ${s.englishNameTranslation}`,
                `┃ 🕌 Type: ${s.revelationType}`,
                `┃ 📊 Ayahs: ${s.numberOfAyahs}`,
                `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
                ``,
                `_Use *$quran ${surahNum}:1* to read the first verse._`,
                `_Use *$quran ${surahNum}:<ayah>* to read any verse._`,
                ``,
                `_Daratech_ ⚡`,
            ].join('\n');
            return sock.sendMessage(chatId, { text }, { quoted: message });
        } catch {
            return sock.sendMessage(chatId, { text: `❌ Could not fetch Surah ${surahNum}.` }, { quoted: message });
        }
    }

    // Surah:Ayah
    const match = arg.match(/^(\d+):(\d+)$/);
    if (!match) {
        return sock.sendMessage(chatId, {
            text: `❌ Invalid format. Use *surah:ayah* (e.g. $quran 2:255) or just *surah* (e.g. $quran 18).`,
        }, { quoted: message });
    }

    try {
        await sock.sendMessage(chatId, { text: '📿 Fetching ayah……' }, { quoted: message });
        const { en, ar } = await fetchAyah(arg);
        if (!en) throw new Error('no data');
        return sock.sendMessage(chatId, { text: ayahCard(en, ar) }, { quoted: message });
    } catch {
        return sock.sendMessage(chatId, { text: `❌ Could not find Quran ${arg}. Check the surah:ayah reference.` }, { quoted: message });
    }
}

// ─── $dailyayah ───────────────────────────────────────────────────────────────

async function dailyAyahCommand(sock, chatId, message) {
    const day = Math.floor(Date.now() / 86400000);
    const ref = DAILY_AYAHS[day % DAILY_AYAHS.length];
    try {
        await sock.sendMessage(chatId, { text: '📅 Fetching ayah of the day……' }, { quoted: message });
        const { en, ar } = await fetchAyah(ref);
        if (!en) throw new Error('no data');
        const text = [
            `╭━═『 📅 *AYAH OF THE DAY* 』━╮`,
            `┃ 📜 Surah ${en.surah?.englishName} — Ayah ${en.numberInSurah}`,
            `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
            ``,
            `*Arabic:*`,
            ar?.text || '',
            ``,
            `*English (Asad):*`,
            en.text,
            ``,
            `_Daratech_ ⚡`,
        ].join('\n');
        return sock.sendMessage(chatId, { text }, { quoted: message });
    } catch {
        return sock.sendMessage(chatId, { text: '❌ Could not fetch daily ayah.' }, { quoted: message });
    }
}

module.exports = { quranCommand, dailyAyahCommand };
