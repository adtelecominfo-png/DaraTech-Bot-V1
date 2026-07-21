<div align="center">

<img src="https://files.catbox.moe/4mx22l.png" alt="Daratech Bot" width="160" style="border-radius:50%"/>

# DARATECH BOT

**A multi-purpose WhatsApp bot with 465+ commands across 29 categories.**

[![WhatsApp](https://img.shields.io/badge/Platform-WhatsApp-25D366?style=flat-square&logo=whatsapp&logoColor=white)](https://whatsapp.com)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Baileys](https://img.shields.io/badge/Baileys-Latest-7C3AED?style=flat-square)](https://github.com/WhiskeySockets/Baileys)
[![License](https://img.shields.io/badge/License-ISC-F59E0B?style=flat-square)](LICENSE)
[![Commands](https://img.shields.io/badge/Commands-465+-EC4899?style=flat-square)]()

</div>

---

## What it does

AI chat & image generation · Movie & anime streaming/download · YouTube, TikTok, Instagram, Spotify & Facebook downloaders · Live football & basketball scores · Group management · Stickers & image effects · Manga reader · Crypto prices · Text tools & fonts · Games · Sports lookup · Temp phone & mail · Textpro image styles · Social media stalker · and a lot more.

---

## Quick Start

```bash
git clone https://github.com/adtelecominfo-png/DaraTech-Bot-V1.git
cd DaraTech-Bot-V1
npm install
cp .env.example .env        # fill in OWNER_NUMBER and SESSION_ID
node index.js
```

---

## Getting Your SESSION_ID

**Use the official session generator — no QR code, no command line needed:**

### 🔗 [darabot-session.onrender.com](https://darabot-session.onrender.com)

1. Open the link above
2. Enter your WhatsApp number with country code (e.g. `2348152077346`)
3. A **pairing code** will appear — enter it in WhatsApp:
   **Settings → Linked Devices → Link a Device → Link with phone number instead**
4. Your `SESSION_ID` is sent directly to your WhatsApp
5. Paste it into your `.env` file

---

## Environment Setup

Copy `.env.example` → `.env` and fill in:

```env
OWNER_NUMBER=2348152077346   # your number — no + or spaces, country code included
SESSION_ID=                  # paste from the session generator
```

> `.env` is gitignored — never pushed to GitHub, never touched by `.update`.

---

## Session Persistence

Once `SESSION_ID` is set, the bot restores your session automatically on every restart — including after `.update`. No re-pairing needed.

To start fresh: delete `session/`, clear `SESSION_ID=` in `.env`, run the generator again.

---

## Commands — 465+ across 29 categories

Use `.menu` in chat to browse all categories.
Use `.menu <category>` for command list. Use `.help <category>` for full descriptions.

---

### 🚀 Start Here
```
.ping                → check if bot is online
.alive               → bot status message
.uptime              → how long bot has been running
.menu                → category overview
.menu <category>     → commands in a category
.help <category>     → full descriptions with examples
.owner               → contact bot owner
.update              → pull latest version from GitHub
.autoupdate on/off   → toggle automatic updates
.calc <expr>         → calculator  e.g. .calc 5*9+2
.settings            → view bot settings
```

---

### 🤖 AI
```
.ai / .ask <query>      → GPT-4o general AI chat
.gpt <query>            → GPT-4o via Pollinations
.gpt4o <query>          → GPT-4o advanced mode
.gptlarge <query>       → GPT-4o Large
.gptfast <query>        → GPT-4o Fast
.gemini <query>         → Google Gemini AI
.mistral <query>        → Mistral AI
.qwen <query>           → Qwen Coder AI
.letmegpt <query>       → LetMeGPT AI
.unlimitedai <query>    → Unlimited AI chat
.claude <query>         → Claude AI
.deepseek <query>       → DeepSeek AI
.muslimai <query>       → Islamic AI assistant
.transcript <url>       → YouTube transcript/summary
.imagine / .flux <p>    → AI image generation (Flux)
.txt2img <prompt>       → text to image
.magicstudio <prompt>   → Magic Studio AI image
.sora <prompt>          → cinematic AI image
```

---

### 🎬 Movies & Streaming
```
.movie <title>              → search any movie or show
.movie details <id>         → full info + poster
.movie dl <id>              → show available resolutions
.movie dl <id> 360p         → download specific quality
.movietrailer <id>          → official trailer
.trending                   → trending movies & shows
.upcoming                   → upcoming releases
.schedule                   → weekly airing schedule
.live                       → browse live TV channels
.livesearch <name>          → search a live channel
.livestream <id>            → get stream link
.anime <title>              → search anime streaming links
.anime dl <id>              → anime download options
.net9ja <title>             → search Net9ja database
```

---

### 📥 Downloaders
```
.play / .song <title>    → YouTube audio (MP3)
.video / .ytmp4 <url>    → YouTube video (MP4)
.tiktok / .tt <url>      → TikTok without watermark
.instagram <url>         → Instagram post or reel
.facebook <url>          → Facebook video
.spotify <title/url>     → Spotify track
.apk <app name>          → Android APK download
.gitclone <url>          → GitHub repo as ZIP
```

---

### 🔍 Search
```
.yts / .ytsearch <q>      → YouTube video search (top 7)
.wallpaper <query>         → high-quality wallpapers
.pinterest <query>         → Pinterest image search
.lyrics <song>             → song lyrics
.news                      → latest news headlines
.gsearch <q>               → Google web search
.gimage <q>                → Google image search
.ttsearch <q>              → TikTok video search
.chord <song>              → guitar chords lookup
.hearthis <q>              → HearThis music search
.npmpkg <package>          → npm package search
.slyrics <song>            → song lyrics (Spotify source)
.happymod <app>            → HappyMod app search
.scsearch <q>              → SoundCloud music search
.wattpad <q>               → Wattpad story search
.stickersearch <q>         → sticker pack search
```

---

### 🌐 Stalk / Lookup
```
.ttstalk <user>        → TikTok profile (followers, videos, bio)
.ghstalk <user>        → GitHub profile (repos, stars, followers)
.igstalk <user>        → Instagram profile
.twstalk <user>        → Twitter / X profile
.steamstalk <user>     → Steam gaming profile
.wachannel <url>       → WhatsApp channel info & followers
.ipstalk <ip>          → IP geolocation & ISP info
.npmstalk <package>    → npm package info
.dns <domain>          → DNS records lookup
.headers <url>         → HTTP response headers
.servercheck <url>     → check if a server is online
```

---

### 🏆 Sports
```
── ⚽ FOOTBALL LIVE ──
.flivescore / .fls           → all worldwide live football matches
.fstream / .fstreaming       → live stream links for matches

── 🔍 FOOTBALL SEARCH ──
.fplayer <name>              → player profile + photo  (e.g. .fplayer messi)
.fteam <name>                → club info + badge       (e.g. .fteam arsenal)
.fvenue <name>               → stadium info            (e.g. .fvenue wembley)

── 📰 FOOTBALL INFO ──
.fnews / .footballnews       → latest football news headlines
.fleagues                    → list all supported leagues

── 🏆 EPL ──
.eplstand                    → Premier League standings table
.eplmatches                  → Premier League recent results
.eplupcoming / .eplfixtures  → Premier League upcoming fixtures

── 🇪🇸 LA LIGA ──
.laligastand                 → La Liga standings table
.laligamatches               → La Liga recent results
.laligaupcoming              → La Liga upcoming fixtures

── 🇩🇪 BUNDESLIGA ──
.bundesstand / .bundesliga   → Bundesliga standings table

── 🏀 BASKETBALL ──
.blive / .bball              → live basketball scores

── 🌍 MULTI-SPORT ──
.sports / .scoreboard        → live soccer, NBA & NFL scores
.sportsteam <name>           → sports team lookup
.sportsplayer <name>         → sports player lookup
.nbastandings                → NBA standings
.nflstandings                → NFL standings
.soccerstandings             → soccer standings
```

---

### 🔧 Tools & Utilities
```
── 🌐 Web & Screenshot ──
.ss <url>              → desktop screenshot
.ssphone <url>         → mobile screenshot
.sstab <url>           → tablet screenshot
.sspc <url>            → PC screenshot
.web2zip <url>         → download website as ZIP
.obfuscate <code>      → obfuscate JavaScript code
.encrypt <text>        → encrypt text

── 🌤️ Weather & Translate ──
.weather <city>        → current weather & forecast
.translate <text>      → auto-detect & translate

── 🔊 Audio & QR ──
.tts <text>            → text to speech
.createqr <text>       → generate QR code

── 🖼️ Image Tools ──
.carbon <code>         → code snippet as image
.imgscan               → AI image scan (reply to image)
.removebg              → remove image background
.remini                → enhance / upscale photo

── 🌐 Network & DNS ──
.dns <domain>          → DNS records
.headers <url>         → HTTP headers
.servercheck <url>     → server status check
.proxy                 → get fresh proxies

── 📂 File & Misc ──
.url <file>            → upload file, get link
.tempmail              → generate temp email
.tempmail inbox        → check temp email inbox
.netinfo <ip>          → IP network lookup
```

---

### 😄 Fun & Social
```
.dare / .truth            → dare or truth questions
.rizz                     → rizz lines
.joke / .funjokes         → random jokes
.meme                     → random meme image
.waifu                    → random anime waifu
.eightball <q>            → magic 8 ball
.trivia                   → random trivia question
.hangman                  → start a hangman game
.tictactoe                → play tic-tac-toe
.ship @a @b               → ship two users
.simp @user               → simp meter
.wasted @user             → GTA wasted overlay
.insult / .roast @user    → roast someone
.compliment @user         → compliment someone
.flirt @user              → send a flirt
.advice                   → random life advice
.quote                    → random quote
.friendship               → friendship message card
.lovetext                 → love message card
.heartbreak               → heartbreak card
.gratitude / .thankyou    → gratitude card
.newyear                  → New Year card
.xmas                     → Christmas card
.halloween                → Halloween card
.valentines               → Valentine's card
.mothersday / .fathersday → special day cards
.bfday / .gfday           → birthday cards
.goodnight                → good night message
.shayari                  → shayari poem
```

---

### 🎮 Gaming Sensitivity
```
.freefiresensi <device> [RAM]GB <Android|iOS>   → Free Fire (General, Red Dot, Scopes, DPI)
.pubgsensi <device> [RAM]GB <Android|iOS>       → PUBG Mobile (Camera, ADS, Gyroscope)
.codmsensi <device> [RAM]GB <Android|iOS>       → Call of Duty Mobile (Camera, ADS, Gyro)
.bssensi <device> [RAM]GB <Android|iOS>         → Blood Strike (Camera, ADS, Gyroscope)
```
> RAM is optional — e.g. `.pubgsensi iPhone 15 Pro Max iOS`

---

### 🖼️ Stickers & Image Effects
```
.sticker               → image / video to sticker
.sticker-alt           → alternate sticker converter
.stickertelegram       → Telegram-style sticker
.stickercrop           → crop to sticker
.attp <text>           → animated text sticker
.emojimix <e1> <e2>   → mix two emojis
.removebg              → remove background
.img-blur              → blur image
.simage                → generate image from text
+ more filters, effects and overlays
```

---

### 🎨 Textpro Image Styles
```
.textpro <style> <text>   → generate styled text as image

Styles: 3d · 3dblue · 3dgold · 3dsteel · 3dteal · 3dsilver ·
        neon · neonglow · neonstroke · neonheat · neonpink ·
        fire · firestroke · ice · icestroke · smoke · smokering ·
        water · metallic · chrome · gold · galaxy · glitter ·
        graffiti · retrowave · cyberpunk · matrix · anime ·
        horror · wedding · birthday · christmas · cartoon · bubble

Example: .textpro neon DARATECH
```

---

### 📱 Temp Phone & SMS
```
.tempphone             → generate a temporary phone number
.smsinbox <number>     → check SMS inbox for a temp number
```

---

### 💬 Anime Quotes
```
.charquote <character>   → get a quote by anime character  (e.g. .charquote naruto)
.showquote <anime>       → get a quote from an anime show  (e.g. .showquote attack on titan)
```
> For streaming/download links use `.anime` (Movies category).

---

### 📚 Manga
```
.manga <title>               → search manga / manhwa / manhua
.manga details <slug>        → full info + chapter list
.manga read <chapter-slug>   → read chapter (sends all pages)
.manga dl <slug> <ch>        → download chapter as ZIP
.manga dls <slug> <f> <t>    → download chapter range as ZIP
.manga popular [page]        → popular titles
.manga latest [page]         → latest releases
.manga genres                → full genre list
.manga genre <slug> [page]   → browse by genre
.manga home                  → homepage (trending + latest)
.manga browse [opts]         → advanced filter
```
Powered by RosyScans.

---

### 🛡️ Group Management
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

---

### ⚙️ Owner & Bot Settings
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

---

### 💰 Crypto
```
.crypto <coin>     → live price, 24h change, market cap
.cryptotop         → top 10 coins by market cap
.cryptotrend       → trending coins
.cryptoconv        → crypto conversion
```

---

### Plus More
`📖 Language & Define` · `🌍 Country Info` · `🐾 Animals` · `🍽️ Food & Drinks` · `🌌 Space & Science` · `🔠 Text Tools` · `✏️ Fonts` · `🎲 Generators` · `✝️ Bible` · `📐 Converters` · `💸 Economy`

---

## Project Structure

```
DaraTech-Bot-V1/
├── index.js            → entry point, WhatsApp connection & session bootstrap
├── main.js             → message router — all command switch cases
├── settings.js         → bot config (name, number, update URL)
├── config.js           → dotenv loader
├── .env                → your secrets (gitignored, never pushed)
├── .env.example        → copy this to .env
├── commands/           → individual command files
├── lib/
│   ├── gifted.js       → GiftedTech API helpers (primary API)
│   ├── categories.js   → 29 category definitions for .menu & .help
│   ├── reactions.js    → emoji reactions for every command
│   ├── isOwner.js      → owner / sudo permission checks
│   └── isBanned.js     → ban state checks
├── data/               → runtime JSON state (bans, warns, groups, economy)
└── session/            → Baileys auth state files (gitignored)
```

---

## Update System

```
.update              → pull latest code from GitHub, restart automatically
.autoupdate on/off   → toggle auto-updates
```

**How `.update` works:**
1. Fetches latest commits from GitHub
2. Runs `git reset --hard` + `git clean` — code is fully updated
3. `.env` and `session/` are gitignored — never touched
4. `SESSION_ID` from `.env` restores your session on restart
5. Bot is back online with no re-pairing needed

---

## Re-pairing (if ever needed)

```bash
rm -rf session/
# In .env: SESSION_ID=
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

Made with ❤️ by **Daratech** · [GitHub](https://github.com/adtelecominfo-png)

⭐ Star this repo if it helps you!

</div>
