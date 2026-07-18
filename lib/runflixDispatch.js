// Dynamic dispatcher for the Runflix API catalog (989 endpoints).
// Loaded as a fallback in main.js's default: branch, so any of the ~130
// native hand-written commands always take priority over these.
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");

const API_BASE = "https://api.runflix.name.ng";
const DATA_DIR = path.join(__dirname, "..", "data", "runflix");

function findMediaUrl(result) {
  if (!result || typeof result !== "object") return null;
  const keys = ["url", "image", "image_url", "download_url", "video", "audio", "link", "result_url"];
  for (const key of keys) {
    if (typeof result[key] === "string" && result[key].startsWith("http")) return result[key];
  }
  for (const val of Object.values(result)) {
    if (val && typeof val === "object") {
      const nested = findMediaUrl(val);
      if (nested) return nested;
    }
  }
  return null;
}

function looksLikeImage(url) { return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url); }
function looksLikeVideo(url) { return /\.(mp4|mov|webm)(\?|$)/i.test(url); }
function looksLikeAudio(url) { return /\.(mp3|m4a|ogg|wav)(\?|$)/i.test(url); }

// Build a Map of name -> { path, params } from every data/runflix/*.js file
// (not the templates/ subfolder - those are handled separately below).
const registry = new Map();
for (const file of fs.readdirSync(DATA_DIR)) {
  if (!file.endsWith(".js")) continue;
  const defs = require(path.join(DATA_DIR, file));
  for (const def of defs) {
    if (def && def.name && def.path) registry.set(def.name.toLowerCase(), def);
  }
}

const TEXTPRO = require(path.join(DATA_DIR, "templates", "textpro.js"));
const EPHOTO360 = require(path.join(DATA_DIR, "templates", "ephoto360.js"));
const PHOTOFUNIA = require(path.join(DATA_DIR, "templates", "photofunia.js"));
const DUAL_TEXT = new Set(TEXTPRO.DUAL_TEXT || []);

async function sendListChunked(sock, chatId, title, items) {
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) chunks.push(items.slice(i, i + 25).join(", "));
  await sock.sendMessage(chatId, { text: `${title} (${items.length}):\n\n${chunks.join("\n\n")}` });
}

async function sendMediaOrText(sock, chatId, result, fallbackName) {
  const mediaUrl = findMediaUrl(result);
  if (mediaUrl) {
    if (looksLikeVideo(mediaUrl)) {
      await sock.sendMessage(chatId, { video: { url: mediaUrl } });
    } else if (looksLikeAudio(mediaUrl)) {
      await sock.sendMessage(chatId, { audio: { url: mediaUrl }, mimetype: "audio/mpeg" });
    } else if (looksLikeImage(mediaUrl) || true) {
      await sock.sendMessage(chatId, { image: { url: mediaUrl } });
    }
    return;
  }
  const text =
    typeof result === "string"
      ? result
      : result?.message || result?.text || result?.content || JSON.stringify(result);
  await sock.sendMessage(chatId, { text: text || `No result for "${fallbackName}".` });
}

const RUNFLIX_API_KEY = process.env.RUNFLIX_API_KEY || "daratech";

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Referer": "https://runflix.name.ng/",
  "Origin": "https://runflix.name.ng",
};

function isChallenge(text) {
  if (!text) return false;
  const t = text.slice(0, 400).toLowerCase();
  return (
    t.includes("just a moment") ||
    t.includes("challenge-platform") ||
    t.includes("cf-chl") ||
    // Point D: API returns 403 "internal use only" for non-browser User-Agent.
    // Treat it as a fallback trigger — rotating keys won't help.
    t.includes("internal use only") ||
    t.includes("for internal use")
  );
}

async function fetchJson(url, headers) {
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok || isChallenge(text)) {
    const err = new Error(`status ${res.status}`);
    err.status = res.status;
    err.body = text;
    err.challenge = isChallenge(text);
    throw err;
  }
  try { return JSON.parse(text); } catch { return { result: text }; }
}

