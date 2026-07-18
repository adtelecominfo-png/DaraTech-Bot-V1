// lib/runflixPatch.js
// Global transport patch for the Runflix API.
//
// - Adds Referer/Origin/User-Agent so Cloudflare doesn't 403 our server host.
// - Rotates through a chain of Runflix API keys on 401/403/429.
//
// Patches:
//   * global.fetch (Node 18+ undici)
//   * node-fetch's default export
//   * axios (request interceptor + response fallback)
//
// Requiring this file once at process boot is enough — every command that
// eventually hits `api.runflix.name.ng` will transparently benefit.

"use strict";

// Only patch the general-purpose API. movieapi.runflix.name.ng is used
// exclusively by movie.js which manages its own keys — do not intercept it.
const RUNFLIX_HOSTS = new Set([
  "api.runflix.name.ng",
]);

// Note: gifted.co.ke was previously used as a fallback but its /api/v3/
// paths don't exist on that server — it caused HTTP 404 errors. Removed.

const DEFAULT_KEYS = [
  "daratech",
  "RF-KEY-BA3493E7D961",
  "RF-KEY-2C0A17B9C77C",
  "RF-KEY-FC7852539D3F",
];

function loadKeyChain() {
  const env = (process.env.RUNFLIX_API_KEY || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let settingsKey = "";
  try { settingsKey = (require("../settings").runflixApiKey || "").trim(); } catch {}
  const chain = [...env, settingsKey, ...DEFAULT_KEYS].filter(Boolean);
  return [...new Set(chain)];
}

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://runflix.name.ng/",
  "Origin": "https://runflix.name.ng",
};

function parseUrl(input) {
  try {
    if (typeof input === "string") return new URL(input);
    if (input && typeof input.url === "string") return new URL(input.url);
    if (input && typeof input.href === "string") return new URL(input.href);
  } catch {}
  return null;
}

function isRunflixHost(host) { return host && RUNFLIX_HOSTS.has(host); }

function withApiKey(urlObj, key) {
  if (key) urlObj.searchParams.set("apikey", key);
  return urlObj;
}

function looksLikeChallenge(status, text) {
  // 503 = Cloudflare under-attack mode; jump to fallback immediately
  if (status === 503) return true;
  if (!text) return false;
  const t = text.slice(0, 400).toLowerCase();
  return (
    t.includes("just a moment") ||
    t.includes("challenge-platform") ||
    t.includes("cf-chl") ||
    t.includes("cloudflare") ||
    // Point D: API returns 403 "internal use only" for non-browser UA requests.
    // Treat this as a fallback trigger so we don't waste time rotating API keys
    // (rotating keys won't help — the block is UA-based, not key-based).
    t.includes("internal use only") ||
    t.includes("for internal use")
  );
}

function mergeHeaders(existing, extra) {
  const out = {};
  if (existing) {
    if (typeof existing.forEach === "function" && !Array.isArray(existing)) {
      existing.forEach((v, k) => { out[k] = v; });
    } else if (Array.isArray(existing)) {
      for (const [k, v] of existing) out[k] = v;
    } else if (typeof existing === "object") {
      Object.assign(out, existing);
    }
  }
  for (const [k, v] of Object.entries(extra)) {
    if (!Object.keys(out).some((ek) => ek.toLowerCase() === k.toLowerCase())) {
      out[k] = v;
    }
  }
  return out;
}

/* -------------------- fetch (global + node-fetch) -------------------- */

