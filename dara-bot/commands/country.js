'use strict';
const axios = require('axios');

// ─── Country data cache (populated once per process) ─────────────────────────
let _countriesCache = null;
async function getCountries() {
    if (_countriesCache) return _countriesCache;
    const { data } = await axios.get(
        'https://countriesnow.space/api/v0.1/countries/info?returns=name,capital,flag,dialCode,currency,iso2',
        { timeout: 15000 }
    );
    _countriesCache = data.data || [];
    return _countriesCache;
}

// ─── Common name aliases ──────────────────────────────────────────────────────
const ALIASES = {
    'usa':           'United States',
    'us':            'United States',
    'america':       'United States',
    'uk':            'United Kingdom',
    'britain':       'United Kingdom',
    'great britain': 'United Kingdom',
    'england':       'United Kingdom',
    'uae':           'United Arab Emirates',
    'emirates':      'United Arab Emirates',
    'holland':       'Netherlands',
    'czech republic':'Czechia',
    'ivory coast':   "Côte d'Ivoire",
    'south korea':   'South Korea',
    'north korea':   'North Korea',
    'russia':        'Russia',
    'iran':          'Iran',
    'vietnam':       'Vietnam',
    'syria':         'Syria',
    'bolivia':       'Bolivia',
    'tanzania':      'Tanzania',
    'moldova':       'Moldova',
    'venezuela':     'Venezuela',
    'laos':          'Laos',
    'brunei':        'Brunei',
};

// ─── ISO2 → primary IANA timezone ────────────────────────────────────────────
const TZ_MAP = {
    NG:'Africa/Lagos',       US:'America/New_York',    GB:'Europe/London',
    DE:'Europe/Berlin',      FR:'Europe/Paris',        JP:'Asia/Tokyo',
    CN:'Asia/Shanghai',      IN:'Asia/Kolkata',        BR:'America/Sao_Paulo',
    AU:'Australia/Sydney',   ZA:'Africa/Johannesburg', CA:'America/Toronto',
    MX:'America/Mexico_City',RU:'Europe/Moscow',       SA:'Asia/Riyadh',
    AE:'Asia/Dubai',         EG:'Africa/Cairo',        GH:'Africa/Accra',
    KE:'Africa/Nairobi',     ET:'Africa/Addis_Ababa',  TZ:'Africa/Dar_es_Salaam',
    UG:'Africa/Kampala',     SN:'Africa/Dakar',        CI:'Africa/Abidjan',
    CM:'Africa/Douala',      AO:'Africa/Luanda',       MZ:'Africa/Maputo',
    RW:'Africa/Kigali',      IT:'Europe/Rome',         ES:'Europe/Madrid',
    PT:'Europe/Lisbon',      NL:'Europe/Amsterdam',    BE:'Europe/Brussels',
    SE:'Europe/Stockholm',   NO:'Europe/Oslo',         DK:'Europe/Copenhagen',
    FI:'Europe/Helsinki',    PL:'Europe/Warsaw',       TR:'Europe/Istanbul',
    PK:'Asia/Karachi',       BD:'Asia/Dhaka',          ID:'Asia/Jakarta',
    PH:'Asia/Manila',        TH:'Asia/Bangkok',        VN:'Asia/Ho_Chi_Minh',
    MY:'Asia/Kuala_Lumpur',  SG:'Asia/Singapore',      KR:'Asia/Seoul',
    KW:'Asia/Kuwait',        QA:'Asia/Qatar',          BH:'Asia/Bahrain',
    OM:'Asia/Muscat',        IQ:'Asia/Baghdad',        IR:'Asia/Tehran',
    IL:'Asia/Jerusalem',     GR:'Europe/Athens',       CH:'Europe/Zurich',
    AT:'Europe/Vienna',      CZ:'Europe/Prague',       HU:'Europe/Budapest',
    RO:'Europe/Bucharest',   UA:'Europe/Kyiv',         AR:'America/Argentina/Buenos_Aires',
    CL:'America/Santiago',   CO:'America/Bogota',      PE:'America/Lima',
    VE:'America/Caracas',    EC:'America/Guayaquil',   NZ:'Pacific/Auckland',
    LY:'Africa/Tripoli',     DZ:'Africa/Algiers',      MA:'Africa/Casablanca',
    TN:'Africa/Tunis',       SD:'Africa/Khartoum',     SO:'Africa/Mogadishu',
    ZM:'Africa/Lusaka',      ZW:'Africa/Harare',       BW:'Africa/Gaborone',
    NA:'Africa/Windhoek',    MW:'Africa/Blantyre',     MG:'Indian/Antananarivo',
    LK:'Asia/Colombo',       MM:'Asia/Rangoon',        KH:'Asia/Phnom_Penh',
    LA:'Asia/Vientiane',     MN:'Asia/Ulaanbaatar',    AF:'Asia/Kabul',
    NP:'Asia/Kathmandu',     PG:'Pacific/Port_Moresby',FJ:'Pacific/Fiji',
    JO:'Asia/Amman',         LB:'Asia/Beirut',         YE:'Asia/Aden',
    PY:'America/Asuncion',   UY:'America/Montevideo',  BO:'America/La_Paz',
    GT:'America/Guatemala',  HN:'America/Tegucigalpa', SV:'America/El_Salvador',
    CR:'America/Costa_Rica', PA:'America/Panama',      DO:'America/Santo_Domingo',
    CU:'America/Havana',     JM:'America/Jamaica',     TT:'America/Port_of_Spain',
    HT:'America/Port-au-Prince', NI:'America/Managua', BZ:'America/Belize',
    ZA:'Africa/Johannesburg',BI:'Africa/Bujumbura',    DJ:'Africa/Djibouti',
    ER:'Africa/Asmara',      SS:'Africa/Juba',         CF:'Africa/Bangui',
    TD:'Africa/Ndjamena',    NE:'Africa/Niamey',       ML:'Africa/Bamako',
    BF:'Africa/Ouagadougou', GN:'Africa/Conakry',      SL:'Africa/Freetown',
    LR:'Africa/Monrovia',    TG:'Africa/Lome',         BJ:'Africa/Porto-Novo',
    GM:'Africa/Banjul',      GW:'Africa/Bissau',       CV:'Atlantic/Cape_Verde',
    ST:'Africa/Sao_Tome',    GQ:'Africa/Malabo',       GA:'Africa/Libreville',
    CG:'Africa/Brazzaville', CD:'Africa/Kinshasa',     RW:'Africa/Kigali',
};

