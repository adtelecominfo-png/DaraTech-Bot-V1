'use strict';
const axios = require('axios');

const SRA = 'https://some-random-api.com/animal';

// CF-bypass headers (works for some SRA endpoints)
const SRA_HEADERS = {
    'User-Agent': 'curl/7.68.0',
    'Accept': '*/*',
};

/**
 * Download an image URL to a Buffer (follows redirects — needed for loremflickr).
 */
async function fetchImgBuf(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 20000,
        maxRedirects: 10,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'image/*,*/*',
        },
    });
    return Buffer.from(res.data);
}

/**
 * loremflickr.com — free, keyword-based, real photos, no API key needed.
 * Returns a redirect to a Flickr CDN image.
 * e.g. https://loremflickr.com/640/480/giant+panda
 */
function flickrUrl(keyword) {
    // Cache-bust so we get a different image each call
    return `https://loremflickr.com/640/480/${encodeURIComponent(keyword)}?random=${Date.now()}`;
}

async function catfactCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get('https://catfact.ninja/fact', { timeout: 8000 });
        await sock.sendMessage(chatId, { text: `🐱 *CAT FACT*\n\n${data.fact}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat fact.' }, { quoted: message });
    }
}

async function catimageCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            const { data } = await axios.get(`${SRA}/cat`, { timeout: 10000, headers: SRA_HEADERS });
            imgBuf = await fetchImgBuf(data.image);
            fact   = data.fact || '';
        } catch {
            imgBuf = await fetchImgBuf(flickrUrl('cat'));
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🐱 *RANDOM CAT* 🐱${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch cat image.' }, { quoted: message });
    }
}

async function dogfactCommand(sock, chatId, message) {
    try {
        const { data } = await axios.get(`${SRA}/dog`, { timeout: 10000, headers: SRA_HEADERS });
        await sock.sendMessage(chatId, { text: `🐶 *DOG FACT*\n\n${data.fact}\n\n_Daratech_ ⚡` }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog fact.' }, { quoted: message });
    }
}

async function dogimageCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            const { data } = await axios.get(`${SRA}/dog`, { timeout: 10000, headers: SRA_HEADERS });
            imgBuf = await fetchImgBuf(data.image);
            fact   = data.fact || '';
        } catch {
            // dog.ceo fallback — always reliable
            const { data } = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 10000 });
            imgBuf = await fetchImgBuf(data.message);
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🐶 *RANDOM DOG* 🐶${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch dog image.' }, { quoted: message });
    }
}

// ─── $fox — randomfox.ca (primary) + loremflickr fallback ────────────────────

async function foxImageCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            const { data } = await axios.get('https://randomfox.ca/floof/', { timeout: 10000 });
            imgBuf = await fetchImgBuf(data.image);
        } catch {
            imgBuf = await fetchImgBuf(flickrUrl('fox'));
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🦊 *RANDOM FOX*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch fox image.' }, { quoted: message });
    }
}

// ─── $panda — loremflickr (primary) + SRA fallback ───────────────────────────

async function pandaImageCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            // loremflickr returns real panda photos reliably (no CF issues)
            imgBuf = await fetchImgBuf(flickrUrl('giant panda'));
        } catch {
            const { data } = await axios.get(`${SRA}/panda`, { timeout: 12000, headers: SRA_HEADERS });
            imgBuf = await fetchImgBuf(data.image);
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🐼 *RANDOM PANDA*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch panda image.' }, { quoted: message });
    }
}

async function koalaImageCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            const { data } = await axios.get(`${SRA}/koala`, { timeout: 10000, headers: SRA_HEADERS });
            imgBuf = await fetchImgBuf(data.image);
            fact   = data.fact || '';
        } catch {
            imgBuf = await fetchImgBuf(flickrUrl('koala'));
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🐨 *RANDOM KOALA*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch koala image.' }, { quoted: message });
    }
}

// ─── $birb — shibe.online (primary) + loremflickr fallback ───────────────────

async function birbCommand(sock, chatId, message) {
    try {
        let imgBuf;
        try {
            const { data } = await axios.get('https://shibe.online/api/birds?count=1', { timeout: 10000 });
            if (!Array.isArray(data) || !data[0]) throw new Error('No bird URL');
            imgBuf = await fetchImgBuf(data[0]);
        } catch {
            imgBuf = await fetchImgBuf(flickrUrl('bird'));
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🐦 *RANDOM BIRD*\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch bird image.' }, { quoted: message });
    }
}

// ─── $raccoon — loremflickr (primary) + SRA fallback ─────────────────────────

async function raccoonCommand(sock, chatId, message) {
    try {
        let imgBuf, fact = '';
        try {
            // loremflickr bypasses CF entirely
            imgBuf = await fetchImgBuf(flickrUrl('raccoon'));
        } catch {
            const { data } = await axios.get(`${SRA}/raccoon`, { timeout: 12000, headers: SRA_HEADERS });
            imgBuf = await fetchImgBuf(data.image);
            fact   = data.fact || '';
        }
        await sock.sendMessage(chatId, {
            image: imgBuf,
            caption: `🦝 *RANDOM RACCOON*${fact ? `\n\n💡 ${fact}` : ''}\n\n_Daratech_ ⚡`
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, { text: '❌ Could not fetch raccoon image.' }, { quoted: message });
    }
}

module.exports = {
    catfactCommand, catimageCommand,
    dogfactCommand, dogimageCommand,
    foxImageCommand, pandaImageCommand,
    koalaImageCommand, birbCommand, raccoonCommand,
};
