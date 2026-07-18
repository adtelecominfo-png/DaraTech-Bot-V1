<div align="center">

<img src="https://i.ibb.co/0jGMxvk/daratech-logo.png" alt="Daratech Bot" width="140" height="140" style="border-radius:50%"/>

# DARATECH BOT

**A multi-purpose WhatsApp bot with 320+ commands across 27 categories.**

[![WhatsApp](https://img.shields.io/badge/Platform-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://whatsapp.com)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-7C3AED?style=flat-square)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-ISC-F59E0B?style=flat-square)](LICENSE)
[![Commands](https://img.shields.io/badge/Commands-320+-EC4899?style=flat-square)]()

</div>

---

## What it does

AI chat · Movie & anime search/download · YouTube/TikTok/Instagram/Spotify downloaders · Live sports scores · Group management · Image effects & stickers · Manga reader · Crypto prices · Text tools · Games · and a lot more.

---

## Quick Start

```bash
git clone https://github.com/adtelecominfo-png/dara-studio-bot.git
cd dara-studio-bot
npm install
cp .env.example .env        # add your OWNER_NUMBER and SESSION_ID
node index.js
```

---

## Getting Your SESSION_ID

**Use the official session generator website — no QR code, no command line needed:**

### 🔗 [darabot-session.onrender.com](https://darabot-session.onrender.com)

1. Open the link above
2. Enter your WhatsApp number with country code (e.g. `2348152077346`)
3. A **pairing code** will be shown — enter it in WhatsApp under:
   **Settings → Linked Devices → Link a Device → Link with phone number instead**
4. Your `SESSION_ID` is sent directly to your own WhatsApp chat
5. Copy it and paste it into your `.env` file

---

## Environment Setup

Copy `.env.example` → `.env` and fill in your details:

```env
OWNER_NUMBER=2348152077346   # your number, no + or spaces, include country code
SESSION_ID=                  # paste your SESSION_ID from the generator website
```

> `.env` is gitignored — never pushed to GitHub, never touched by `.update`.

---

## Session Persistence

Once `SESSION_ID` is set in `.env`, the bot restores your session automatically on every restart — including after `.update`. No re-pairing ever needed.

To start fresh: delete `session/`, clear `SESSION_ID=` in `.env`, then run the generator again.

---

## Commands — 320 across 27 categories

Use `.menu` in chat to browse. Use `.menu <category>` for the command list. Use `.help <category>` for full descriptions with examples.

### 🚀 Start Here (11)
```
.ping              → check if bot is online
.alive             → bot status message
.uptime            → how long the bot has been running
.menu              → category overview
.menu <category>   → commands in a category
.help <category>   → full descriptions for a category
.owner             → contact bot owner
.update            → pull latest version from GitHub
.autoupdate on/off → toggle automatic updates
.calc <expr>       → calculator  e.g. .calc 5*9+2
.settings          → view bot settings
```

### 🤖 AI (13)
```
.ai / .ask <query>    → GPT-4o general AI chat
.gpt <query>          → GPT-4o via Pollinations
.gpt4o <query>        → GPT-4o advanced
.gptlarge <query>     → GPT-4o Large
.gptfast <query>      → GPT-4o Fast
.gemini <query>       → Google Gemini AI
.mistral <query>      → Mistral AI
.qwen <query>         → Qwen Coder AI
.imagine / .flux <p>  → AI image generation
.txt2img <prompt>     → text to image
.sora <prompt>        → cinematic AI image
```

### 🎬 Movies & Streaming (14)
```
.movie <title>             → search any movie or show
.movie details <id>        → full info + poster
.movie dl <id>             → show available resolutions
.movie dl <id> 360p        → download specific quality
.movietrailer <id>         → official trailer
.trending                  → what's trending now
.upcoming                  → upcoming releases
.schedule                  → weekly airing schedule
.live                      → browse live TV channels
.livesearch <name>         → search a live channel
.livestream <id>           → get stream link
.anime <title>             → search anime streaming links
.anime dl <id>             → anime download options
.net9ja <title>            → search Net9ja database
```

### 📥 Downloaders (13)
```
.play / .song <title>   → YouTube audio (MP3)
.video / .ytmp4 <url>   → YouTube video (MP4)
.tiktok / .tt <url>     → TikTok without watermark
.instagram <url>        → Instagram post or reel
.facebook <url>         → Facebook video
.spotify <title/url>    → Spotify track
.apk <app name>         → Android APK download
.gitclone <url>         → GitHub repo as ZIP
```

### 🔍 Search (6)
```
.yts / .ytsearch <q>   → YouTube video search (top 7)
.wallpaper <query>      → high-quality wallpapers
.pinterest <query>      → Pinterest image search
.lyrics <song>          → song lyrics
.news                   → latest news headlines
```

### 🌐 Stalk / Lookup (7)
```
.ttstalk <user>    → TikTok profile (followers, videos, bio)
.ghstalk <user>    → GitHub profile (repos, stars, followers)
.igstalk <user>    → Instagram profile
.twstalk <user>    → Twitter / X profile
.steamstalk <user> → Steam gaming profile
```

### 🏆 Sports (9)
```
.sports / .scoreboard   → live soccer, NBA & NFL scores
.livescores             → alias for .sports
.sportsteam <name>      → sports team lookup
.sportsplayer <name>    → sports player lookup
.nbastandings           → NBA league standings
.nflstandings           → NFL league standings
.soccerstandings        → soccer league standings
```

### 🔧 Tools & Utilities (18)
```
.weather <city>     → current weather & forecast
.translate <text>   → auto-detect & translate
.tts <text>         → text to speech
.ss <url>           → screenshot a website
.createqr <text>    → generate QR code
.carbon <code>      → code snippet as image
.imgscan            → AI image scan (reply to image)
.removebg           → remove image background
.remini             → enhance / upscale photo
.netinfo <ip>       → IP / network lookup
.url <link>         → upload file to URL
.tempmail           → generate temp email
.tempmail inbox     → check temp email inbox
```

### 😄 Fun & Social (23)
```
.dare / .truth         → dare or truth questions
.rizz                  → rizz lines
.joke / .funjokes      → random jokes
.meme                  → random meme image
.waifu                 → random anime waifu
.eightball <q>         → magic 8 ball
.trivia                → random trivia question
.hangman               → start a hangman game
.tictactoe             → play tic-tac-toe
.ship @a @b            → ship two users
.simp @user            → simp meter
.wasted @user          → GTA wasted overlay
.insult / .roast @u    → roast someone
.compliment @user      → compliment someone
.flirt @user           → send a flirt
.advice                → random life advice
.quote                 → random quote
```

### 🖼️ Stickers & Image Effects (40)
```
.sticker               → image / video to sticker
.sticker-alt           → alternate sticker converter
.stickertelegram       → Telegram-style sticker
.stickercrop           → crop sticker
.attp <text>           → animated text sticker
.emojimix <e1> <e2>    → mix two emojis
.removebg              → remove background
.img-blur              → blur image
.simage                → generate image from text
+ 30 more image effects and filters
```

### 💰 Crypto (4)
```
.crypto <coin>     → live price, 24h change, market cap
.cryptotop         → top 10 coins by market cap
.cryptotrand       → trending coins
.cryptoconv        → crypto conversion
```

### 🎌 Anime Info (6)
```
.animeinfo <title>   → search anime (info, score, synopsis)
.animeinfo top       → top-rated anime list
.animeinfo season    → currently airing this season
.animeinfo random    → random anime
```
> For streaming/download links use `.anime` (Movies category).

### 📚 Manga (11)
```
.manga <title>              → search manga / manhwa / manhua
.manga details <slug>       → full info + chapter list
.manga read <chapter-slug>  → read chapter (sends all pages)
.manga dl <slug> <ch>       → download chapter as ZIP
.manga dls <slug> <f> <t>   → download chapter range as ZIP
.manga popular [page]       → popular titles
.manga latest [page]        → latest releases
.manga genres               → full genre list
.manga genre <slug> [page]  → browse by genre
.manga home                 → homepage (trending + latest)
.manga browse [opts]        → advanced filter
```
Powered by RosyScans.

### 🛡️ Group Management (33)
```
.kick @user          → remove a member
.promote @user       → make admin
.demote @user        → remove admin
.mute / .unmute      → mute / unmute group
.ban / .unban @user  → ban / unban a user
.warn @user          → warn a member
.clearwarn @user     → clear warnings
.warnings @user      → check warn count
.antilink on/off     → block links from members
.antibadword on/off  → block bad words
.antitag on/off      → block tag spam
.tag / .tagall <msg> → tag all members
.hidetag <msg>       → tag all silently
.groupinfo           → group info & stats
.grouplink           → get invite link
.resetlink           → reset invite link
.topmembers          → most active members
.listadmins          → list all admins
.listonline          → online members
.membercount         → member count
.welcome on/off      → welcome message
.goodbye on/off      → goodbye message
.pin / .unpin        → pin / unpin a message
```

### ⚙️ Owner & Bot Settings (17)
```
.mode public/private   → who can use the bot
.anticall on/off       → auto-reject calls
.pmblocker on/off      → block unknown DMs
.autoread on/off       → auto mark as read
.autoreact on/off      → auto react to messages
.autotyping on/off     → show typing indicator
.autostatus on/off     → auto view statuses
.savestatus            → save status media
.afk <reason>          → set AFK mode
.antidelete on/off     → show deleted messages
.vcf                   → export contacts as VCF
.block / .unblock @u   → block / unblock a user
.bc <msg>              → broadcast to all contacts
.clearsession          → clear session files
.cleartmp              → clear temp / cache files
```

### 🎮 Gaming Sensitivity (4)
```
.freefiresensi <device> [RAM]GB <Android|iOS>  → Free Fire (General, Red Dot, Scopes, DPI)
.pubgsensi <device> [RAM]GB <Android|iOS>        → PUBG Mobile (Camera, ADS, Gyroscope)
.codmsensi <device> [RAM]GB <Android|iOS>        → Call of Duty Mobile (Camera, ADS, Gyro)
.bssensi <device> [RAM]GB <Android|iOS>          → Blood Strike (Camera, ADS, Gyroscope)
```
> RAM is optional on all — e.g. `.pubgsensi iPhone 15 Pro Max iOS`

### Plus more categories
`📲 Temp Mail` · `📖 Language & Define` · `🌍 Country Info` · `🐾 Animals` · `🍽️ Food & Drinks` · `🌌 Space & Science` · `🔠 Text Tools` · `✏️ Fonts` · `🎲 Generators` · `✝️ Bible` · `📐 Converters`

---

## Project Structure

```
dara-studio-bot/
├── index.js           → entry point, WhatsApp connection & session bootstrap
├── main.js            → message router — all command switch cases
├── settings.js        → bot config (name, number, update URL)
├── config.js          → dotenv loader
├── .env               → your secrets (gitignored, never pushed)
├── .env.example       → copy this to .env
├── commands/          → 165 command files
├── lib/
│   ├── categories.js  → 26 category definitions used by .menu & .help
│   ├── isOwner.js     → owner / sudo permission checks
│   └── isBanned.js    → ban state checks
├── data/              → runtime JSON state (bans, warns, groups)
└── session/           → Baileys auth state files (gitignored)
```

---

## Update System

```
.update             → pull latest code from GitHub, restart automatically
.autoupdate on/off  → toggle auto-update
```

**How `.update` works:**
1. Fetches latest commits from GitHub
2. Runs `git reset --hard` + `git clean` — code is updated
3. `.env` and `session/` are gitignored — never touched by git
4. On restart, `SESSION_ID` from `.env` restores your session automatically
5. Bot is back online with no re-pairing needed

---

## Re-pairing (if ever needed)

```bash
rm -rf session/
# In .env set: SESSION_ID=
node index.js
# Enter the pairing code shown in WhatsApp
```

---

## Contributing

1. Fork the repo
2. `git checkout -b feat/your-feature`
3. `git commit -m 'feat: add something'`
4. `git push origin feat/your-feature`
5. Open a Pull Request

---

## Disclaimer

Built for educational purposes. Use responsibly. Developers are not responsible for misuse or terms-of-service violations.

---

<div align="center">

Made by **Daratech** · [GitHub](https://github.com/adtelecominfo-png)

⭐ Star this repo if it helps you!

</div>
