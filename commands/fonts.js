'use strict';

function getArgs(message) {
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    return text.split(' ').slice(1).join(' ').trim();
}

// Unicode character maps
const MAPS = {
    bold:       { a:0x1D41A, A:0x1D400, n:0x1D7CE },
    italic:     { a:0x1D44E, A:0x1D434, n:null },
    bolditalic: { a:0x1D482, A:0x1D468, n:null },
    script:     { a:0x1D4B6, A:0x1D49C, n:null },
    fraktur:    { a:0x1D51E, A:0x1D504, n:null },
    double:     { a:0x1D552, A:0x1D538, n:0x1D7D8 },
    sans:       { a:0x1D5BA, A:0x1D5A0, n:0x1D7E2 },
    sansbold:   { a:0x1D5EE, A:0x1D5D4, n:0x1D7EC },
    mono:       { a:0x1D68A, A:0x1D670, n:0x1D7F6 },
};

// Overrides for characters that don't follow the sequence
const OVERRIDES = {
    bold:       { h:0x1D41A+7 },
    italic:     { h:0x210E },
    script:     { B:0x212C, E:0x2130, F:0x2131, H:0x210B, I:0x2110, L:0x2112, M:0x2133, R:0x211B, e:0x212F, g:0x210A, o:0x2134 },
    fraktur:    { C:0x212D, H:0x210C, I:0x2111, R:0x211C, Z:0x2128 },
    double:     { C:0x2102, H:0x210D, N:0x2115, P:0x2119, Q:0x211A, R:0x211D, Z:0x2124 },
};

function convert(str, mapKey) {
    const map = MAPS[mapKey];
    const over = OVERRIDES[mapKey] || {};
    return [...str].map(c => {
        if (over[c]) return String.fromCodePoint(over[c]);
        if (c >= 'a' && c <= 'z' && map.a) return String.fromCodePoint(map.a + (c.charCodeAt(0) - 97));
        if (c >= 'A' && c <= 'Z' && map.A) return String.fromCodePoint(map.A + (c.charCodeAt(0) - 65));
        if (c >= '0' && c <= '9' && map.n) return String.fromCodePoint(map.n + (c.charCodeAt(0) - 48));
        return c;
    }).join('');
}

// Wide / fullwidth
function toWide(str) {
    return [...str].map(c => {
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCodePoint(code + 0xFF01 - 33);
        return c;
    }).join('');
}

// Small caps
const SMALLCAPS = { a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ' };
function toSmallcaps(str) { return [...str.toLowerCase()].map(c => SMALLCAPS[c] || c).join(''); }

// Bubble / circled
const BUBBLE = 'ⓐⓑⓒⓓⓔⓕⓖⓗⓘⓙⓚⓛⓜⓝⓞⓟⓠⓡⓢⓣⓤⓥⓦⓧⓨⓩ';
const BUBBLE_U = 'ⒶⒷⒸⒹⒺⒻⒼⒽⒾⒿⓀⓁⓂⓃⓄⓅⓆⓇⓈⓉⓊⓋⓌⓍⓎⓏ';
function toBubble(str) {
    return [...str].map(c => {
        if (c >= 'a' && c <= 'z') return BUBBLE[c.charCodeAt(0) - 97];
        if (c >= 'A' && c <= 'Z') return BUBBLE_U[c.charCodeAt(0) - 65];
        return c;
    }).join('');
}

// Flip upside down
const FLIP_MAP = {a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',A:'∀',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'פ',H:'H',I:'I',J:'ɾ',K:'ʞ',L:'˥',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ᴚ',S:'S',T:'┴',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z','1':'Ɩ','2':'ᄅ','3':'Ɛ','4':'ᔭ','5':'ϛ','6':'9','7':'ㄥ','8':'8','9':'6','0':'0','!':'¡','?':'¿','.':'˙',',':'\'','\'':',',};
function toFlip(str) { return [...str].reverse().map(c => FLIP_MAP[c] || c).join(''); }

// Mirror (reverse only)
function toMirror(str) { return [...str].reverse().join(''); }

function makeHandler(label, fn) {
    return async (sock, chatId, message) => {
        const input = getArgs(message);
        if (!input) return sock.sendMessage(chatId, { text: `✏️ Usage: .${label} <text>` }, { quoted: message });
        const result = fn(input);
        await sock.sendMessage(chatId, { text: `✏️ *${label.toUpperCase()}:*\n${result}\n\n_Daratech_ ⚡` }, { quoted: message });
    };
}

module.exports = {
    fancyCommand:     makeHandler('fancy',     s => convert(s, 'script')),
    boldtextCommand:  makeHandler('boldtext',  s => convert(s, 'bold')),
    italicCommand:    makeHandler('italic',    s => convert(s, 'italic')),
    bolditalicCommand:makeHandler('bolditalic',s => convert(s, 'bolditalic')),
    scriptCommand:    makeHandler('script',    s => convert(s, 'script')),
    frakturCommand:   makeHandler('fraktur',   s => convert(s, 'fraktur')),
    doubleCommand:    makeHandler('double',    s => convert(s, 'double')),
    sansCommand:      makeHandler('sans',      s => convert(s, 'sans')),
    monoCommand:      makeHandler('mono',      s => convert(s, 'mono')),
    wideCommand:      makeHandler('wide',      toWide),
    smallcapsCommand: makeHandler('smallcaps', toSmallcaps),
    bubbleCommand:    makeHandler('bubble',    toBubble),
    flipCommand:      makeHandler('flip',      toFlip),
    mirrorCommand:    makeHandler('mirror',    toMirror),
};
