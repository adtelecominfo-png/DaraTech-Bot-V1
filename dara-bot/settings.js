const settings = {
  packname: 'Daratech',
  botName: "Daratech",
  sessionName: "Versa",   // per-instance display name (shown in greetings + $bots)
  botOwner: 'Daratech', // Your name
  // Owner number is read from OWNER_NUMBER env var — never hardcode a real number here.
  // Fallback to empty string; isOwner.js will resolve it from sock._ownerNumber or sock.user.id.
  ownerNumber: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  ownerContact: (process.env.OWNER_NUMBER || '').replace(/\D/g, ''),
  giphyApiKey: 'NrSjG6var2uiuSYDm0xTqCX0xcFgGj4s',
  commandMode: "private",
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "Daratech - a multi-purpose WhatsApp bot with 1000+ commands.",
  version: "1.0.0",
  // GitHub personal access token — used by $savedoc to read/write files
  // Generate one at: https://github.com/settings/tokens (needs repo scope)
  githubToken: process.env.GITHUB_TOKEN || "",

  // GitHub repo — used for git auto-update AND as ZIP fallback
  githubRepo: "https://github.com/adtelecominfo-png/DaraTech-Bot-V1",
  githubBranch: "main",
  updateZipUrl: "https://github.com/adtelecominfo-png/DaraTech-Bot-V1/archive/refs/heads/main.zip",
  // How often (in seconds) the bot checks for updates automatically (default: 39s)
  autoUpdateInterval: 39,
};

module.exports = settings;
