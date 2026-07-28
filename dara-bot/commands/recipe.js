'use strict';
const axios = require('axios');
const { get: giftedGet } = require('../lib/gifted');
const { searchLocalRecipe } = require('../data/local-recipes');

/** Format a local recipe into a WhatsApp card */
function formatLocalRecipe(r) {
    return (
        `╭━═『 🍽️ *${r.name.toUpperCase()}* 』═━╮\n` +
        `┃ 🌍 *Origin:* ${r.origin}\n` +
        `┃ ⏱️ *Time:* ${r.time}\n` +
        `┃ 🍽️ *Serves:* ${r.servings}\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        `🧂 *Ingredients:*\n${r.ingredients.map(i => `▸ ${i}`).join('\n')}\n\n` +
        `📋 *Instructions:*\n${r.instructions}\n\n` +
        (r.youtube ? `▶️ ${r.youtube}\n\n` : '') +
        `_Daratech_ ⚡`
    );
}

// Fallback: GiftedTech Google search when both MealDB and local DB have no results
async function googleRecipeSearch(query) {
    const data = await giftedGet('/search/google', { query: `${query} recipe` });
    const results = data?.results || [];
    if (!results.length) return null;
    const lines = results.slice(0, 5).map((r, i) => `${i + 1}. *${r.title}*\n   🔗 ${r.link}\n   _${r.description?.slice(0, 100) || ''}_`);
    return (
        `╭━═『 🍽️ *RECIPE: ${query.toUpperCase()}* 』═━╮\n` +
        `┃ ℹ️ Showing web results\n` +
        `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
        lines.join('\n\n') + '\n\n_Daratech_ ⚡'
    );
}

async function randomRecipeCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '🍽️ Fetching a random recipe……' }, { quoted: message });
        const { data } = await axios.get('https://www.themealdb.com/api/json/v1/1/random.php', { timeout: 10000 });
        const m = data.meals?.[0];
        if (!m) throw new Error('no meal');
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ing = m[`strIngredient${i}`];
            const mea = m[`strMeasure${i}`];
            if (ing && ing.trim()) ingredients.push(`${mea?.trim() || ''} ${ing.trim()}`.trim());
        }
        const instructions = m.strInstructions?.slice(0, 500) + (m.strInstructions?.length > 500 ? '...' : '') || 'No instructions.';
        const txt =
            `╭━═『 🍽️ *RANDOM RECIPE* 』═━╮\n` +
            `┃ 🍴 *${m.strMeal}*\n` +
            `┃ 🌍 *Origin:* ${m.strArea || '-'}\n` +
            `┃ 🏷️ *Category:* ${m.strCategory || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━╯\n\n` +
            `🧂 *Ingredients:*\n${ingredients.slice(0, 10).map(i => `▸ ${i}`).join('\n')}\n\n` +
            `📋 *Instructions:*\n${instructions}\n\n` +
            `${m.strYoutube ? `▶️ ${m.strYoutube}\n\n` : ''}` +
            `_Daratech_ ⚡`;
        const img = m.strMealThumb;
        if (img) {
            await sock.sendMessage(chatId, { image: { url: img }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch a recipe right now.' }, { quoted: message });
    }
}

async function searchRecipeCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.split(' ').slice(1).join(' ').trim();
    if (!query) return sock.sendMessage(chatId, { text: '🍽️ Usage: $recipe <meal name>\nExample: $recipe pasta\n\nFor random: $randomrecipe' }, { quoted: message });
    try {
        await sock.sendMessage(chatId, { text: '🍳 Searching recipe……' }, { quoted: message });
        const { data } = await axios.get(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`, { timeout: 10000 });
        const meals = data.meals;
        if (!meals) {
            // Fallback 1: local Nigerian/African recipe database
            const local = searchLocalRecipe(query);
            if (local) {
                return sock.sendMessage(chatId, { text: formatLocalRecipe(local) }, { quoted: message });
            }
            // Fallback 2: GiftedTech Google web search
            try {
                const webCard = await googleRecipeSearch(query);
                if (webCard) return sock.sendMessage(chatId, { text: webCard }, { quoted: message });
            } catch { /* ignore fallback errors */ }
            return sock.sendMessage(chatId, { text: `❌ No recipe found for "*${query}*".` }, { quoted: message });
        }
        const m = meals[0];
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            const ing = m[`strIngredient${i}`];
            const mea = m[`strMeasure${i}`];
            if (ing && ing.trim()) ingredients.push(`${mea?.trim() || ''} ${ing.trim()}`.trim());
        }
        const instructions = m.strInstructions?.slice(0, 400) + '...' || 'No instructions.';
        const txt =
            `╭━═『 🍽️ *RECIPE* 』═━╮\n` +
            `┃ 🍴 *${m.strMeal}*\n` +
            `┃ 🌍 *Origin:* ${m.strArea || '-'}\n` +
            `┃ 🏷️ *Category:* ${m.strCategory || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━╯\n\n` +
            `🧂 *Ingredients:*\n${ingredients.slice(0, 10).map(i => `▸ ${i}`).join('\n')}\n\n` +
            `📋 *Instructions:*\n${instructions}\n\n` +
            `${m.strYoutube ? `▶️ ${m.strYoutube}\n\n` : ''}` +
            `_Daratech_ ⚡`;
        const img = m.strMealThumb;
        if (img) {
            await sock.sendMessage(chatId, { image: { url: img }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Recipe search failed.' }, { quoted: message });
    }
}

async function cocktailCommand(sock, chatId, message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    const query = text.split(' ').slice(1).join(' ').trim();
    const url = query
        ? `https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`
        : 'https://www.thecocktaildb.com/api/json/v1/1/random.php';
    try {
        await sock.sendMessage(chatId, { text: '🍹 Looking up cocktail……' }, { quoted: message });
        const { data } = await axios.get(url, { timeout: 10000 });
        const d = data.drinks?.[0];
        if (!d) return sock.sendMessage(chatId, { text: `❌ No cocktail found${query ? ` for "${query}"` : ''}.` }, { quoted: message });
        const ingredients = [];
        for (let i = 1; i <= 15; i++) {
            const ing = d[`strIngredient${i}`];
            const mea = d[`strMeasure${i}`];
            if (ing && ing.trim()) ingredients.push(`${mea?.trim() || ''} ${ing.trim()}`.trim());
        }
        const txt =
            `╭━═『 🍹 *COCKTAIL* 』═━╮\n` +
            `┃ 🍸 *${d.strDrink}*\n` +
            `┃ 🏷️ *Category:* ${d.strCategory || '-'}\n` +
            `┃ 🔞 *Alcoholic:* ${d.strAlcoholic || '-'}\n` +
            `┃ 🥃 *Glass:* ${d.strGlass || '-'}\n` +
            `╰━━━━━━━━━━━━━━━━━╯\n\n` +
            `🧂 *Ingredients:*\n${ingredients.map(i => `▸ ${i}`).join('\n')}\n\n` +
            `📋 *Instructions:*\n${(d.strInstructions || 'N/A').slice(0, 400)}\n\n` +
            `_Daratech_ ⚡`;
        if (d.strDrinkThumb) {
            await sock.sendMessage(chatId, { image: { url: d.strDrinkThumb }, caption: txt }, { quoted: message });
        } else {
            await sock.sendMessage(chatId, { text: txt }, { quoted: message });
        }
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Cocktail lookup failed.' }, { quoted: message });
    }
}

module.exports = { randomRecipeCommand, searchRecipeCommand, cocktailCommand };