// ─── Fuzzy country lookup ─────────────────────────────────────────────────────
function findCountry(query, countries) {
    const q = query.toLowerCase().trim();
    const aliased = ALIASES[q];
    const targets = aliased ? [aliased.toLowerCase(), q] : [q];

    for (const t of targets) {
        // Exact
        const exact = countries.find(c => c.name.toLowerCase() === t);
        if (exact) return exact;
    }
    for (const t of targets) {
        // Starts with
        const sw = countries.find(c => c.name.toLowerCase().startsWith(t));
        if (sw) return sw;
    }
    for (const t of targets) {
        // Contains
        const inc = countries.find(c => c.name.toLowerCase().includes(t));
        if (inc) return inc;
    }
    return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function extractText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption || ''
    );
}

function flagPng(iso2) {
    return iso2 ? `https://flagcdn.com/w640/${iso2.toLowerCase()}.png` : null;
}

async function fetchFlagBuffer(iso2) {
    try {
        const r = await axios.get(flagPng(iso2), { responseType: 'arraybuffer', timeout: 15000 });
        return Buffer.from(r.data);
    } catch { return null; }
}

// ─── $country ─────────────────────────────────────────────────────────────────
async function countryCommand(sock, chatId, message) {
    const name = extractText(message).split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, {
        text: '🌍 Usage: $country <name>\nExample: $country Nigeria'
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🌍 _Fetching country info…_' }, { quoted: message });
        const countries = await getCountries();
        const c = findCountry(name, countries);
        if (!c) throw new Error('not found');

        const txt =
            `╭━═『 🌍 *COUNTRY INFO* 』═━╮\n` +
            `┃ 🏴 *${c.name}* (${c.iso2 || '-'})\n` +
            `┃ 🏙️ *Capital:* ${c.capital || '-'}\n` +
            `┃ 💰 *Currency:* ${c.currency || '-'}\n` +
            `┃ 📞 *Dial Code:* +${c.dialCode || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`;

        const flagBuf = await fetchFlagBuffer(c.iso2);
        if (flagBuf) {
            await sock.sendMessage(chatId, { image: flagBuf, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, {
            text: `❌ Country "*${name}*" not found.\n\nTry the full name, e.g. _United States_, _United Kingdom_, _South Africa_.`
        }, { quoted: message });
    }
}

// ─── $capital ─────────────────────────────────────────────────────────────────
async function capitalCommand(sock, chatId, message) {
    const name = extractText(message).split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, {
        text: '🏙️ Usage: $capital <country>\nExample: $capital Nigeria'
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🏙️ _Fetching capital…_' }, { quoted: message });
        const countries = await getCountries();
        const c = findCountry(name, countries);
        if (!c || !c.capital) throw new Error('not found');

        const flagBuf = await fetchFlagBuffer(c.iso2);
        const txt = `🏙️ The capital of *${c.name}* is *${c.capital}*\n\n_Daratech_ ⚡`;
        if (flagBuf) {
            await sock.sendMessage(chatId, { image: flagBuf, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, {
            text: `❌ Country "*${name}*" not found.\n\nTry the full name, e.g. _United States_, _South Africa_.`
        }, { quoted: message });
    }
}

// ─── $flag ────────────────────────────────────────────────────────────────────
async function flagCommand(sock, chatId, message) {
    const name = extractText(message).split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, {
        text: '🚩 Usage: $flag <country>\nExample: $flag Nigeria'
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🚩 _Fetching flag…_' }, { quoted: message });
        const countries = await getCountries();
        const c = findCountry(name, countries);
        if (!c) throw new Error('not found');

        const flagBuf = await fetchFlagBuffer(c.iso2);
        if (!flagBuf) throw new Error('flag not available');

        await sock.sendMessage(chatId, {
            image: flagBuf,
            caption: `🚩 *Flag of ${c.name}*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, {
            text: `❌ Flag for "*${name}*" not found.\n\nTry the full country name.`
        }, { quoted: message });
    }
}

// ─── $countrytime ─────────────────────────────────────────────────────────────
async function timezoneCountryCommand(sock, chatId, message) {
    const name = extractText(message).split(' ').slice(1).join(' ').trim();
    if (!name) return sock.sendMessage(chatId, {
        text: '🕐 Usage: $countrytime <country>\nExample: $countrytime Nigeria'
    }, { quoted: message });

    try {
        await sock.sendMessage(chatId, { text: '🕐 _Fetching time…_' }, { quoted: message });
        const countries = await getCountries();
        const c = findCountry(name, countries);
        if (!c) throw new Error('not found');

        const tz = TZ_MAP[c.iso2?.toUpperCase()];
        if (!tz) {
            return sock.sendMessage(chatId, {
                text: `🕐 *${c.name}*\n\n❔ Timezone not available for this country.\n\n_Daratech_ ⚡`
            }, { quoted: message });
        }

        // Fetch current time from timeapi.io
        const { data: tzData } = await axios.get(
            `https://timeapi.io/api/timezone/zone?timeZone=${encodeURIComponent(tz)}`,
            { timeout: 10000 }
        );

        const localTime  = tzData?.currentLocalTime?.replace('T', ' ').split('.')[0] || '?';
        const utcOffset  = tzData?.currentUtcOffset?.seconds != null
            ? (() => {
                const secs = tzData.currentUtcOffset.seconds;
                const sign = secs >= 0 ? '+' : '-';
                const h = String(Math.floor(Math.abs(secs) / 3600)).padStart(2, '0');
                const m = String(Math.floor((Math.abs(secs) % 3600) / 60)).padStart(2, '0');
                return `UTC${sign}${h}:${m}`;
            })()
            : tz;

        await sock.sendMessage(chatId, {
            text:
                `╭━═『 🕐 *COUNTRY TIME* 』═━╮\n` +
                `┃ 🌍 *Country:* ${c.name}\n` +
                `┃ 🕰️ *Timezone:* ${tz}\n` +
                `┃ 🔢 *Offset:* ${utcOffset}\n` +
                `┃ 📅 *Local Time:* ${localTime}\n` +
                `╰━━━━━━━━━━━━━━━━━━━╯\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, {
            text: `❌ Country "*${name}*" not found.\n\nTry the full country name, e.g. _Nigeria_, _United States_.`
        }, { quoted: message });
    }
}

module.exports = { countryCommand, capitalCommand, flagCommand, timezoneCountryCommand };
