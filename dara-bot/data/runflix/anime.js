module.exports = [
  ["neko", "/anime/neko", []],
  ["waifu", "/anime/waifu", []],
  ["konachan", "/anime/konachan", []],
  ["animerandom", "/anime/random", []],
  ["animequotes", "/anime/quotes", []],
  ["charquotes", "/anime/char-quotes", ["character"]],
  ["showquotes", "/anime/show-quotes", ["show"]],
  ["megumin", "/anime/megumin", []],
  ["awoo", "/anime/awoo", []],
  ["kusonimeinfo", "/anime/kusonime-info", []],
  ["kusonimesearch", "/anime/kusonime-search", ["query"]],
  ["komiku", "/anime/komiku", ["query"]],
  ["komikudetail", "/anime/komiku-detail", ["url"]],
].map(([name, path, params]) => ({ name, path, params, category: "ANIME" }));

// Note: NSFW-flagged anime endpoints (loli, milf, hneko, hwaifu) are intentionally
// excluded from this bot.
