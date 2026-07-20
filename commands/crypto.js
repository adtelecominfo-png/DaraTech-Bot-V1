const COINGECKO = 'https://api.coingecko.com/api/v3';

const COIN_MAP = {
    btc: 'bitcoin', bitcoin: 'bitcoin',
    eth: 'ethereum', ethereum: 'ethereum',
    bnb: 'binancecoin', binance: 'binancecoin',
    sol: 'solana', solana: 'solana',
    xrp: 'ripple', ripple: 'ripple',
    ada: 'cardano', cardano: 'cardano',
    doge: 'dogecoin', dogecoin: 'dogecoin',
    dot: 'polkadot', polkadot: 'polkadot',
    ltc: 'litecoin', litecoin: 'litecoin',
    avax: 'avalanche-2', trx: 'tron', matic: 'matic-network',
    shib: 'shiba-inu', link: 'chainlink', usdt: 'tether',
    usdc: 'usd-coin', ton: 'the-open-network',
};

function fmt(n) {
    if (n === null || n === undefined) return 'N/A';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return '$' + n.toFixed(6);
}

async function cryptoPriceCommand(sock, chatId, message, args) {
    const input = (args[0] || 'bitcoin').toLowerCase();
    const coinId = COIN_MAP[input] || input;
    try {
        await sock.sendMessage(chatId, { text: '💰 Fetching crypto price……' }, { quoted: message });
        const res = await fetch(`${COINGECKO}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`);
        const json = await res.json();
        const d = json[coinId];
        if (!d) return sock.sendMessage(chatId, { text: `❌ Coin "${input}" not found. Try: btc, eth, bnb, sol, doge, xrp` }, { quoted: message });
        const change = (d.usd_24h_change || 0).toFixed(2);
        const arrow = d.usd_24h_change >= 0 ? '📈' : '📉';
        const text = `💰 *CRYPTO PRICE*\n\n🔸 Coin: *${coinId.toUpperCase()}*\n💵 Price: *${fmt(d.usd)}*\n${arrow} 24h Change: *${change}%*\n📊 Market Cap: *${fmt(d.usd_market_cap)}*\n📦 24h Volume: *${fmt(d.usd_24h_vol)}*`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {
        console.error('[crypto-price]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch crypto price. Try again!' }, { quoted: message });
    }
}

async function topCryptoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '🏆 Fetching top cryptocurrencies……' }, { quoted: message });
        const res = await fetch(`${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1`);
        const list = await res.json();
        if (!Array.isArray(list)) throw new Error('Bad response');
        let text = '🏆 *TOP 10 CRYPTOCURRENCIES*\n\n';
        list.forEach((c, i) => {
            const ch = (c.price_change_percentage_24h || 0).toFixed(2);
            const arrow = c.price_change_percentage_24h >= 0 ? '📈' : '📉';
            text += `*${i + 1}. ${c.name} (${c.symbol.toUpperCase()})*\n   💵 ${fmt(c.current_price)} ${arrow} ${ch}%\n`;
        });
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {
        console.error('[top-crypto]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch top crypto list.' }, { quoted: message });
    }
}

async function trendingCryptoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '🔥 Fetching trending crypto……' }, { quoted: message });
        const res = await fetch(`${COINGECKO}/search/trending`);
        const json = await res.json();
        const coins = json.coins || [];
        if (!coins.length) throw new Error('No trending data');
        let text = '🔥 *TRENDING CRYPTOCURRENCIES*\n\n';
        coins.slice(0, 7).forEach((c, i) => {
            text += `*${i + 1}. ${c.item.name} (${c.item.symbol})*\n   🏅 Rank: #${c.item.market_cap_rank || 'N/A'}\n`;
        });
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (e) {
        console.error('[trending-crypto]', e.message);
        await sock.sendMessage(chatId, { text: '❌ Failed to fetch trending crypto.' }, { quoted: message });
    }
}

async function cryptoConvertCommand(sock, chatId, message, args) {
    if (args.length < 3) {
        return sock.sendMessage(chatId, { text: '💱 Usage: $crypto-convert <amount> <from> <to>\nExample: $crypto-convert 1 btc usd' }, { quoted: message });
    }
    const amount = parseFloat(args[0]);
    const from = (args[1] || '').toLowerCase();
    const to = (args[2] || 'usd').toLowerCase();
    if (isNaN(amount)) return sock.sendMessage(chatId, { text: '❌ Invalid amount.' }, { quoted: message });
    const fromId = COIN_MAP[from] || from;
    try {
        await sock.sendMessage(chatId, { text: '💱 Converting……' }, { quoted: message });
        const res = await fetch(`${COINGECKO}/simple/price?ids=${fromId}&vs_currencies=${to}`);
        const json = await res.json();
        const price = json[fromId]?.[to];
        if (!price) return sock.sendMessage(chatId, { text: `❌ Could not convert ${from} to ${to}.` }, { quoted: message });
        const result = (amount * price).toFixed(to === 'usd' ? 2 : 8);
        await sock.sendMessage(chatId, { text: `💱 *CRYPTO CONVERT*\n\n🔸 ${amount} ${from.toUpperCase()} = *${result} ${to.toUpperCase()}*` }, { quoted: message });
    } catch (e) {
        await sock.sendMessage(chatId, { text: '❌ Conversion failed. Try again!' }, { quoted: message });
    }
}

module.exports = { cryptoPriceCommand, topCryptoCommand, trendingCryptoCommand, cryptoConvertCommand };