function makePatchedFetch(originalFetch) {
  return async function patchedFetch(input, init = {}) {
    const urlObj = parseUrl(input);
    if (!urlObj || !isRunflixHost(urlObj.host)) {
      return originalFetch(input, init);
    }

    const headers = mergeHeaders(init.headers, BROWSER_HEADERS);
    const opts = { ...init, headers };

    // If the caller already embedded an apikey in the URL, respect it — just
    // add the browser headers and do a single pass without overriding the key.
    // This prevents the patch from clobbering movie.js's specific movie API key.
    if (urlObj.searchParams.has("apikey")) {
      return originalFetch(urlObj.toString(), opts);
    }

    const keys = loadKeyChain();
    let lastRes = null;
    let lastText = "";
    for (const key of keys.length ? keys : [undefined]) {
      const u = withApiKey(new URL(urlObj.toString()), key);
      let res;
      try {
        res = await originalFetch(u.toString(), opts);
      } catch (err) {
        lastRes = null;
        lastText = String(err && err.message || err);
        continue;
      }
      lastRes = res;

      // Peek body only when suspicious
      if (res.ok && res.status !== 403 && res.status !== 503) {
        return res;
      }
      try { lastText = await res.clone().text(); } catch { lastText = ""; }
      const isChallenge = looksLikeChallenge(res.status, lastText);
      const isAuth = res.status === 401 || res.status === 403 || res.status === 429;
      if (!isChallenge && !isAuth) return res; // real error, propagate
      // otherwise rotate to next key
    }

    // All keys failed — return the last primary-API response so the caller
    // gets the real error (e.g. "API Key Required") instead of a 404 from
    // the gifted.co.ke fallback, which does not host /api/v3/ Runflix paths.
    if (lastRes) return lastRes;
    throw new Error(lastText || "All Runflix API keys failed");
  };
}

if (typeof global.fetch === "function") {
  const orig = global.fetch.bind(global);
  global.fetch = makePatchedFetch(orig);
}

try {
  const nf = require("node-fetch");
  const origNF = nf.default || nf;
  const patched = makePatchedFetch(origNF);
  // node-fetch v2: module.exports is the function
  try { require.cache[require.resolve("node-fetch")].exports = patched; } catch {}
  if (nf && typeof nf === "object" && "default" in nf) {
    nf.default = patched;
  }
} catch {}

/* -------------------- axios -------------------- */

try {
  const axios = require("axios");
  axios.interceptors.request.use((config) => {
    const urlObj = parseUrl(
      config.url && /^https?:/.test(config.url)
        ? config.url
        : (config.baseURL || "") + (config.url || "")
    );
    if (!urlObj || !isRunflixHost(urlObj.host)) return config;
    config.headers = mergeHeaders(config.headers, BROWSER_HEADERS);
    // Only inject key chain if the caller didn't already supply an apikey
    const alreadyHasKey = urlObj.searchParams.has("apikey") ||
      (config.params && config.params.apikey);
    if (!alreadyHasKey) {
      const keys = loadKeyChain();
      if (keys.length) {
        config.params = config.params || {};
        config.params.apikey = keys[0];
        config.__runflixKeys = keys.slice(1);
      }
    }
    return config;
  });

  axios.interceptors.response.use(
    (res) => res,
    async (error) => {
      const cfg = error.config || {};
      const urlObj = parseUrl(
        cfg.url && /^https?:/.test(cfg.url)
          ? cfg.url
          : (cfg.baseURL || "") + (cfg.url || "")
      );
      if (!urlObj || !isRunflixHost(urlObj.host)) throw error;

      const status = error.response && error.response.status;
      const text = error.response && typeof error.response.data === "string"
        ? error.response.data
        : "";
      const challenged = looksLikeChallenge(status, text);
      const authFail = status === 401 || status === 403 || status === 429;

      // rotate key
      const nextKeys = cfg.__runflixKeys || [];
      if ((authFail || challenged) && nextKeys.length) {
        const [nextKey, ...rest] = nextKeys;
        return axios({
          ...cfg,
          params: { ...(cfg.params || {}), apikey: nextKey },
          __runflixKeys: rest,
        });
      }

      // gifted.co.ke does not host /api/v3/ Runflix paths — skip that fallback
      // and propagate the real error instead.
      throw error;
    }
  );
} catch {}

module.exports = { loadKeyChain };
