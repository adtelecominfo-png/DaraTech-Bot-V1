const settings = {
  // GiftedTech API — primary API for downloads, tools, search
  giftedApiKey: 'gifted-api_p1r5icplshukpe2x',
  giftedApiBase: 'https://api.giftedtech.co.ke/api',
  // Movie API (Runflix movie endpoint still works for movies only)
  movieApiKey: 'runflix_kqiva2m7230opekqdxto',
  movieApiBase: 'https://movieapi.runflix.name.ng/api/v3',
  // Legacy — kept for backward compat, not used for downloads
  runflixApiKey: 'daratech',
  packname: 'Daratech',
  author: 'Daratech',
  botName: "Daratech",
  botOwner: 'Daratech', // Your name
  ownerNumber: '2348152077346', // Set your number here without + symbol
  ownerContact: '2348152077346', // Number shown when someone uses .owner command
  giphyApiKey: 'NrSjG6var2uiuSYDm0xTqCX0xcFgGj4s',
  commandMode: "private",
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "Daratech - a multi-purpose WhatsApp bot with 1000+ commands.",
  version: "1.0.0",
  // GitHub repo — used for git auto-update AND as ZIP fallback
  githubRepo: "https://github.com/adtelecominfo-png/dara-studio-bot",
  githubBranch: "main",
  updateZipUrl: "https://github.com/adtelecominfo-png/dara-studio-bot/archive/refs/heads/main.zip",
  // How often (in seconds) the bot checks for updates automatically (default: 39s)
  autoUpdateInterval: 39,
};

module.exports = settings;
