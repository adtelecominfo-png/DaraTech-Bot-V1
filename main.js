
// 🧹 Fix for ENOSPC / temp overflow in hosted panels
const fs = require('fs');
const path = require('path');

// Redirect temp storage away from system /tmp
const customTemp = path.join(process.cwd(), 'temp');
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

// Auto-cleaner every 3 hours
setInterval(() => {
  fs.readdir(customTemp, (err, files) => {
    if (err) return;
    for (const file of files) {
      const filePath = path.join(customTemp, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && Date.now() - stats.mtimeMs > 3 * 60 * 60 * 1000) {
          fs.unlink(filePath, () => {});
        }
      });
    }
  });
  console.log('🧹 Temp folder auto-cleaned');
}, 3 * 60 * 60 * 1000);

const settings = require('./settings');
require('./config.js');
const { isBanned } = require('./lib/isBanned');
const yts = require('yt-search');
const { fetchBuffer } = require('./lib/myfunc');
const fetch = require('node-fetch');
const ytdl = require('ytdl-core');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const { isSudo } = require('./lib/index');
const isOwnerOrSudo = require('./lib/isOwner');
const { autotypingCommand, isAutotypingEnabled, handleAutotypingForMessage, handleAutotypingForCommand, showTypingAfterCommand } = require('./commands/autotyping');
const { autoreadCommand, isAutoreadEnabled, handleAutoread } = require('./commands/autoread');

// Command imports
const savestatusCommand = require('./commands/savestatus');
const unpairCommand = require('./commands/unpair');
const autojoinCommand = require('./commands/autojoin');
const pairCommand = require('./commands/pair');
const tagAllCommand = require('./commands/tagall');
const helpCommand = require('./commands/help');
const menuCommand = require('./commands/menu');
const banCommand = require('./commands/ban');
const { promoteCommand } = require('./commands/promote');
const { demoteCommand } = require('./commands/demote');
const muteCommand = require('./commands/mute');
const unmuteCommand = require('./commands/unmute');
const stickerCommand = require('./commands/sticker');
const isAdmin = require('./lib/isAdmin');
const warnCommand = require('./commands/warn');
const warningsCommand = require('./commands/warnings');
const ttsCommand = require('./commands/tts');
const { tictactoeCommand, handleTicTacToeMove } = require('./commands/tictactoe');
const { incrementMessageCount, topMembers } = require('./commands/topmembers');
const ownerCommand = require('./commands/owner');
const deleteCommand = require('./commands/delete');
const { handleAntilinkCommand, handleLinkDetection } = require('./commands/antilink');
const { handleAntitagCommand, handleTagDetection } = require('./commands/antitag');
const { Antilink } = require('./lib/antilink');
const { handleMentionDetection, mentionToggleCommand, setMentionCommand } = require('./commands/mention');
const memeCommand = require('./commands/meme');
const tagCommand = require('./commands/tag');
const tagNotAdminCommand = require('./commands/tagnotadmin');
const hideTagCommand = require('./commands/hidetag');
const jokeCommand = require('./commands/joke');
const quoteCommand = require('./commands/quote');
const factCommand = require('./commands/fact');
const weatherCommand = require('./commands/weather');
const newsCommand = require('./commands/news');
const kickCommand = require('./commands/kick');
const simageCommand = require('./commands/simage');
const attpCommand = require('./commands/attp');
const { startHangman, guessLetter } = require('./commands/hangman');
const { startTrivia, answerTrivia } = require('./commands/trivia');
const { complimentCommand } = require('./commands/compliment');
const { insultCommand } = require('./commands/insult');
const { eightBallCommand } = require('./commands/eightball');
const { lyricsCommand } = require('./commands/lyrics');
const { dareCommand } = require('./commands/dare');
const { truthCommand } = require('./commands/truth');
const { clearCommand } = require('./commands/clear');
const { aliveCommand, communityCommand } = require('./commands/alive');
const blurCommand = require('./commands/img-blur');
const { welcomeCommand, handleJoinEvent } = require('./commands/welcome');
const { goodbyeCommand, handleLeaveEvent } = require('./commands/goodbye');
const githubCommand = require('./commands/github');
const { handleAntiBadwordCommand, handleBadwordDetection } = require('./lib/antibadword');
const antibadwordCommand = require('./commands/antibadword');
const { handleChatbotCommand, handleChatbotResponse, handleBotchatCommand, handleVeloraNameTrigger } = require('./commands/chatbot');
const { dirCommand, searchDirCommand } = require('./commands/dir');
const takeCommand = require('./commands/take');
const { flirtCommand } = require('./commands/flirt');
const characterCommand = require('./commands/character');
const wastedCommand = require('./commands/wasted');
const shipCommand = require('./commands/ship');
const groupInfoCommand = require('./commands/groupinfo');
const resetlinkCommand = require('./commands/resetlink');
const staffCommand = require('./commands/staff');
const unbanCommand = require('./commands/unban');
const emojimixCommand = require('./commands/emojimix');
const { handlePromotionEvent } = require('./commands/promote');
const { handleDemotionEvent } = require('./commands/demote');
const viewOnceCommand = require('./commands/viewonce');
const { vvdmCommand } = require('./commands/viewonce');
const clearSessionCommand = require('./commands/clearsession');
const { autoStatusCommand, handleStatusUpdate } = require('./commands/autostatus');
const { simpCommand } = require('./commands/simp');
const { stupidCommand } = require('./commands/stupid');
const stickerTelegramCommand = require('./commands/stickertelegram');
const textmakerCommand = require('./commands/textmaker');
const { handleAntideleteCommand, handleMessageRevocation, storeMessage } = require('./commands/antidelete');
const { handleAntiViewOnceCommand, handleAntiViewOnce } = require('./commands/antiviewonce');
const { handleAntiLeaveCommand, handleAntiLeave } = require('./commands/antileave');
const { humanizeCommand, summarizeCommand, rewriteCommand, grammarCommand } = require('./commands/aitools');
const { toaudioCommand, tovideoCommand, togifCommand, toimageCommand, tovoiceCommand, bassboostCommand } = require('./commands/mediaconvert');
const snapchatCommand = require('./commands/snapchat');
const playlistCommand = require('./commands/playlist');
const jarvisCommand   = require('./commands/jarvis');
const { animegenCommand, artgenCommand, realgenCommand, visionCommand } = require('./commands/imagegen-extra');
const {
    antiimageCommand, antivideoCommand, antistickerCommand, antiaudioCommand,
    antidemoteCommand, antipromoteCommand, antimentionCommand,
    banlistCommand, gctimeCommand,
    handleAntiMediaMessage, handleAntiPromoteDemote,
} = require('./commands/antimedia');
const { handleAutoRecording, handleAutoRecordingCommand } = require('./commands/autorecording');
const { handleAutoReactStatus, handleAutoReactStatusCommand } = require('./commands/autoreactstatus');
const gcstatusCommand = require('./commands/gcstatus');
const { antigroupmentionCommand, handleAntigroupmentionMessage } = require('./commands/antigroupmention');
const { autostickerCommand, handleAutostickerMessage } = require('./commands/autosticker');
const { cleanCommand, storeForClean } = require('./commands/clean');
const { dbstatsCommand } = require('./commands/dbstats');
const clearTmpCommand = require('./commands/cleartmp');
const setProfilePicture = require('./commands/setpp');
const { setGroupDescription, setGroupName, setGroupPhoto } = require('./commands/groupmanage');
const instagramCommand = require('./commands/instagram');
const facebookCommand = require('./commands/facebook');
const spotifyCommand = require('./commands/spotify');
const { ytaudioCommand, ytaudioDocCommand } = require('./commands/play');
const tiktokCommand = require('./commands/tiktok');
// songCommand removed — $song/$play/$music aliases removed
const aiCommand = require('./commands/ai');
const {
    letmegptCommand, unlimitedAiCommand, claudeCommand, deepseekCommand,
    gpt4Command, llamaCommand, mistralAiCommand, geminiOcCommand,
    grokCommand, qwenAiCommand, o1Command,
    gifGeminiCommand, gifVeniceCommand, gifPollCommand,
    muslimAiCommand, transcriptCommand, giftFluxCommand, giftTxt2ImgCommand,
    magicStudioCommand,
} = require('./commands/gifted-ai');
const urlCommand = require('./commands/url');
const { handleTranslateCommand } = require('./commands/translate');
const { handleSsCommand } = require('./commands/ss');
const { addCommandReaction, handleAreactCommand } = require('./lib/reactions');
const { goodnightCommand } = require('./commands/goodnight');
const { shayariCommand } = require('./commands/shayari');
const { rosedayCommand } = require('./commands/roseday');
const imagineCommand = require('./commands/imagine');
const { ytvideoCommand } = require('./commands/video');
const {
    twitterDlCommand, igdlCommand, pinterestDlCommand, douyinCommand,
    snackVideoCommand, soundcloudCommand, mediafireCommand, gdriveCommand,
    videyCommand, webDlCommand, aioCommand,
} = require('./commands/downloaders');
const sudoCommand = require('./commands/sudo');
const { miscCommand, handleHeart } = require('./commands/misc');
const { animeCommand } = require('./commands/anime');
const { piesCommand, piesAlias } = require('./commands/pies');
const stickercropCommand = require('./commands/stickercrop');
const updateCommand = require('./commands/update');
const removebgCommand = require('./commands/removebg');
const { reminiCommand } = require('./commands/remini');
const { igsCommand } = require('./commands/igs');
const { anticallCommand, readState: readAnticallState } = require('./commands/anticall');
const { pmblockerCommand, readState: readPmBlockerState } = require('./commands/pmblocker');
const settingsCommand = require('./commands/settings');
const soraCommand = require('./commands/sora');
const movieCommand = require('./commands/movie');
const { mangaCommand } = require('./commands/manga');
// Add these lines with the other command imports (find a spot near other requires)
const uptimeCommand = require('./commands/uptime');
// Add these with your other requires
const { afkCommand, checkAFK, removeAFK } = require('./commands/afk');
const vcfCommand = require('./commands/vcf');
const addCommand = require('./commands/add');
const { muteUserCommand, isUserMuted } = require('./commands/mute-user');
const unmuteUserCommand = require('./commands/unmute-user');
const pinCommand = require('./commands/pin');
const pingCommand = require('./commands/ping');
const { cryptoPriceCommand, topCryptoCommand, trendingCryptoCommand, cryptoConvertCommand } = require('./commands/crypto');
const sunoCommand = require('./commands/suno');
const rizzCommand = require('./commands/rizz');
const unpinCommand = require('./commands/unpin');
const statsCommand = require('./commands/stats');
const gppCommand = require('./commands/gpp');
const leaveCommand = require('./commands/leave');
const calcCommand = require('./commands/calc');
const { netinfoCommand, cpuinfoCommand, meminfoCommand, diskinfoCommand, timezoneCommand } = require('./commands/netinfo');
const { autoUpdateCommand } = require('./lib/autoUpdate');
const freefireSensitivityCommand = require('./commands/freefiresensi');
const pubgSensiCommand = require('./commands/pubgsensi');
const codmSensiCommand = require('./commands/codmsensi');
const bsSensiCommand   = require('./commands/bssensi');
const grouplinkCommand = require('./commands/grouplink');
const listadminsCommand = require('./commands/listadmins');
const listonlineCommand = require('./commands/listonline');
const membercountCommand = require('./commands/membercount');
const clearwarnCommand = require('./commands/clearwarn');
const gifCommand = require('./commands/gif');
const reactCommand = require('./commands/react');
const blockCommand = require('./commands/block');
const { phoneCommand, lidCommand, jidCommand } = require('./commands/jidtools');
const unblockCommand = require('./commands/unblock');
// ── New commands (GiftedTech API + HANS-MD integrations) ─────────────────────
const apkCommand = require('./commands/apk');
const gitcloneCommand = require('./commands/gitclone');
const { ttstalkCommand, ghstalkCommand, igstalkCommand, twstalkCommand, wachannelCommand, ipstalkCommand, npmstalkCommand, steamstalkCommand } = require('./commands/stalk');
const { sportsCommand, sportsTeamCommand, sportsPlayerCommand, standingsCommand } = require('./commands/sports');
const { flivescoreCommand, fnewsCommand, fleaguesCommand, fstreamCommand, fplayerCommand, fteamCommand, fvenueCommand, bliveCommand, eplStandCommand, eplMatchesCommand, eplUpcomingCommand, laligaStandCommand, laligaMatchCommand, laligaUpCommand, bundesStandCommand } = require('./commands/gifted-sports');
const { animeinfoCommand, trendingAnimeCommand, animeIndoCommand } = require('./commands/animeinfo');
const tempmailCommand = require('./commands/tempmail');
const wallpaperCommand = require('./commands/wallpaper');
const ytsearchCommand = require('./commands/ytsearch');
const carbonCommand = require('./commands/carbon');
const createqrCommand = require('./commands/createqr');
const waifuCommand = require('./commands/waifu');
const boredCommand = require('./commands/bored');
const pinterestCommand = require('./commands/pinterest');
const imgscanCommand = require('./commands/imgscan');
const net9jaCommand = require('./commands/net9ja');
// ── New command bundles ──────────────────────────────────────────────────────
const { defineCommand, synonymCommand, antonymCommand, wordofdayCommand } = require('./commands/define');
const { wikiCommand } = require('./commands/wiki');
const { urbanCommand } = require('./commands/urban');
const { countryCommand, capitalCommand, flagCommand, timezoneCountryCommand } = require('./commands/country');
const { catfactCommand, catimageCommand, dogfactCommand, dogimageCommand, foxImageCommand, pandaImageCommand, koalaImageCommand, birbCommand, raccoonCommand } = require('./commands/animals');
const { randomRecipeCommand, searchRecipeCommand, cocktailCommand } = require('./commands/recipe');
const { apodCommand, issLocationCommand, spacefactCommand } = require('./commands/nasa');
const { reverseCommand, morseCommand, unmorseCommand, binaryCommand, unbinaryCommand, base64Command, unbase64Command, passwordCommand, uuidCommand } = require('./commands/texttools');
const {
    everyoneCommand, leavegcCommand, joinCommand, inviteCommand,
    getnameCommand, getdeskgcCommand, getppgcCommand, setppgcCommand,
    svcontactCommand, opengroupCommand, closegroupCommand, linkgcCommand,
    creategcCommand, promoteallCommand, demoteallCommand, kickallCommand,
    removeByCountryCommand
} = require('./commands/group');
const { numfactCommand, datefactCommand, yearfactCommand, mathfactCommand } = require('./commands/numfact');
const { dadjoke, chuckCommand, programmingJokeCommand, yomammaCommand, darkJokeCommand } = require('./commands/funjokes');
const { riddleCommand, riddleAnswerCommand } = require('./commands/riddle');
const { adviceCommand, wouldyouCommand, yesnoCommand, neverhaveieverCommand } = require('./commands/advice');
const { bibleCommand, dailyVerseCommand } = require('./commands/bible');
const { quranCommand, dailyAyahCommand }  = require('./commands/quran');
const { poemCommand, animequoteCommand, kanyeCommand } = require('./commands/poetry');
const { bmiCommand, ageCommand, celsiusCommand, fahrenheitCommand, kmtomilesCommand, milestokmCommand, kgtolbsCommand, lbstokg } = require('./commands/converter');
const { fancyCommand, boldtextCommand, italicCommand, bolditalicCommand, scriptCommand, frakturCommand, doubleCommand, sansCommand, monoCommand, wideCommand, smallcapsCommand, bubbleCommand, flipCommand, mirrorCommand } = require('./commands/fonts');
const { ttpCommand, canvasCommand, topdfCommand, web2zipCommand, proxyCommand, obfuscateCommand, obfuscate2Command, dnsCommand, headersCommand, servercheckCommand, ssphoneCommand, sstabCommand, sspcCommand, fantextCommand, fantext2Command, rcCommand, whoisCommand, tinyurlCommand, cleanuriCommand, vgdCommand, rebrandlyCommand, vurlCommand, adfocCommand, ssurCommand } = require('./commands/gifted-tools');
const { konachanCommand, kusonimeCommand, animenewCommand, charquoteCommand, showquoteCommand } = require('./commands/gifted-anime');
const { friendshipCommand, lovetextCommand, heartbreakCommand, gratitudeCommand, thankyouCommand, newyearCommand, xmasCommand, halloweenCommand, valentinesCommand, mothersdayCommand, fathersdayCommand, bfdayCommand, gfdayCommand } = require('./commands/gifted-fun');
const { gsearchCommand, gimageCommand, ttsearchCommand, chordCommand, hearthisCommand, npmpkgCommand, slyricsCommand, happymodCommand, scsearchCommand, wattpadCommand, stickersearchCommand } = require('./commands/gifted-search');
const getCommand  = require('./commands/get');
const qcardCommand = require('./commands/qcard');
const { textproCommand } = require('./commands/gifted-textpro');
const { ephotoCommand, ephoto2Command, ephotolistCommand } = require('./commands/gifted-ephoto');
const { tempphoneCommand, smsinboxCommand } = require('./commands/gifted-tempgen');
const { loremCommand, fakenameCommand, genemailCommand, randomnumCommand, coinflipCommand, dicerollCommand } = require('./commands/generators');
const economyCommand = require('./commands/economy');
// Global settings
global.packname = settings.packname;
global.ytch = "Daratech";

