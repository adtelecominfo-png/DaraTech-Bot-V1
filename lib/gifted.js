'use strict';
/**
 * lib/gifted.js — GiftedTech API helper (primary API for dara-bot)
 *
 * Base: https://api.giftedtech.co.ke/api
 * All endpoints require ?apikey=<key>
 */

const axios = require('axios');

const BASE = 'https://api.giftedtech.co.ke/api';
const KEY  = 'gifted-api_p1r5icplshukpe2x';

/** Build a full URL for a GiftedTech endpoint with params injected */
function buildUrl(path, params = {}) {
    const u = new URL(`${BASE}${path}`);
    u.searchParams.set('apikey', KEY);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(String(k), String(v));
    }
    return u.toString();
}

/** GET request to GiftedTech API, returns parsed data */
async function get(path, params = {}, timeout = 30000) {
    const { data } = await axios.get(buildUrl(path, params), { timeout });
    return data;
}

/** David Cyril API base (secondary, free, no key) */
const DAVID_BASE = 'https://apis.davidcyril.name.ng';

async function davidGet(path, params = {}, timeout = 20000) {
    const u = new URL(`${DAVID_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
    const { data } = await axios.get(u.toString(), { timeout });
    return data;
}

/** Gifted Tools API base (https://api.gifted.co.ke/api/tools) */
const TOOLS_BASE = 'https://api.gifted.co.ke/api/tools';

/** GET request to Gifted Tools API, returns parsed JSON */
async function toolsGet(endpoint, params = {}, timeout = 30000) {
    const u = new URL(`${TOOLS_BASE}/${endpoint}`);
    u.searchParams.set('apikey', KEY);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(String(k), String(v));
    }
    const { data } = await axios.get(u.toString(), { timeout });
    return data;
}

/** GET request to Gifted Tools API, returns a Buffer (for binary image/PDF/ZIP endpoints) */
async function toolsBuf(endpoint, params = {}, timeout = 45000) {
    const u = new URL(`${TOOLS_BASE}/${endpoint}`);
    u.searchParams.set('apikey', KEY);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(String(k), String(v));
    }
    const { data } = await axios.get(u.toString(), { responseType: 'arraybuffer', timeout });
    return Buffer.from(data);
}

/** Gifted Stalker API base (https://api.gifted.co.ke/api/stalk) */
const STALKER_BASE = 'https://api.gifted.co.ke/api/stalk';

/** GET request to Gifted Stalker API endpoint, returns parsed data */
async function stalkerGet(endpoint, params = {}, timeout = 25000) {
    const u = new URL(`${STALKER_BASE}/${endpoint}`);
    u.searchParams.set('apikey', KEY);
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) u.searchParams.set(String(k), String(v));
    }
    const { data } = await axios.get(u.toString(), { timeout });
    return data;
}

module.exports = { buildUrl, get, davidGet, stalkerGet, toolsGet, toolsBuf, BASE, DAVID_BASE, STALKER_BASE, KEY };
