'use strict';
const axios = require('axios');

module.exports = async function weatherCommand(sock, chatId, message, city) {
    if (!city) {
        return sock.sendMessage(chatId, {
            text: '🌤 Usage: $weather <city name>\nExample: $weather Lagos'
        }, { quoted: message });
    }
    try {
        await sock.sendMessage(chatId, { text: '🌤️ Fetching weather……' }, { quoted: message });
        const { data } = await axios.get(
            `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
            { timeout: 15000 }
        );
        const cur  = data.current_condition?.[0] || {};
        const area = data.nearest_area?.[0] || {};
        const areaName = area.areaName?.[0]?.value || city;
        const country  = area.country?.[0]?.value || '';
        const temp   = cur.temp_C || '?';
        const feels  = cur.FeelsLikeC || '?';
        const desc   = cur.weatherDesc?.[0]?.value || '';
        const humid  = cur.humidity || '?';
        const wind   = cur.windspeedKmph || '?';
        const uv     = cur.uvIndex || '?';
        const vis    = cur.visibility || '?';
        const text =
            `🌤 *WEATHER — ${areaName.toUpperCase()}${country ? ', ' + country.toUpperCase() : ''}*\n\n` +
            `🌡 Temperature:  *${temp}°C*  (feels like ${feels}°C)\n` +
            `☁️ Condition:     *${desc}*\n` +
            `💧 Humidity:      *${humid}%*\n` +
            `💨 Wind:          *${wind} km/h*\n` +
            `🔆 UV Index:      *${uv}*\n` +
            `👁 Visibility:    *${vis} km*`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (err) {
        console.error('[weather]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Could not fetch weather. Check the city name and try again!'
        }, { quoted: message });
    }
};