async function callRunflix(sock, chatId, path_, query) {
  const q = { ...query, apikey: RUNFLIX_API_KEY };
  const primary = `${API_BASE}${encodeURI(path_)}?${new URLSearchParams(q)}`;
  try {
    const data = await fetchJson(primary, BROWSER_HEADERS);
    await sendMediaOrText(sock, chatId, data?.result ?? data, path_);
  } catch (err) {
    console.error(`Runflix "${path_}" failed:`, err.status || err.message);
    // Return the real error from the primary API instead of a misleading message.
    // api.gifted.co.ke was previously used as a fallback but it does not host
    // /api/v3/ Runflix endpoints and always returned 404, masking the real error.
    const detail = err.body ? ` (${String(err.body).slice(0, 120)})` : "";
    await sock.sendMessage(chatId, {
      text: `❌ Movie command failed.\n\nHTTP ${err.status || "error"}${detail}\n\nTry again in a moment.`
    });
  }
}

/**
 * Attempts to handle `userMessage` as a Runflix-backed command.
 * Returns true if handled, false if this message doesn't match anything here
 * (letting main.js fall through to its normal chatbot/tag-detection behavior).
 */
async function tryRunflixCommand(sock, chatId, message, userMessage) {
  if (!userMessage || !userMessage.startsWith(".")) return false;

  const parts = userMessage.slice(1).trim().split(/\s+/);
  const name = (parts.shift() || "").toLowerCase();
  const rest = parts.join(" ").trim();

  // Generic template families: .textpro, .ephoto, .photofunia
  if (name === "textpro" || name === "ephoto" || name === "photofunia") {
    const [maybeTemplate, ...restWords] = rest.split(/\s+/);
    if ((maybeTemplate || "").toLowerCase() === "list") {
      const list = name === "textpro" ? TEXTPRO : name === "ephoto" ? EPHOTO360 : PHOTOFUNIA;
      const label = name === "textpro" ? "🎨 TextPro templates" : name === "ephoto" ? "🖼️ EPhoto360 templates" : "🖼️ PhotoFunia templates";
      await sendListChunked(sock, chatId, label, list);
      return true;
    }

    const list = name === "textpro" ? TEXTPRO : name === "ephoto" ? EPHOTO360 : PHOTOFUNIA;
    const template = list.find((t) => t.toLowerCase() === (maybeTemplate || "").toLowerCase());
    if (!template) {
      await sock.sendMessage(chatId, {
        text: `Usage: \`.${name} <template> <${name === "photofunia" ? "image-url" : "text"}>\`. Run \`.${name} list\` to see all templates.`,
      });
      return true;
    }

    const value = restWords.join(" ").trim();
    if (!value) {
      await sock.sendMessage(chatId, { text: `Usage: \`.${name} ${template} <${name === "photofunia" ? "image-url" : "text"}>\`` });
      return true;
    }

    if (name === "textpro") {
      const query = {};
      if (DUAL_TEXT.has(template)) {
        const [text1, text2] = value.split("|").map((s) => s.trim());
        query.text1 = text1 || value;
        query.text2 = text2 || "";
      } else {
        query.text = value;
      }
      await callRunflix(sock, chatId, `/textpro/${template}`, query);
    } else if (name === "ephoto") {
      await callRunflix(sock, chatId, `/ephoto360/${template}`, { text: value });
    } else {
      await callRunflix(sock, chatId, `/photofunia/${template}`, { url: value });
    }
    return true;
  }

  // Discrete data-driven commands (AI, downloader, search, sports, etc.)
  const def = registry.get(name);
  if (!def) return false;

  const query = {};
  const extraParams = def.params || [];
  if (extraParams.length === 1) {
    if (rest) query[extraParams[0]] = rest;
  } else if (extraParams.length >= 2) {
    const pieces = rest.split("|").map((s) => s.trim());
    extraParams.forEach((p, i) => { if (pieces[i]) query[p] = pieces[i]; });
  }

  await callRunflix(sock, chatId, def.path, query);
  return true;
}

const RUNFLIX_COMMAND_NAMES = [...registry.keys(), "textpro", "ephoto", "photofunia"];

module.exports = { tryRunflixCommand, RUNFLIX_COMMAND_NAMES };