// channelInfo is kept as empty object — spreading it is a no-op (no newsletter)
const channelInfo = {};

async function handleMessages(sock, messageUpdate, printLog) {
    try {
        const { messages, type } = messageUpdate;
        if (type !== 'notify') return;

        const message = messages[0];
        if (!message?.message) return;

        // Handle autoread functionality
        await handleAutoread(sock, message);

        // Auto recording presence indicator
        handleAutoRecording(sock, message.key.remoteJid).catch(() => {});

        // Auto react to status updates
        if (message.key.remoteJid === 'status@broadcast') {
            handleAutoReactStatus(sock, message).catch(() => {});
        }

        // Anti-media enforcement (antiimage/antivideo/antisticker/antiaudio/antimention)
        handleAntiMediaMessage(sock, message).catch(() => {});
        // Anti group-mention enforcement
        handleAntigroupmentionMessage(sock, message).catch(() => {});
        // Auto-sticker conversion
        handleAutostickerMessage(sock, message).catch(() => {});
        // Store messages for $clean/$purge
        storeForClean(message);

        // Store message for antidelete feature
        if (message.message) {
            storeMessage(sock, message);
            handleAntiViewOnce(sock, message);
        }

        // Handle message revocation
        if (message.message?.protocolMessage?.type === 0) {
            await handleMessageRevocation(sock, message);
            return;
        }

        const chatId = message.key.remoteJid;
        const senderId = message.key.participant || message.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const senderIsSudo = await isSudo(senderId);
        // senderIsOwnerOrSudo is computed lazily below — only when handling a command —
        // so non-command messages (the vast majority) skip the expensive group-metadata fetch.
        let _cachedSenderIsOwnerOrSudo = null;
        const getSenderIsOwnerOrSudo = async () => {
            if (_cachedSenderIsOwnerOrSudo === null)
                _cachedSenderIsOwnerOrSudo = message.key.fromMe || await isOwnerOrSudo(senderId, sock, chatId);
            return _cachedSenderIsOwnerOrSudo;
        };

        // Handle button responses
        if (message.message?.buttonsResponseMessage) {
            const buttonId = message.message.buttonsResponseMessage.selectedButtonId;
            const chatId = message.key.remoteJid;

            if (buttonId === 'channel') {
                await sock.sendMessage(chatId, { 
                    text: '📢 *Join our Channel:*\https://whatsapp.com/channel/0029Vb70IdY60eBmvtGRT00R' 
                }, { quoted: message });
                return;
            } else if (buttonId === 'owner') {
                const ownerCommand = require('./commands/owner');
                await ownerCommand(sock, chatId);
                return;
            } else if (buttonId === 'support') {
                await sock.sendMessage(chatId, { 
                    text: `🔗 *Support*\n\nhttps://https://chat.whatsapp.com/EgWYHIPowuS1wv54JII6Ff?mode=hqrc` 
                }, { quoted: message });
                return;
            }
        }

        const userMessage = (
            message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            message.message?.buttonsResponseMessage?.selectedButtonId?.trim() ||
            ''
        ).toLowerCase().replace(/\.\s+/g, '.').trim();

        // Preserve raw message for commands like $tag that need original casing
        const rawText = message.message?.conversation?.trim() ||
            message.message?.extendedTextMessage?.text?.trim() ||
            message.message?.imageMessage?.caption?.trim() ||
            message.message?.videoMessage?.caption?.trim() ||
            '';

        // Only log command usage
        if (userMessage.startsWith('$')) {
            console.log(`📝 Command used in ${isGroup ? 'group' : 'private'}: ${userMessage}`);
        }
        // Read bot mode once; don't early-return so moderation can still run in private mode
        let isPublic = true;
        let disabledGroups = [];
        try {
            const modeData = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
            if (Array.isArray(modeData.disabledGroups)) disabledGroups = modeData.disabledGroups;
        } catch (error) {
            console.error('Error checking access mode:', error);
        }
        // Fast check: fromMe covers the bot owner; senderIsSudo covers sudo users.
        // Full isOwnerOrSudo (which may fetch group metadata) is only called for commands.
        const isOwnerOrSudoCheck = message.key.fromMe || senderIsSudo;

        // If this group has been disabled by owner, ignore everything (owner bypasses)
        if (isGroup && disabledGroups.includes(chatId) && !isOwnerOrSudoCheck) return;
        // Check if user is banned (skip ban check for unban command)
        if (isBanned(senderId) && !userMessage.startsWith('$unban')) {
            // Only respond occasionally to avoid spam
            if (Math.random() < 0.1) {
                await sock.sendMessage(chatId, {
                    text: '❌ You are banned from using Daratech. Contact an admin to get unbanned.',
                    ...channelInfo
                });
            }
            return;
        }

        // First check if it's a game move
        if (/^[1-9]$/.test(userMessage) || userMessage.toLowerCase() === 'surrender') {
            await handleTicTacToeMove(sock, chatId, senderId, userMessage);
            return;
        }

        /*  // Basic message response in private chat
          if (!isGroup && (userMessage === 'hi' || userMessage === 'hello' || userMessage === 'bot' || userMessage === 'hlo' || userMessage === 'hey' || userMessage === 'bro')) {
              await sock.sendMessage(chatId, {
                  text: 'Hi, How can I help you?\nYou can use $menu for more info and commands.',
                  ...channelInfo
              });
              return;
          } */

        if (!message.key.fromMe) incrementMessageCount(chatId, senderId);

        // Check for bad words and antilink FIRST, before ANY other processing
        // Always run moderation in groups, regardless of mode
        if (isGroup) {
            if (userMessage) {
                await handleBadwordDetection(sock, chatId, message, userMessage, senderId);
            }
            // Antilink checks message text internally, so run it even if userMessage is empty
            await Antilink(message, sock);
        }

        // PM blocker: block non-owner DMs when enabled (do not ban)
        if (!isGroup && !message.key.fromMe && !senderIsSudo) {
            try {
                const pmState = readPmBlockerState();
                if (pmState.enabled) {
                    // Inform user, delay, then block without banning globally
                    await sock.sendMessage(chatId, { text: pmState.message || 'Private messages are blocked. Please contact the owner in groups only.' });
                    await new Promise(r => setTimeout(r, 1500));
                    try { await sock.updateBlockStatus(chatId, 'block'); } catch (e) { }
                    return;
                }
            } catch (e) { }
        }

        // Then check for command prefix
        // 👀 is a non-dot trigger for $vv2 — let it fall through to the switch
        if (userMessage === '👀') {
            await vvdmCommand(sock, chatId, message, true); // noReact — no ✅ on emoji trigger
            return;
        }

        if (!userMessage.startsWith('$')) {

            if (isGroup) {
                // Always run moderation features (antitag) regardless of mode
                await handleTagDetection(sock, chatId, message, senderId);
                await handleMentionDetection(sock, chatId, message);

                // Only run chatbot in public mode or for owner/sudo
                if (isPublic || isOwnerOrSudoCheck) {
                    await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    // 🔥 AFK CHECKING CODE - ADD AFTER VARIABLE DEFINITIONS 🔥
// Check for AFK users when someone is mentioned
if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
    const mentioned = message.message.extendedTextMessage.contextInfo.mentionedJid;
    for (const mention of mentioned) {
        const afkInfo = checkAFK(mention);
        if (afkInfo) {
            await sock.sendMessage(chatId, {
                text: `⚠️ @${mention.split('@')[0]} is AFK\n📝 *Reason:* ${afkInfo.reason}`,
                mentions: [mention]
            });
        }
    }
}

// Check if message sender was AFK and remove status
if (checkAFK(senderId)) {
    removeAFK(senderId);
    const ownerName = senderId.split('@')[0];
    await sock.sendMessage(chatId, { 
        text: `✪ \`\`\`Welcome Back!\`\`\`\n\n@${ownerName} is back.`,
        mentions: [senderId]
    });
}
// 🔥 END OF AFK CODE 🔥
                }
            }

            // Velora name trigger — DMs and groups, no $ needed
            if (/velora/i.test(userMessage)) {
                await handleVeloraNameTrigger(sock, chatId, message, userMessage, senderId);
            }
            return;
        }
        // In private mode, only owner/sudo can run commands
        if (!isPublic && !isOwnerOrSudoCheck) {
            return;
        }

        // List of admin commands
        const adminCommands = ['$mute', '$unmute', '$ban', '$unban', '$promote', '$demote', '$kick', '$tagall', '$tagnotadmin', '$hidetag', '$antilink', '$antitag', '$setgdesc', '$setgname', '$setgpp', '$antileave', '$antiimage', '$antivideo', '$antisticker', '$antiaudio', '$antidemote', '$antipromote', '$antimention', '$gcstatus', '$groupstatus', '$antigroupmention', '$agm', '$autosticker', '$autos', '$asticker', '$clean', '$purge'];
        const isAdminCommand = adminCommands.some(cmd => userMessage.startsWith(cmd));

        // List of owner commands
        const ownerCommands = ['$mode', '$autostatus', '$antidelete', '$antiviewonce', '$cleartmp', '$setpp', '$clearsession', '$areact', '$autoreact', '$autotyping', '$autoread', '$pmblocker', '$autojoin', '$autoupdate', '$autorecording', '$autoreactstatus', '$dbstats'];
        const isOwnerCommand = ownerCommands.some(cmd => userMessage.startsWith(cmd));

        let isSenderAdmin = false;
        let isBotAdmin = false;

        // Check admin status only for admin commands in groups
        if (isGroup && isAdminCommand) {
            const adminStatus = await isAdmin(sock, chatId, senderId);
            isSenderAdmin = adminStatus.isSenderAdmin;
            isBotAdmin = adminStatus.isBotAdmin;

            if (!isBotAdmin) {
                await sock.sendMessage(chatId, { text: 'Please make the bot an admin to use admin commands.', ...channelInfo }, { quoted: message });
                return;
            }

            if (
                userMessage.startsWith('$mute') ||
                userMessage === '$unmute' ||
                userMessage.startsWith('$ban') ||
                userMessage.startsWith('$unban') ||
                userMessage.startsWith('$promote') ||
                userMessage.startsWith('$demote')
            ) {
                if (!isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, {
                        text: 'Sorry, only group admins can use this command.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
            }
        }

        // Check owner status for owner commands (lazy — only fetches group metadata if needed)
        if (isOwnerCommand) {
            if (!await getSenderIsOwnerOrSudo()) {
                await sock.sendMessage(chatId, { text: '❌ This command is only available for the owner or sudo!' }, { quoted: message });
                return;
            }
        }

        // React to the command immediately — before any slow processing so the user
        // sees the emoji the instant they send a command, not after the response.
        addCommandReaction(sock, message, userMessage).catch(() => {});

        // Command handlers - Execute commands immediately without waiting for typing indicator
        // We'll show typing indicator after command execution if needed
        let commandExecuted = false;

        switch (true) {
            // === NEW COMMANDS ===
            case userMessage.startsWith('$savestatus'):
                await savestatusCommand(sock, chatId, message);
                commandExecuted = true;
                break;

                case userMessage.startsWith('$uptime'):
    await uptimeCommand(sock, chatId, message);
    commandExecuted = true;
    break;
    
    // Add these cases in your switch statement
case userMessage.startsWith('$afk'):
    await afkCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$vcf'):
    await vcfCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$add'):
    await addCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$mute-user'):
    await muteUserCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$unmute-user'):
    await unmuteUserCommand(sock, chatId, message);
    commandExecuted = true;
    break;
    
  case userMessage.startsWith('$ping'):
        await pingCommand(sock, chatId, message);
        commandExecuted = true;
        break;

case userMessage.startsWith('$pinterest') && !userMessage.startsWith('$pinterestdl') && !userMessage.startsWith('$pintdl') && !userMessage.startsWith('$pdl'):
    await pinterestCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$pin') &&
     !userMessage.startsWith('$pinterest') &&
     !userMessage.startsWith('$pindl') &&
     !userMessage.startsWith('$pintdl') &&
     !userMessage.startsWith('$pdl'):
    await pinCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$unpin'):
    await unpinCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$stats'):
    await statsCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$gpp'):
    await gppCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage === '$leavegc':
    await leavegcCommand(sock, chatId, message);
    commandExecuted = true;
    break;

case userMessage.startsWith('$leave') && !userMessage.startsWith('$leaves'):
    await leaveCommand(sock, chatId, message);
    commandExecuted = true;
    break;


            case userMessage.startsWith('$unpair'):
                const unpairArgs = rawText.slice(7).trim();
                await unpairCommand(sock, chatId, message, unpairArgs);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$autojoin'):
                const autojoinArgs = rawText.slice(9).trim();
                await autojoinCommand(sock, chatId, message, autojoinArgs);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$pair'):
                const pairArgs = rawText.slice(5).trim();
                await pairCommand(sock, chatId, message, pairArgs);
                commandExecuted = true;
                break;
                // Add this case in the switch statement - find a good place to add it
case userMessage.startsWith('$freefiresensi'):
    await freefireSensitivityCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$pubgsensi'):
    await pubgSensiCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$codmsensi'):
    await codmSensiCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

case userMessage.startsWith('$bssensi'):
    await bsSensiCommand(sock, chatId, message, userMessage);
    commandExecuted = true;
    break;

            // === EXISTING COMMANDS ===
            case userMessage === '$simage': {
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                if (quotedMessage?.stickerMessage) {
                    await simageCommand(sock, quotedMessage, chatId);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please reply to a sticker with the $simage command to convert it.', ...channelInfo }, { quoted: message });
                }
                commandExecuted = true;
                break;
            }
            case userMessage === '$kickall':
                await kickallCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$kick'):
                const mentionedJidListKick = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await kickCommand(sock, chatId, senderId, mentionedJidListKick, message);
                break;
            case userMessage.startsWith('$mute'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const muteArg = parts[1];
                    const muteDuration = muteArg !== undefined ? parseInt(muteArg, 10) : undefined;
                    if (muteArg !== undefined && (isNaN(muteDuration) || muteDuration <= 0)) {
                        await sock.sendMessage(chatId, { text: 'Please provide a valid number of minutes or use $mute with no number to mute immediately.', ...channelInfo }, { quoted: message });
                    } else {
                        await muteCommand(sock, chatId, senderId, message, muteDuration);
                    }
                }
                break;
            case userMessage === '$unmute':
                await unmuteCommand(sock, chatId, senderId);
                break;
            case userMessage.startsWith('$ban'):
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use $ban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await banCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$unban'):
                if (!isGroup) {
                    if (!message.key.fromMe && !senderIsSudo) {
                        await sock.sendMessage(chatId, { text: 'Only owner/sudo can use $unban in private chat.' }, { quoted: message });
                        break;
                    }
                }
                await unbanCommand(sock, chatId, message);
                break;
            case userMessage === '$menu' || userMessage === '$bot' || userMessage === '$list' ||
                 userMessage.startsWith('$menu '):
                await menuCommand(sock, chatId, message, userMessage.startsWith('$menu ') ? userMessage.slice(5).trim() : '');
                commandExecuted = true;
                break;
            case userMessage === '$help' || userMessage.startsWith('$help '):
                await helpCommand(sock, chatId, message, userMessage.startsWith('$help ') ? userMessage.slice(5).trim() : '');
                commandExecuted = true;
                break;
            case userMessage === '$sticker' || userMessage === '$s':
                await stickerCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$warnings'):
                const mentionedJidListWarnings = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warningsCommand(sock, chatId, mentionedJidListWarnings);
                break;
            case userMessage.startsWith('$warn'):
                const mentionedJidListWarn = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await warnCommand(sock, chatId, senderId, mentionedJidListWarn, message);
                break;
            case userMessage.startsWith('$tts') && !userMessage.startsWith('$ttstalk') && !userMessage.startsWith('$tiktokstalk') && !userMessage.startsWith('$ttsearch'):
                const text = userMessage.slice(4).trim();
                await ttsCommand(sock, chatId, text, message);
                break;
            case userMessage.startsWith('$delete') || userMessage.startsWith('$del'):
                await deleteCommand(sock, chatId, message, senderId);
                break;
            case userMessage.startsWith('$attp'):
                await attpCommand(sock, chatId, message);
                break;

            case userMessage === '$settings':
                await settingsCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$mode'):
                // Check if sender is the owner
                if (!await getSenderIsOwnerOrSudo()) {
                    await sock.sendMessage(chatId, { text: 'Only bot owner can use this command!', ...channelInfo }, { quoted: message });
                    return;
                }
                // Read current data first
                let data;
                try {
                    data = JSON.parse(fs.readFileSync('./data/messageCount.json'));
                } catch (error) {
                    console.error('Error reading access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to read bot mode status', ...channelInfo });
                    return;
                }

                const action = userMessage.split(' ')[1]?.toLowerCase();
                // If no argument provided, show current status
                if (!action) {
                    const currentMode = data.isPublic ? 'public' : 'private';
                    const grpStatus = isGroup
                        ? ((data.disabledGroups || []).includes(chatId) ? '❌ disabled' : '✅ enabled')
                        : 'N/A (not a group)';
                    await sock.sendMessage(chatId, {
                        text: `🤖 *BOT MODE*\n\n🌐 Global: *${currentMode}*\n👥 This group: *${grpStatus}*\n\nUsage:\n*$mode public* — allow everyone\n*$mode private* — owner only\n*$mode group off* — disable bot in this group\n*$mode group on* — re-enable bot in this group\n*$mode g off/on* — short alias`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                // ── Group mode subcommand ──────────────────────────────────────
                if (action === 'group' || action === 'g') {
                    if (!isGroup) {
                        await sock.sendMessage(chatId, { text: '❌ This subcommand can only be used inside a group.', ...channelInfo }, { quoted: message });
                        return;
                    }
                    const subAction = userMessage.split(' ')[2]?.toLowerCase();
                    if (!subAction) {
                        const grpCurrent = (data.disabledGroups || []).includes(chatId) ? '❌ disabled' : '✅ enabled';
                        await sock.sendMessage(chatId, {
                            text: `👥 Bot status in this group: *${grpCurrent}*\n\n*$mode group off* — Disable bot in this group\n*$mode group on* — Re-enable bot in this group`,
                            ...channelInfo
                        }, { quoted: message });
                        return;
                    }
                    if (subAction !== 'on' && subAction !== 'off') {
                        await sock.sendMessage(chatId, {
                            text: '❌ Usage: *$mode group on/off*  or  *$mode g on/off*',
                            ...channelInfo
                        }, { quoted: message });
                        return;
                    }
                    const dGroups = Array.isArray(data.disabledGroups) ? data.disabledGroups : [];
                    try {
                        if (subAction === 'off') {
                            if (!dGroups.includes(chatId)) dGroups.push(chatId);
                            data.disabledGroups = dGroups;
                            fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
                            await sock.sendMessage(chatId, {
                                text: '🔕 Bot has been *disabled* for this group.\n\n_Only the bot owner can re-enable it with_ *$mode group on*',
                            });
                        } else {
                            data.disabledGroups = dGroups.filter(g => g !== chatId);
                            fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
                            await sock.sendMessage(chatId, {
                                text: '✅ Bot has been *re-enabled* for this group.',
                                ...channelInfo
                            }, { quoted: message });
                        }
                    } catch (err) {
                        console.error('Error updating group mode:', err);
                        await sock.sendMessage(chatId, { text: '❌ Failed to update group mode.', ...channelInfo }, { quoted: message });
                    }
                    return;
                }

                if (action !== 'public' && action !== 'private') {
                    await sock.sendMessage(chatId, {
                        text: '❌ Usage: *$mode public/private*\nOr for groups: *$mode group off/on*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }

                try {
                    data.isPublic = action === 'public';
                    fs.writeFileSync('./data/messageCount.json', JSON.stringify(data, null, 2));
                    await sock.sendMessage(chatId, { text: `✅ Bot is now in *${action}* mode`, ...channelInfo });
                } catch (error) {
                    console.error('Error updating access mode:', error);
                    await sock.sendMessage(chatId, { text: 'Failed to update bot access mode', ...channelInfo });
                }
                break;
            case userMessage.startsWith('$anticall'):
                if (!await getSenderIsOwnerOrSudo()) {
                    await sock.sendMessage(chatId, { text: 'Only owner/sudo can use anticall.' }, { quoted: message });
                    break;
                }
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await anticallCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$pmblocker'):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    await pmblockerCommand(sock, chatId, message, args);
                }
                commandExecuted = true;
                break;
            case userMessage === '$owner':
                await ownerCommand(sock, chatId);
                break;
             case userMessage === '$tagall':
                await tagAllCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '$tagnotadmin':
                await tagNotAdminCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$hidetag'):
                {
                    const messageText = rawText.slice(8).trim();
                    const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                    await hideTagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                }
                break;
            case userMessage.startsWith('$tag'):
                const messageText = rawText.slice(4).trim();  // use rawText here, not userMessage
                const replyMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
                await tagCommand(sock, chatId, senderId, messageText, replyMessage, message);
                break;
            case userMessage.startsWith('$antilink'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage.startsWith('$antitag'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, {
                        text: 'This command can only be used in groups.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, {
                        text: 'Please make the bot an admin first.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                await handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message);
                break;
            case userMessage === '$meme':
                await memeCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$get ') || userMessage === '$get':
                await getCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$q') && (userMessage === '$q' || userMessage.startsWith('$q ')):
                await qcardCommand(sock, chatId, message);
                break;
            case userMessage === '$joke':
                await jokeCommand(sock, chatId, message);
                break;
            case userMessage === '$quote':
                await quoteCommand(sock, chatId, message);
                break;
            case userMessage === '$fact':
                await factCommand(sock, chatId, message, message);
                break;
            case userMessage.startsWith('$weather'):
                const city = userMessage.slice(9).trim();
                if (city) {
                    await weatherCommand(sock, chatId, message, city);
                } else {
                    await sock.sendMessage(chatId, { text: 'Please specify a city, e.g., $weather London', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '$news':
                await newsCommand(sock, chatId);
                break;
            case userMessage.startsWith('$ttt') || userMessage.startsWith('$tictactoe'):
                const tttText = userMessage.split(' ').slice(1).join(' ');
                await tictactoeCommand(sock, chatId, senderId, tttText);
                break;
            case userMessage.startsWith('$move') && !userMessage.startsWith('$movie'):
                const position = parseInt(userMessage.split(' ')[1]);
                if (isNaN(position)) {
                    await sock.sendMessage(chatId, { text: 'Please provide a valid position number for Tic-Tac-Toe move.', ...channelInfo }, { quoted: message });
                } else {
                    tictactoeMove(sock, chatId, senderId, position);
                }
                break;
            case userMessage === '$topmembers':
                topMembers(sock, chatId, isGroup);
                break;
            case userMessage.startsWith('$hangman'):
                startHangman(sock, chatId);
                break;
            case userMessage.startsWith('$guess'):
                const guessedLetter = userMessage.split(' ')[1];
                if (guessedLetter) {
                    guessLetter(sock, chatId, guessedLetter);
                } else {
                    sock.sendMessage(chatId, { text: 'Please guess a letter using $guess <letter>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('$trivia'):
                startTrivia(sock, chatId);
                break;
            case userMessage.startsWith('$answer'):
                const answer = userMessage.split(' ').slice(1).join(' ');
                if (answer) {
                    answerTrivia(sock, chatId, answer);
                } else {
                    sock.sendMessage(chatId, { text: 'Please provide an answer using $answer <answer>', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('$compliment'):
                await complimentCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$insult'):
                await insultCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$8ball'):
                const question = userMessage.split(' ').slice(1).join(' ');
                await eightBallCommand(sock, chatId, question);
                break;
            case userMessage.startsWith('$lyrics'):
                const songTitle = userMessage.split(' ').slice(1).join(' ');
                await lyricsCommand(sock, chatId, songTitle, message);
                break;
            case userMessage.startsWith('$simp'):
                const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const mentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await simpCommand(sock, chatId, quotedMsg, mentionedJid, senderId);
                break;
            case userMessage.startsWith('$stupid') || userMessage.startsWith('$itssostupid') || userMessage.startsWith('$iss'):
                const stupidQuotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const stupidMentionedJid = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const stupidArgs = userMessage.split(' ').slice(1);
                await stupidCommand(sock, chatId, stupidQuotedMsg, stupidMentionedJid, senderId, stupidArgs);
                break;
            case userMessage === '$dare':
                await dareCommand(sock, chatId, message);
                break;
            case userMessage === '$truth':
                await truthCommand(sock, chatId, message);
                break;
            case userMessage === '$clear':
                await cleanCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '$promoteall':
                await promoteallCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$promote'):
                const mentionedJidListPromote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await promoteCommand(sock, chatId, mentionedJidListPromote, message);
                break;
            case userMessage === '$demoteall':
                await demoteallCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$demote'):
                const mentionedJidListDemote = message.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
                await demoteCommand(sock, chatId, mentionedJidListDemote, message);
                break;
            case userMessage === '$alive':
                await aliveCommand(sock, chatId, message);
                break;
            case userMessage === '$community':
                await communityCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$mention '):
                {
                    const args = userMessage.split(' ').slice(1).join(' ');
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await mentionToggleCommand(sock, chatId, message, args, isOwner);
                }
                break;
            case userMessage === '$setmention':
                {
                    const isOwner = message.key.fromMe || senderIsSudo;
                    await setMentionCommand(sock, chatId, message, isOwner);
                }
                break;
            case userMessage.startsWith('$blur'):
                const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                await blurCommand(sock, chatId, message, quotedMessage);
                break;
            case userMessage.startsWith('$welcome'):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await welcomeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage.startsWith('$goodbye'):
                if (isGroup) {
                    // Check admin status if not already checked
                    if (!isSenderAdmin) {
                        const adminStatus = await isAdmin(sock, chatId, senderId);
                        isSenderAdmin = adminStatus.isSenderAdmin;
                    }

                    if (isSenderAdmin || message.key.fromMe) {
                        await goodbyeCommand(sock, chatId, message);
                    } else {
                        await sock.sendMessage(chatId, { text: 'Sorry, only group admins can use this command.', ...channelInfo }, { quoted: message });
                    }
                } else {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                }
                break;
            case userMessage === '$unknown':
            case userMessage === '$unknownofrun':
            case userMessage === '$daratechbot':
                await githubCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$antibadword'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                const adminStatus = await isAdmin(sock, chatId, senderId);
                isSenderAdmin = adminStatus.isSenderAdmin;
                isBotAdmin = adminStatus.isBotAdmin;

                if (!isBotAdmin) {
                    await sock.sendMessage(chatId, { text: '*Bot must be admin to use this feature*', ...channelInfo }, { quoted: message });
                    return;
                }

                await antibadwordCommand(sock, chatId, message, senderId, isSenderAdmin);
                break;
            case userMessage.startsWith('$chatbot'):
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups.', ...channelInfo }, { quoted: message });
                    return;
                }

                // Check if sender is admin or bot owner
                const chatbotAdminStatus = await isAdmin(sock, chatId, senderId);
                if (!chatbotAdminStatus.isSenderAdmin && !message.key.fromMe) {
                    await sock.sendMessage(chatId, { text: '*Only admins or bot owner can use this command*', ...channelInfo }, { quoted: message });
                    return;
                }

                const match = userMessage.slice(8).trim();
                await handleChatbotCommand(sock, chatId, message, match);
                break;
            case userMessage.startsWith('$take') || userMessage.startsWith('$steal'):
                {
                    const isSteal = userMessage.startsWith('$steal');
                    const sliceLen = isSteal ? 6 : 5; // '$steal' vs '$take'
                    const takeArgs = rawText.slice(sliceLen).trim().split(' ');
                    await takeCommand(sock, chatId, message, takeArgs);
                }
                break;
            case userMessage === '$flirt':
                await flirtCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$character'):
                await characterCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$waste'):
                await wastedCommand(sock, chatId, message);
                break;
            case userMessage === '$ship':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await shipCommand(sock, chatId, message);
                break;
            case userMessage === '$groupinfo' || userMessage === '$infogp' || userMessage === '$infogrupo':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await groupInfoCommand(sock, chatId, message);
                break;
            case userMessage === '$resetlink' || userMessage === '$revoke' || userMessage === '$anularlink':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await resetlinkCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '$staff' || userMessage === '$admins' || userMessage === '$listadmin':
                if (!isGroup) {
                    await sock.sendMessage(chatId, { text: 'This command can only be used in groups!', ...channelInfo }, { quoted: message });
                    return;
                }
                await staffCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$tourl') || userMessage.startsWith('$url'):
                await urlCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$emojimix') || userMessage.startsWith('$emix'):
                await emojimixCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$tg') || userMessage.startsWith('$stickertelegram') || userMessage.startsWith('$tgsticker') || userMessage.startsWith('$telesticker'):
                await stickerTelegramCommand(sock, chatId, message);
                break;

            case userMessage === '$vv':
                await viewOnceCommand(sock, chatId, message);
                break;
            case userMessage === '$vv2' || userMessage === '$vvdm' || userMessage === '👀':
                await vvdmCommand(sock, chatId, message, true); // noReact — no ✅ on emoji trigger
                break;
            case userMessage.startsWith('$botchat'):
            case userMessage.startsWith('$velora'): {
                const veloraQuery = userMessage.startsWith('$velora')
                    ? userMessage.slice(7).trim()
                    : userMessage.slice(8).trim();
                await handleBotchatCommand(sock, chatId, message, veloraQuery, senderId);
                break;
            }
            case userMessage === '$clearsession' || userMessage === '$clearsesi':
                await clearSessionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$autostatus'):
                const autoStatusArgs = userMessage.split(' ').slice(1);
                await autoStatusCommand(sock, chatId, message, autoStatusArgs);
                break;
            case userMessage.startsWith('$metallic'):
                await textmakerCommand(sock, chatId, message, userMessage, 'metallic');
                break;
            case userMessage.startsWith('$ice'):
                await textmakerCommand(sock, chatId, message, userMessage, 'ice');
                break;
            case userMessage.startsWith('$snow'):
                await textmakerCommand(sock, chatId, message, userMessage, 'snow');
                break;
            case userMessage.startsWith('$impressive'):
                await textmakerCommand(sock, chatId, message, userMessage, 'impressive');
                break;
            case userMessage.startsWith('$matrix'):
                await textmakerCommand(sock, chatId, message, userMessage, 'matrix');
                break;
            case userMessage.startsWith('$light'):
                await textmakerCommand(sock, chatId, message, userMessage, 'light');
                break;
            case userMessage.startsWith('$neon'):
                await textmakerCommand(sock, chatId, message, userMessage, 'neon');
                break;
            case userMessage.startsWith('$devil'):
                await textmakerCommand(sock, chatId, message, userMessage, 'devil');
                break;
            case userMessage.startsWith('$purple'):
                await textmakerCommand(sock, chatId, message, userMessage, 'purple');
                break;
            case userMessage.startsWith('$thunder'):
                await textmakerCommand(sock, chatId, message, userMessage, 'thunder');
                break;
            case userMessage.startsWith('$leaves'):
                await textmakerCommand(sock, chatId, message, userMessage, 'leaves');
                break;
            case userMessage.startsWith('$1917'):
                await textmakerCommand(sock, chatId, message, userMessage, '1917');
                break;
            case userMessage.startsWith('$arena'):
                await textmakerCommand(sock, chatId, message, userMessage, 'arena');
                break;
            case userMessage.startsWith('$hacker'):
                await textmakerCommand(sock, chatId, message, userMessage, 'hacker');
                break;
            case userMessage.startsWith('$sand'):
                await textmakerCommand(sock, chatId, message, userMessage, 'sand');
                break;
            case userMessage.startsWith('$blackpink'):
                await textmakerCommand(sock, chatId, message, userMessage, 'blackpink');
                break;
            case userMessage.startsWith('$glitch'):
                await textmakerCommand(sock, chatId, message, userMessage, 'glitch');
                break;
            case userMessage.startsWith('$fire'):
                await textmakerCommand(sock, chatId, message, userMessage, 'fire');
                break;
            case userMessage.startsWith('$antidelete'):
                const antideleteMatch = userMessage.slice(11).trim();
                await handleAntideleteCommand(sock, chatId, message, antideleteMatch);
                break;
            case userMessage.startsWith('$antiviewonce'):
                await handleAntiViewOnceCommand(sock, chatId, message, userMessage.slice(13).trim());
                break;
            case userMessage.startsWith('$antileave'):
                await handleAntiLeaveCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$humanize'):
                await humanizeCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$summarize') || userMessage.startsWith('$summary'):
                await summarizeCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$rewrite'):
                await rewriteCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$grammar'):
                await grammarCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$toaudio'):
                await toaudioCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$tovideo'):
                await tovideoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$togif'):
                await togifCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$toimage'):
                await toimageCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$tovoice') || userMessage.startsWith('$ptt'):
                await tovoiceCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$bassboost') || userMessage.startsWith('$bass'):
                await bassboostCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$snapchat') || userMessage.startsWith('$snap') || (userMessage.startsWith('$sc ') && userMessage.includes('snapchat')):
                await snapchatCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$playlist'):
                await playlistCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$jarvis'):
                await jarvisCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$animegen'):
                await animegenCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$artgen'):
                await artgenCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$realgen'):
                await realgenCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$vision'):
                await visionCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$antiimage'):
                await antiimageCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antivideo'):
                await antivideoCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antisticker'):
                await antistickerCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antiaudio'):
                await antiaudioCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antidemote'):
                await antidemoteCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antipromote'):
                await antipromoteCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antimention'):
                await antimentionCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$banlist'):
                await banlistCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$gctime'):
                await gctimeCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$gcstatus'):
            case userMessage.startsWith('$groupstatus'):
                await gcstatusCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$antigroupmention'):
            case userMessage.startsWith('$agm'):
                await antigroupmentionCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$autosticker'):
            case userMessage.startsWith('$autos') && !userMessage.startsWith('$autostatus'):
            case userMessage.startsWith('$asticker'):
                await autostickerCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$clean'):
            case userMessage.startsWith('$purge'):
                await cleanCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$dbstats'):
                await dbstatsCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$autorecording'):
                await handleAutoRecordingCommand(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$autoreactstatus'):
                await handleAutoReactStatusCommand(sock, chatId, senderId, message);
                break;
            case userMessage === '$surrender':
                // Handle surrender command for tictactoe game
                await handleTicTacToeMove(sock, chatId, senderId, 'surrender');
                break;
            case userMessage === '$cleartmp':
                await clearTmpCommand(sock, chatId, message);
                break;
            case userMessage === '$setpp':
                await setProfilePicture(sock, chatId, message);
                break;
            case userMessage.startsWith('$setgdesc'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupDescription(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('$setgname'):
                {
                    const text = rawText.slice(9).trim();
                    await setGroupName(sock, chatId, senderId, text, message);
                }
                break;
            case userMessage.startsWith('$setgpp'):
                await setGroupPhoto(sock, chatId, senderId, message);
                break;
            case userMessage.startsWith('$instagram') || (userMessage.startsWith('$insta') && !userMessage.startsWith('$instastalk')) || (userMessage === '$ig' || userMessage.startsWith('$ig ')) || userMessage.startsWith('$igdl') || (userMessage === '$lg' || userMessage.startsWith('$lg ')):
                await instagramCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$igsc'):
                await igsCommand(sock, chatId, message, true);
                break;
            case userMessage.startsWith('$igs') && !userMessage.startsWith('$igstalk') && !userMessage.startsWith('$igsc'):
                await igsCommand(sock, chatId, message, false);
                break;
            case userMessage.startsWith('$fb') || userMessage.startsWith('$facebook') || userMessage.startsWith('$fbdl'):
                await facebookCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$spotify'):
                await spotifyCommand(sock, chatId, message);
                break;
            case userMessage === '$ytaudio' || userMessage.startsWith('$ytaudio '):
                await ytaudioCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$ytaudiodoc' || userMessage.startsWith('$ytaudiodoc '):
                await ytaudioDocCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$ytvideo' || userMessage.startsWith('$ytvideo '):
                await ytvideoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage.startsWith('$tiktok') || userMessage.startsWith('$tt')) &&
                 !userMessage.startsWith('$tts') &&
                 !userMessage.startsWith('$ttstalk') &&
                 !userMessage.startsWith('$tiktokstalk'):
                await tiktokCommand(sock, chatId, message);
                break;
            // ── GiftedTech AI text commands ──────────────────────────────────
            case userMessage === '$letmegpt' || userMessage.startsWith('$letmegpt '):
                await letmegptCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$unlimitedai' || userMessage.startsWith('$unlimitedai '):
                await unlimitedAiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$claude' || userMessage.startsWith('$claude '):
                await claudeCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$deepseek' || userMessage.startsWith('$deepseek '):
                await deepseekCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$gpt4' || userMessage.startsWith('$gpt4 '):
                await gpt4Command(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$llama' || userMessage.startsWith('$llama '):
                await llamaCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$mistralai' || userMessage.startsWith('$mistralai '):
                await mistralAiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$geminioc' || userMessage.startsWith('$geminioc '):
                await geminiOcCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$grok' || userMessage.startsWith('$grok '):
                await grokCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$qwenai' || userMessage.startsWith('$qwenai '):
                await qwenAiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$o1' || userMessage.startsWith('$o1 '):
                await o1Command(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$gifgemini' || userMessage.startsWith('$gifgemini '):
                await gifGeminiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$gifvenice' || userMessage.startsWith('$gifvenice '):
                await gifVeniceCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$gifpoll' || userMessage.startsWith('$gifpoll '):
                await gifPollCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$muslimai' || userMessage.startsWith('$muslimai '):
                await muslimAiCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            // ── GiftedTech AI image generation ───────────────────────────────
            case userMessage === '$giftflux' || userMessage.startsWith('$giftflux '):
                await giftFluxCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$gifttxt2img' || userMessage.startsWith('$gifttxt2img '):
                await giftTxt2ImgCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage === '$magicstudio' || userMessage.startsWith('$magicstudio '):
                await magicStudioCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            // ── GiftedTech utility ────────────────────────────────────────────
            case userMessage === '$transcript' || userMessage.startsWith('$transcript '):
                await transcriptCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            // ── Pollinations AI (existing) ────────────────────────────────────
            case userMessage.startsWith('$ai ') || userMessage === '$ai' ||
                 userMessage.startsWith('$ask ') || userMessage === '$ask' ||
                 userMessage.startsWith('$gpt') || userMessage.startsWith('$gemini') ||
                 userMessage.startsWith('$venice') || userMessage.startsWith('$overchat') ||
                 userMessage.startsWith('$mistral') || userMessage.startsWith('$qwen') ||
                 userMessage.startsWith('$gptlarge') || userMessage.startsWith('$gptfast') ||
                 userMessage.startsWith('$txt2img') || userMessage.startsWith('$text2img') ||
                 userMessage.startsWith('$animegen') || userMessage.startsWith('$dalle'):
                await aiCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$translate') || userMessage.startsWith('$trt'):
                const commandLength = userMessage.startsWith('$translate') ? 10 : 4;
                await handleTranslateCommand(sock, chatId, message, userMessage.slice(commandLength));
                return;
            case userMessage.startsWith('$ssphone'):
                await ssphoneCommand(sock, chatId, message);
                break;

            case userMessage.startsWith('$sstab'):
                await sstabCommand(sock, chatId, message);
                break;

            case userMessage.startsWith('$sspc'):
                await sspcCommand(sock, chatId, message);
                break;

            case (userMessage.startsWith('$ss') && !userMessage.startsWith('$ssphone') && !userMessage.startsWith('$sstab') && !userMessage.startsWith('$sspc') && !userMessage.startsWith('$ssur')) || userMessage.startsWith('$ssweb') || userMessage.startsWith('$screenshot'):
                const ssCommandLength = userMessage.startsWith('$screenshot') ? 11 : (userMessage.startsWith('$ssweb') ? 6 : 3);
                await handleSsCommand(sock, chatId, message, userMessage.slice(ssCommandLength).trim());
                break;
            case userMessage.startsWith('$areact') || userMessage.startsWith('$autoreact') || userMessage.startsWith('$autoreaction'):
                await handleAreactCommand(sock, chatId, message, isOwnerOrSudoCheck);
                break;
            case userMessage.startsWith('$sudo'):
                await sudoCommand(sock, chatId, message);
                break;
            case userMessage === '$friendship' || userMessage === '$friendquote':
                await friendshipCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$lovetext' || userMessage === '$lovequote':
                await lovetextCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$heartbreak':
                await heartbreakCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$gratitude':
                await gratitudeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$thankyou' || userMessage === '$thanks':
                await thankyouCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$newyear':
                await newyearCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$christmas' || userMessage === '$xmas':
                await xmasCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$halloween':
                await halloweenCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$valentines' || userMessage === '$valentine':
                await valentinesCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$mothersday' || userMessage === '$mday':
                await mothersdayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$fathersday' || userMessage === '$fday':
                await fathersdayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$bfday' || userMessage === '$boyfriendsday':
                await bfdayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$gfday' || userMessage === '$girlfriendsday':
                await gfdayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$goodnight' || userMessage === '$lovenight' || userMessage === '$gn':
                await goodnightCommand(sock, chatId, message);
                break;
            case userMessage === '$shayari' || userMessage === '$shayri':
                await shayariCommand(sock, chatId, message);
                break;
            case userMessage === '$roseday':
                await rosedayCommand(sock, chatId, message);
                break;
            case userMessage === '$rizz' || userMessage === '$pickupline' || userMessage === '$pickup':
                await rizzCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$ttp ') || userMessage === '$ttp':
                await ttpCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$canvas ') || userMessage === '$canvas':
                await canvasCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$suno') || userMessage.startsWith('$songgen') || userMessage.startsWith('$aisong'):
                await sunoCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('$crypto-price') || userMessage.startsWith('$cryptoprice') || userMessage.startsWith('$cprice'):
                await cryptoPriceCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            case userMessage === '$top-crypto' || userMessage === '$topcrypto' || userMessage === '$topcoins':
                await topCryptoCommand(sock, chatId, message);
                break;
            case userMessage === '$trending-crypto' || userMessage === '$trendingcrypto':
                await trendingCryptoCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$crypto-convert') || userMessage.startsWith('$cryptoconv'):
                await cryptoConvertCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('$imagine') || userMessage.startsWith('$flux'): await imagineCommand(sock, chatId, message);
                break;
            case userMessage === '$jidp': await groupJidCommand(sock, chatId, message);
                break;
            case userMessage.startsWith('$autotyping'):
                await autotypingCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$autoread'):
                await autoreadCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$heart') && !userMessage.startsWith('$hearthis'):
                await handleHeart(sock, chatId, message);
                break;
            case userMessage.startsWith('$horny'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['horny', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$circle'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['circle', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$lgbt'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lgbt', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$lolice'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['lolice', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$simpcard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['simpcard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$tonikawa'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tonikawa', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$its-so-stupid'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['its-so-stupid', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$namecard'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['namecard', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;

            case userMessage.startsWith('$oogway2'):
            case userMessage.startsWith('$oogway'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.startsWith('$oogway2') ? 'oogway2' : 'oogway';
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$tweet'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['tweet', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$ytcomment'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = ['youtube-comment', ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$comrade'):
            case userMessage.startsWith('$gay'):
            case userMessage.startsWith('$glass'):
            case userMessage.startsWith('$prison'):
            case userMessage.startsWith('$passed'):
            case userMessage.startsWith('$triggered'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const sub = userMessage.slice(1).split(/\s+/)[0];
                    const args = [sub, ...parts.slice(1)];
                    await miscCommand(sock, chatId, message, args);
                }
                break;
            case userMessage.startsWith('$animu') && !userMessage.startsWith('$animuquote'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await animeCommand(sock, chatId, message, args);
                }
                break;
            // animu aliases
            case userMessage.startsWith('$nom'):
            case userMessage.startsWith('$poke'):
            case userMessage.startsWith('$cry'):
            case userMessage.startsWith('$kiss'):
            case userMessage.startsWith('$pat'):
            case userMessage.startsWith('$hug'):
            case userMessage.startsWith('$wink'):
            case userMessage.startsWith('$facepalm'):
            case userMessage.startsWith('$face-palm'):
            case userMessage.startsWith('$animuquote'):
            case userMessage.startsWith('$quote'):
            case userMessage.startsWith('$loli'):
                {
                    const parts = userMessage.trim().split(/\s+/);
                    let sub = parts[0].slice(1);
                    if (sub === 'facepalm') sub = 'face-palm';
                    if (sub === 'quote' || sub === 'animuquote') sub = 'quote';
                    await animeCommand(sock, chatId, message, [sub]);
                }
                break;
            case userMessage === '$crop':
                await stickercropCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$pies'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const args = parts.slice(1);
                    await piesCommand(sock, chatId, message, args);
                    commandExecuted = true;
                }
                break;
            case userMessage === '$china':
                await piesAlias(sock, chatId, message, 'china');
                commandExecuted = true;
                break;
            case userMessage === '$indonesia':
                await piesAlias(sock, chatId, message, 'indonesia');
                commandExecuted = true;
                break;
            case userMessage === '$japan':
                await piesAlias(sock, chatId, message, 'japan');
                commandExecuted = true;
                break;
            case userMessage === '$korea':
                await piesAlias(sock, chatId, message, 'korea');
                commandExecuted = true;
                break;
            case userMessage === '$hijab':
                await piesAlias(sock, chatId, message, 'hijab');
                commandExecuted = true;
                break;
            case userMessage.startsWith('$update'):
                {
                    const parts = rawText.trim().split(/\s+/);
                    const zipArg = parts[1] && parts[1].startsWith('http') ? parts[1] : '';
                    await updateCommand(sock, chatId, message, zipArg);
                }
                commandExecuted = true;
                break;
            case userMessage.startsWith('$rc ') || userMessage === '$rc':
                await rcCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$removebg') || userMessage.startsWith('$rmbg') || userMessage.startsWith('$nobg'):
                await removebgCommand.exec(sock, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('$remini') || userMessage.startsWith('$enhance') || userMessage.startsWith('$upscale'):
                await reminiCommand(sock, chatId, message, userMessage.split(' ').slice(1));
                break;
            case userMessage.startsWith('$sora') || userMessage.startsWith('$veo3'):
                await soraCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$movie') ||
                 userMessage.startsWith('$movietrailer') ||
                 userMessage.startsWith('$trailer') ||
                 (userMessage.startsWith('$trending') && !userMessage.startsWith('$trendinganime')) ||
                 userMessage.startsWith('$popular') ||
                 userMessage.startsWith('$upcoming') ||
                 userMessage === '$schedule' || userMessage.startsWith('$schedule') ||
                 userMessage === '$live' || (userMessage.startsWith('$live') && !userMessage.startsWith('$livescores')) ||
                 userMessage.startsWith('$livesearch') ||
                 userMessage.startsWith('$livestream') ||
                 userMessage === '$livecats' ||
                 (userMessage.startsWith('$anime') && !userMessage.startsWith('$animeinfo') && !userMessage.startsWith('$animeindo') && !userMessage.startsWith('$animeindos') && !userMessage.startsWith('$animequote')) ||
                 userMessage === '$moviehome': {
                // ─── Determine subcommand ───────────────────────────────────
                let mSub = 'search';
                const mUserMsg = userMessage;

                if (userMessage.startsWith('$movietrailer') ||
                    userMessage.startsWith('$trailer'))                                  mSub = 'trailer';
                else if (userMessage.startsWith('$movieinfo'))                           mSub = 'info';
                else if (userMessage.startsWith('$moviedl') ||
                         userMessage.startsWith('$moviedownload'))                       mSub = 'dl';
                else if (userMessage.startsWith('$moviefilter'))                         mSub = 'filter';
                else if (userMessage.startsWith('$movieanime'))                          mSub = 'anime';
                else if (userMessage.startsWith('$moviecaptions'))                       mSub = 'captions';
                else if (userMessage.startsWith('$moviehome') || userMessage === '$moviehome') mSub = 'homepage';
                else if (userMessage.startsWith('$trending'))                            mSub = 'trending';
                else if (userMessage.startsWith('$popular'))                             mSub = 'popular';
                else if (userMessage.startsWith('$upcoming'))                            mSub = 'upcoming';
                else if (userMessage.startsWith('$schedule'))                            mSub = 'schedule';
                else if (userMessage.startsWith('$livesearch'))                          mSub = 'livesearch';
                else if (userMessage.startsWith('$livestream'))                          mSub = 'livestream';
                else if (userMessage === '$livecats')                                    mSub = 'livecats';
                else if (userMessage.startsWith('$live'))                                mSub = 'live';
                else if (userMessage.startsWith('$anime'))                               mSub = 'anime';
                // $movie <title> / $movie details <id> / $movie dl <id> / $movie dl <id> <quality> handled inside movieCommand

                const cmdPrefixLen = mUserMsg.split(' ')[0].length;
                const mArgs = mUserMsg.slice(cmdPrefixLen).trim().split(' ').filter(Boolean);
                await movieCommand(sock, chatId, message, mArgs, mSub);
                commandExecuted = true;
                break;
            }
            // ─── MANGA ────────────────────────────────────────────────────────
            case userMessage.startsWith('$manga'):
                await mangaCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            // ─── NEW COMMANDS ─────────────────────────────────────────────────
            case userMessage.startsWith('$calc'):
                await calcCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$netinfo') || userMessage.startsWith('$ipinfo') || userMessage.startsWith('$myip'):
                await netinfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$cpuinfo') || userMessage === '$cpu':
                await cpuinfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$meminfo') || userMessage === '$ram' || userMessage === '$memory':
                await meminfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$diskinfo') || userMessage === '$disk' || userMessage === '$storage':
                await diskinfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$timezone') || userMessage === '$time':
                await timezoneCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$autoupdate'):
                await autoUpdateCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            // ── Group management commands ────────────────────────────────
            case userMessage === '$everyone' || userMessage.startsWith('$everyone '):
                await everyoneCommand(sock, chatId, senderId, userMessage, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$join ') || userMessage === '$join':
                await joinCommand(sock, chatId, senderId, userMessage, message);
                commandExecuted = true;
                break;

            case userMessage === '$invite' || userMessage.startsWith('$invite '):
                await inviteCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;

            case userMessage === '$getname':
                await getnameCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$getdeskgc':
                await getdeskgcCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$getppgc':
                await getppgcCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$setppgc':
                await setppgcCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;

            case userMessage === '$svcontact':
                await svcontactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$opengroup':
                await opengroupCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;

            case userMessage === '$closegroup':
                await closegroupCommand(sock, chatId, senderId, message);
                commandExecuted = true;
                break;

            case userMessage === '$linkgc':
                await linkgcCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$creategc'):
                await creategcCommand(sock, chatId, senderId, userMessage, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$remove') && !userMessage.startsWith('$removebg') && !userMessage.startsWith('$rmbg') && !userMessage.startsWith('$nobg'):
                await removeByCountryCommand(sock, chatId, senderId, userMessage, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$grouplink') || userMessage.startsWith('$invitelink') || userMessage.startsWith('$groupinvite'):
                await grouplinkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$listadmins' || userMessage.startsWith('$listadmin'):
                await listadminsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$listonline' || userMessage === '$members' || userMessage === '$memberlist':
                await listonlineCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$membercount' || userMessage === '$count' || userMessage === '$groupcount':
                await membercountCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$clearwarn'):
                await clearwarnCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$gif ') || userMessage === '$gif':
                {
                    const gifQuery = userMessage.split(' ').slice(1).join(' ').trim();
                    await gifCommand(sock, chatId, gifQuery);
                    commandExecuted = true;
                }
                break;

            case userMessage === '$react' || userMessage.startsWith('$react '):
                await reactCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            case userMessage === '$phone' || userMessage.startsWith('$phone '):
                await phoneCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            case userMessage === '$lid' || userMessage.startsWith('$lid '):
                await lidCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            case userMessage === '$jid' || userMessage.startsWith('$jid '):
                await jidCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            case userMessage === '$dir' || userMessage.startsWith('$dir '):
                if (!await getSenderIsOwnerOrSudo()) {
                    await sock.sendMessage(chatId, { text: '❌ Only the owner can use $dir.' }, { quoted: message });
                } else if (userMessage.startsWith('$dir search')) {
                    await searchDirCommand(sock, chatId, message, userMessage.slice(11).trim());
                } else {
                    await dirCommand(sock, chatId, message, userMessage);
                }
                commandExecuted = true;
                break;

            case userMessage.startsWith('$block'):
                await blockCommand(sock, chatId, message, senderId, userMessage);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$unblock'):
                await unblockCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Download commands (GiftedTech API) ─────────────────────────
            // ── Platform-specific downloaders ────────────────────────────────
            case (userMessage === '$twitter' || userMessage.startsWith('$twitter ') ||
                  userMessage === '$twdl'    || userMessage.startsWith('$twdl ')):
                await twitterDlCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$pinterestdl' || userMessage.startsWith('$pinterestdl ') ||
                  userMessage === '$pintdl'     || userMessage.startsWith('$pintdl ')     ||
                  userMessage === '$pdl'        || userMessage.startsWith('$pdl ')):
                await pinterestDlCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$douyin' || userMessage.startsWith('$douyin ')):
                await douyinCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$snackvideo' || userMessage.startsWith('$snackvideo ')):
                await snackVideoCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$soundcloud' || userMessage.startsWith('$soundcloud ')):
                await soundcloudCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$mediafire' || userMessage.startsWith('$mediafire ')):
                await mediafireCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$gdrive' || userMessage.startsWith('$gdrive ')):
                await gdriveCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$videy' || userMessage.startsWith('$videy ')):
                await videyCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$webdl' || userMessage.startsWith('$webdl ')):
                await webDlCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case (userMessage === '$aio' || userMessage.startsWith('$aio ')):
                await aioCommand(sock, chatId, message);
                commandExecuted = true;
                break;
            case userMessage.startsWith('$apk ') || userMessage === '$apk':
                await apkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$gitclone') || userMessage.startsWith('$gitdl'):
                await gitcloneCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Stalk commands ──────────────────────────────────────────────
            case userMessage.startsWith('$ttstalk') || userMessage.startsWith('$tiktokstalk'):
                await ttstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ghstalk') || userMessage.startsWith('$gitstalk') || userMessage.startsWith('$gitstlk'):
                await ghstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$igstalk') || userMessage.startsWith('$instastalk'):
                await igstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$twstalk') || userMessage.startsWith('$xstalk') || userMessage.startsWith('$twitterstalk'):
                await twstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$steamstalk') || userMessage.startsWith('$steamprofile'):
                await steamstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$wachannel'):
                await wachannelCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ipstalk') || userMessage.startsWith('$iplookup'):
                await ipstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$npmstalk') || userMessage.startsWith('$npmlookup'):
                await npmstalkCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$whois ') || userMessage === '$whois':
                await whoisCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$dns ') || userMessage === '$dns':
                await dnsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$headers ') || userMessage === '$headers':
                await headersCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$servercheck') || userMessage.startsWith('$pingserver') || userMessage.startsWith('$checkserver'):
                await servercheckCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Search commands ─────────────────────────────────────────────
            case userMessage.startsWith('$yts ') || userMessage === '$yts' ||
                 userMessage.startsWith('$ytsearch'):
                await ytsearchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$wallpaper') || userMessage.startsWith('$wall ') || userMessage === '$wall':
                await wallpaperCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Tools commands ──────────────────────────────────────────────
            case userMessage.startsWith('$carbon') || userMessage.startsWith('$codeshot') || userMessage.startsWith('$codeimage'):
                await carbonCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$createqr') || userMessage.startsWith('$genqr') || userMessage.startsWith('$makeqr'):
                await createqrCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$imgscan') || userMessage.startsWith('$identify') || userMessage.startsWith('$scanimg'):
                await imgscanCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Fun / Random ────────────────────────────────────────────────
            case userMessage === '$waifu' || userMessage.startsWith('$waifu '):
                await waifuCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$bored' || userMessage === '$activity' || userMessage === '$todo':
                await boredCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Sports ──────────────────────────────────────────────────────
            case userMessage === '$sports' || userMessage === '$scoreboard' || userMessage === '$livescores':
                await sportsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$sportsteam') || userMessage.startsWith('$teaminfo'):
                await sportsTeamCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$sportsplayer') || userMessage.startsWith('$playerinfo'):
                await sportsPlayerCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$nbastandings':
                await standingsCommand(sock, chatId, message, 'nba');
                commandExecuted = true;
                break;

            case userMessage === '$nflstandings':
                await standingsCommand(sock, chatId, message, 'nfl');
                commandExecuted = true;
                break;

            case userMessage === '$soccerstandings':
                await standingsCommand(sock, chatId, message, 'soccer');
                commandExecuted = true;
                break;

            // ── Gifted Football / Basketball ──────────────────────────────────
            case userMessage === '$flivescore' || userMessage === '$fls':
                await flivescoreCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$fnews' || userMessage === '$footballnews':
                await fnewsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$fleagues':
                await fleaguesCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$fstream' || userMessage === '$fstreaming':
                await fstreamCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fplayer'):
                await fplayerCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fteam'):
                await fteamCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fvenue'):
                await fvenueCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$blive' || userMessage === '$bball' || userMessage === '$blive':
                await bliveCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$eplstand' || userMessage === '$eplstandings':
                await eplStandCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$eplmatches':
                await eplMatchesCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$eplupcoming' || userMessage === '$eplfixtures':
                await eplUpcomingCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$laligastand' || userMessage === '$laligastandings':
                await laligaStandCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$laligamatches':
                await laligaMatchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$laligaupcoming' || userMessage === '$laligafixtures':
                await laligaUpCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$bundesstand' || userMessage === '$bundesliga':
                await bundesStandCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Anime Info (Jikan) ──────────────────────────────────────────
            case userMessage.startsWith('$animeinfo') || userMessage.startsWith('$animeinfos'):
                await animeinfoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$trendinganime' || userMessage === '$topanim' || userMessage === '$topanime':
                await trendingAnimeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$animeindo'):
                await animeIndoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Temp Mail ───────────────────────────────────────────────────
            case userMessage.startsWith('$tempmail') || userMessage === '$tempmail':
                await tempmailCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Movies (extra) ──────────────────────────────────────────────
            case userMessage.startsWith('$net9ja'):
                await net9jaCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Language & Define ─────────────────────────────────────────
            case userMessage.startsWith('$define'):
                await defineCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$synonym'):
                await synonymCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$antonym'):
                await antonymCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$wordofday':
                await wordofdayCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Wikipedia & Urban ─────────────────────────────────────────
            case userMessage.startsWith('$wiki') || userMessage.startsWith('$wikipedia'):
                await wikiCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$urban'):
                await urbanCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Country ───────────────────────────────────────────────────
            case userMessage.startsWith('$country') && !userMessage.startsWith('$countrytime'):
                await countryCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$capital'):
                await capitalCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$flag'):
                await flagCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$countrytime'):
                await timezoneCountryCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Animals ───────────────────────────────────────────────────
            case userMessage === '$catfact':
                await catfactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$catimage':
                await catimageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$dogfact':
                await dogfactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$dogimage':
                await dogimageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$foximage':
                await foxImageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$pandaimage':
                await pandaImageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$koalaimage':
                await koalaImageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$birb':
                await birbCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$raccoon':
                await raccoonCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Recipe & Cocktail ─────────────────────────────────────────
            case userMessage === '$randomrecipe':
                await randomRecipeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$recipe'):
                await searchRecipeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$cocktail') || userMessage === '$randomcocktail':
                await cocktailCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── NASA / Space ──────────────────────────────────────────────
            case userMessage === '$apod':
                await apodCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$isslocation' || userMessage === '$iss':
                await issLocationCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$spacefact':
                await spacefactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Text Tools ────────────────────────────────────────────────
            case userMessage.startsWith('$unmorse'):
                await unmorseCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$morse'):
                await morseCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$unbinary'):
                await unbinaryCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$binary'):
                await binaryCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$unbase64'):
                await unbase64Command(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$base64'):
                await base64Command(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$reverse'):
                await reverseCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$password') || userMessage === '$genpass':
                await passwordCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$uuid':
                await uuidCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$obfuscate2') || userMessage.startsWith('$jsobfus2') || userMessage.startsWith('$encryptv2'):
                await obfuscate2Command(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$obfuscate') || userMessage.startsWith('$jsobfus'):
                await obfuscateCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── URL Shorteners ─────────────────────────────────────────────
            case userMessage.startsWith('$tinyurl'):
                await tinyurlCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$cleanuri'):
                await cleanuriCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$vgd'):
                await vgdCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$rebrandly'):
                await rebrandlyCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$vurl'):
                await vurlCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$adfoc'):
                await adfocCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ssur'):
                await ssurCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$topdf'):
                await topdfCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$web2zip'):
                await web2zipCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$proxy' || userMessage.startsWith('$proxy '):
                await proxyCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Number Facts ──────────────────────────────────────────────
            case userMessage.startsWith('$numfact'):
                await numfactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$datefact'):
                await datefactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$yearfact'):
                await yearfactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$mathfact'):
                await mathfactCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Fun Jokes ─────────────────────────────────────────────────
            case userMessage === '$dadjoke':
                await dadjoke(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$chuck' || userMessage === '$chucknorris':
                await chuckCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$programmingjoke' || userMessage === '$devjoke':
                await programmingJokeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$yomama' || userMessage === '$yomamma':
                await yomammaCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$darkjoke':
                await darkJokeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Riddles ───────────────────────────────────────────────────
            case userMessage === '$riddle':
                await riddleCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$riddleanswer':
                await riddleAnswerCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Advice & WYR ──────────────────────────────────────────────
            case userMessage === '$advice':
                await adviceCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$wouldyou' || userMessage === '$wyr':
                await wouldyouCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$yesno':
                await yesnoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$neverhaveiever' || userMessage === '$nhie':
                await neverhaveieverCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Bible ─────────────────────────────────────────────────────
            case userMessage.startsWith('$bible'):
                await bibleCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$quran'):
                await quranCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$dailyayah':
                await dailyAyahCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$dailyverse':
                await dailyVerseCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Poetry & Quotes ───────────────────────────────────────────
            case userMessage === '$poem' || userMessage === '$poetry':
                await poemCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$animequote':
                await animequoteCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$konachan':
                await konachanCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$kusonime'):
                await kusonimeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$newanime':
                await animenewCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$charquote'):
                await charquoteCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$showquote'):
                await showquoteCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$kanye' || userMessage === '$kanyequote':
                await kanyeCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Gifted Search ─────────────────────────────────────────────
            case userMessage.startsWith('$gsearch'):
                await gsearchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$gimage'):
                await gimageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ttsearch'):
                await ttsearchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$chord'):
                await chordCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$hearthis'):
                await hearthisCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$npmpkg'):
                await npmpkgCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$slyrics'):
                await slyricsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$happymod'):
                await happymodCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$scsearch'):
                await scsearchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$wattpad'):
                await wattpadCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$stickersearch') || userMessage.startsWith('$sticksearch'):
                await stickersearchCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Gifted Textpro ────────────────────────────────────────────
            case userMessage.startsWith('$textpro'):
                await textproCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Gifted Ephoto ─────────────────────────────────────────────
            case userMessage === '$ephotolist':
                await ephotolistCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ephoto2'):
                await ephoto2Command(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$ephoto'):
                await ephotoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Gifted Tempgen (Phone) ────────────────────────────────────
            case userMessage === '$tempphone' || userMessage.startsWith('$tempphone '):
                await tempphoneCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$smsinbox'):
                await smsinboxCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Converters ────────────────────────────────────────────────
            case userMessage.startsWith('$bmi'):
                await bmiCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$age'):
                await ageCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$celsius'):
                await celsiusCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fahrenheit'):
                await fahrenheitCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$kmtomiles'):
                await kmtomilesCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$milestokm'):
                await milestokmCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$kgtolbs'):
                await kgtolbsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$lbstokg'):
                await lbstokg(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Font / Text Styles ────────────────────────────────────────
            case userMessage.startsWith('$bolditalic'):
                await bolditalicCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$boldtext'):
                await boldtextCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$italic'):
                await italicCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fantext2'):
                await fantext2Command(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fantext'):
                await fantextCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fancy'):
                await fancyCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$script'):
                await scriptCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$fraktur'):
                await frakturCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$double'):
                await doubleCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$sans'):
                await sansCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$mono'):
                await monoCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$wide'):
                await wideCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$smallcaps'):
                await smallcapsCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$bubble'):
                await bubbleCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$flip'):
                await flipCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$mirror'):
                await mirrorCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Generators ────────────────────────────────────────────────
            case userMessage.startsWith('$lorem'):
                await loremCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$fakename' || userMessage === '$randomperson':
                await fakenameCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$genemail'):
                await genemailCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$randomnum') || userMessage.startsWith('$randnum'):
                await randomnumCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage === '$coinflip' || userMessage === '$coin':
                await coinflipCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            case userMessage.startsWith('$diceroll') || userMessage === '$dice' || userMessage.startsWith('$roll'):
                await dicerollCommand(sock, chatId, message);
                commandExecuted = true;
                break;

            // ── Economy ───────────────────────────────────────────────────
            case userMessage.startsWith('$balance') || userMessage.startsWith('$bal') ||
                 userMessage === '$wallet' ||
                 (userMessage.startsWith('$daily') && !userMessage.startsWith('$dailyverse')) ||
                 userMessage.startsWith('$work') ||
                 userMessage.startsWith('$mine') ||
                 userMessage.startsWith('$fish') ||
                 userMessage.startsWith('$rob') ||
                 userMessage.startsWith('$pay') ||
                 userMessage.startsWith('$transfer') ||
                 userMessage.startsWith('$gift') ||
                 userMessage.startsWith('$deposit') || userMessage.startsWith('$dep') ||
                 userMessage.startsWith('$withdraw') || userMessage.startsWith('$with') ||
                 userMessage.startsWith('$gamble') || userMessage.startsWith('$bet') ||
                 userMessage.startsWith('$slots') || userMessage.startsWith('$slot') ||
                 (userMessage.startsWith('$coinflip') && userMessage !== '$coinflip') || userMessage.startsWith('$cf') ||
                 userMessage.startsWith('$store') || userMessage.startsWith('$shop') ||
                 userMessage.startsWith('$buy') ||
                 userMessage.startsWith('$sell') || userMessage.startsWith('$sellitem') ||
                 userMessage.startsWith('$inventory') || userMessage.startsWith('$inv') ||
                 userMessage === '$items' ||
                 userMessage.startsWith('$equip') ||
                 userMessage.startsWith('$upgrade') || userMessage.startsWith('$up ') || userMessage === '$up' ||
                 userMessage.startsWith('$use ') ||
                 userMessage.startsWith('$battle') || userMessage.startsWith('$fight') ||
                 userMessage.startsWith('$duel') ||
                 userMessage.startsWith('$profile') || userMessage.startsWith('$prof') ||
                 userMessage.startsWith('$estats') ||
                 userMessage.startsWith('$level') || userMessage.startsWith('$rank') ||
                 userMessage === '$xp' ||
                 userMessage.startsWith('$quest') ||
                 userMessage.startsWith('$addcoins') ||
                 userMessage.startsWith('$removecoins') || userMessage.startsWith('$deductcoins') ||
                 userMessage.startsWith('$resetuser') ||
                 userMessage.startsWith('$leaderboard') || userMessage.startsWith('$richlist') ||
                 userMessage.startsWith('$richest') || userMessage.startsWith('$lb') ||
                 userMessage.startsWith('$boostuser') || userMessage.startsWith('$boost') ||
                 userMessage.startsWith('$register') ||
                 userMessage.startsWith('$jail') || userMessage.startsWith('$unjail') || userMessage.startsWith('$freejail') ||
                 userMessage.startsWith('$jailstatus') || userMessage.startsWith('$jailcheck'):
                await economyCommand(sock, chatId, message, userMessage);
                commandExecuted = true;
                break;

            default:
                // Unknown dot-command — react ❌ so the user knows it's not valid
                if (userMessage.startsWith('$')) {
                    try {
                        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
                    } catch { /* ignore */ }
                    commandExecuted = false;
                    break;
                }
                if (isGroup) {
                    // Handle non-command group messages
                    if (userMessage) {  // Make sure there's a message
                        await handleChatbotResponse(sock, chatId, message, userMessage, senderId);
                    }
                    await handleTagDetection(sock, chatId, message, senderId);
                    await handleMentionDetection(sock, chatId, message);
                }
                commandExecuted = false;
                break;
        }

        // If a command was executed, show typing status after command execution
        if (commandExecuted !== false) {
            // Command was executed, now show typing status after command execution
            await showTypingAfterCommand(sock, chatId);
        }

        // Function to handle $groupjid command
        async function groupJidCommand(sock, chatId, message) {
            const groupJid = message.key.remoteJid;

            if (!groupJid.endsWith('@g.us')) {
                return await sock.sendMessage(chatId, {
                    text: "❌ This command can only be used in a group."
                });
            }

            await sock.sendMessage(chatId, {
                text: `✅ Group JID: ${groupJid}`
            }, {
                quoted: message
            });
        }

    } catch (error) {
        console.error('❌ Error in message handler:', error.message);
        // React with ❌ on the failing message — the command's own error text
        // (if any) already reached the user before the exception.
        try {
            if (message?.key?.id) {
                await sock.sendMessage(message.key.remoteJid, {
                    react: { text: '❌', key: message.key }
                });
            }
        } catch { /* ignore react failure */ }
    }
}

async function handleGroupParticipantUpdate(sock, update) {
    try {
        const { id, participants, action, author } = update;

        // Check if it's a group
        if (!id.endsWith('@g.us')) return;

        // Respect bot mode: only announce promote/demote in public mode
        let isPublic = true;
        try {
            const modeData = JSON.parse(fs.readFileSync('./data/messageCount.json'));
            if (typeof modeData.isPublic === 'boolean') isPublic = modeData.isPublic;
        } catch (e) {
            // If reading fails, default to public behavior
        }

        // Handle promotion events
        if (action === 'promote') {
            if (!isPublic) return;
            await handlePromotionEvent(sock, id, participants, author);
            return;
        }

        // Handle demotion events
        if (action === 'demote') {
            if (!isPublic) return;
            await handleDemotionEvent(sock, id, participants, author);
            return;
        }

        // Handle join events
        if (action === 'add') {
            await handleJoinEvent(sock, id, participants);
        }

        // Handle leave events
        if (action === 'remove') {
            await handleLeaveEvent(sock, id, participants);
            await handleAntiLeave(sock, id, participants);
        }

        // Anti-demote / Anti-promote
        await handleAntiPromoteDemote(sock, update);

    } catch (error) {
        console.error('Error in handleGroupParticipantUpdate:', error);
    }
}

// Instead, export the handlers along with handleMessages
module.exports = {
    handleMessages,
    handleGroupParticipantUpdate,
    handleStatus: async (sock, status) => {
        await handleStatusUpdate(sock, status);
        await handleAutoReactStatus(sock, status).catch(() => {});
    }
};    
