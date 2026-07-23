/**
 * DaratechMD- A WhatsApp Bot
 * Copyright (c) 2024 Daratech SHOP
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Developed by Daratech SHOP
 * - YouTube Channel: Daratech
 * - GitHub: daratech
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, await, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { PHONENUMBER_MCC } = require('@whiskeysockets/baileys/lib/Utils/generics')
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const store = require('./lib/lightweight_store')
const sessionRegistry = require('./lib/sessionRegistry')

// ── Self-restart duplicate guard ───────────────────────────────────────────────
// If the panel tries to restart after we self-spawned, this exits the duplicate.
const { writePid, isDuplicatePanelRestart } = require('./lib/selfRestart');
if (isDuplicatePanelRestart()) process.exit(0);
writePid(); // register our PID so future panel restarts can detect us

// Initialize store
store.readFromFile()
const settings = require('./settings')
setInterval(() => store.writeToFile(), settings.storeWriteInterval || 10000)

// Memory optimization - Force garbage collection if available
setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute

// Memory monitoring — only restart on a sustained heap spike, not a single RSS blip.
// RSS includes shared/cached pages that Node manages itself; heapUsed is the real
// application allocation. Two consecutive readings above the threshold are required
// to avoid restarting on a transient spike (e.g. during a large download).
let _highMemCount = 0;
setInterval(() => {
    const heapMB = process.memoryUsage().heapUsed / 1024 / 1024;
    if (heapMB > 380) {
        _highMemCount++;
        if (_highMemCount >= 2) {
            console.log(`⚠️ Heap sustained above 380 MB (${heapMB.toFixed(0)} MB) — restarting...`);
            process.exit(1);
        }
    } else {
        _highMemCount = 0; // reset on any normal reading
    }
}, 30_000);

let phoneNumber = (process.env.OWNER_NUMBER || '').replace(/\D/g, '')
let owner = JSON.parse(fs.readFileSync('./data/owner.json'))

global.botname = "Daratech"
global.themeemoji = "•"
const pairingCode = !!phoneNumber || process.argv.includes("--pairing-code")
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(settings.ownerNumber || phoneNumber)
    }
}

// Auto-join function - MODIFIED
async function autoJoinCommunity(sock) {
    try {
        const autojoinPath = './data/autojoin.json';

        // Create config if not exists
        if (!fs.existsSync(autojoinPath)) {
            const defaultConfig = {
                enabled: true,
                channel: "120363422591784062@newsletter",
                welcomeMessage: ""
            };
            fs.writeFileSync(autojoinPath, JSON.stringify(defaultConfig, null, 2));
        }

        const config = JSON.parse(fs.readFileSync(autojoinPath, 'utf8'));
        if (!config.enabled) return;

        console.log(chalk.cyan('🤖 Auto-join feature enabled...'));

    } catch (error) {
        console.error('Auto-join error:', error);
    }
}

// ── Session helpers ──────────────────────────────────────────────────────────

/**
 * Restore a session's creds.json from a base64 env var.
 * @param {string} sessionDir  - relative path to session folder (e.g. 'session' or 'session/kaevra')
 * @param {string} envVarName  - name of the env var holding the base64 creds (default 'SESSION_ID')
 */
function restoreSessionFromEnv(sessionDir = 'session', envVarName = 'SESSION_ID') {
    const encoded = process.env[envVarName];
    if (!encoded) return;
    const dir      = path.join(process.cwd(), sessionDir);
    const credsFile = path.join(dir, 'creds.json');
    if (fs.existsSync(credsFile)) return; // already have session — don't overwrite
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        JSON.parse(decoded); // validate JSON before writing
        fs.writeFileSync(credsFile, decoded);
        console.log(`[session:${sessionDir}] Restored creds.json from $${envVarName}`);
    } catch (e) {
        console.error(`[session:${sessionDir}] Failed to restore from $${envVarName}:`, e.message);
    }
}

/**
 * Persist a session's creds.json back into a base64 env var in .env.
 * @param {string} sessionDir  - relative path to session folder
 * @param {string} envVarName  - env var name to write (default 'SESSION_ID')
 */
function saveSessionToEnv(sessionDir = 'session', envVarName = 'SESSION_ID') {
    try {
        const credsFile = path.join(process.cwd(), sessionDir, 'creds.json');
        if (!fs.existsSync(credsFile)) return;
        const encoded = Buffer.from(fs.readFileSync(credsFile, 'utf8')).toString('base64');
        const envPath = path.join(process.cwd(), '.env');
        let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const regex = new RegExp(`^${envVarName}=.*`, 'm');
        if (regex.test(content)) {
            content = content.replace(regex, `${envVarName}=${encoded}`);
        } else {
            content = content.trimEnd() + `\n${envVarName}=${encoded}\n`;
        }
        fs.writeFileSync(envPath, content);
    } catch (e) {
        // non-fatal — session folder is still the live source of truth
    }
}

async function startSession(config = {}) {
    // ── Per-session identity ──────────────────────────────────────────────────
    const sessionId      = config.id        || 'default';
    const sessionName    = config.name      || settings.sessionName || global.botname || 'Daratech';
    const sessionDir     = config.sessionDir|| 'session';
    const sessionOwnerNum= (config.ownerNumber || '').replace(/\D/g, '') || phoneNumber;

    sessionRegistry.setConnecting(sessionId, sessionName);
    console.log(chalk.cyan(`[${sessionName}] Starting session (dir: ${sessionDir})…`));

    try {
        let { version, isLatest } = await fetchLatestBaileysVersion()
        // Ensure session dir exists (gitignored, so absent on fresh deploys)
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        // Restore creds from the configured env var (SESSION_ID for primary, BOT_N_SESSION for extras)
        const envSessionVar = config.envSessionVar || (sessionDir === 'session' ? 'SESSION_ID' : null);
        if (envSessionVar) restoreSessionFromEnv(sessionDir, envSessionVar);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

        // Only write SESSION_ID to $env after a real successful connection —
        // never during initial pairing (where creds are partial/empty)
        let sessionConnected = false;
        const msgRetryCounterCache = new NodeCache()

        const sessionPairingCode = !!sessionOwnerNum || process.argv.includes("--pairing-code");

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !sessionPairingCode,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            markOnlineOnConnect: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            getMessage: async (key) => {
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || ""
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
        })

        // Tag socket with session identity so main.js can read the name
        XeonBotInc._sessionId   = sessionId;
        XeonBotInc._sessionName = sessionName;

        // Save credentials when they update.
        // Only sync SESSION_ID to $env after a real successful connection —
        // never during initial pairing where creds are still empty/partial.
        XeonBotInc.ev.on('creds.update', async () => {
            await saveCreds();
            if (sessionConnected) {
                const envVar = config.envSessionVar || (sessionDir === 'session' ? 'SESSION_ID' : null);
                if (envVar) saveSessionToEnv(sessionDir, envVar);
            }
        })

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const mek = chatUpdate.messages[0]
            if (!mek.message) return


            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, chatUpdate);
                return;
            }
            // In private mode, only block non-group messages (allow groups for moderation)
            // Note: XeonBotInc.public is not synced, so we check mode in main.js instead
            // This check is kept for backward compatibility but mainly blocks DMs
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return // Block DMs in private mode, but allow group messages
            }
            if (mek.key.id.startsWith('BAE5') && mek.key.id.length === 16) return

            try {
                await handleMessages(XeonBotInc, chatUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                // Only try to send error message if we have a valid chatId
                if (mek.key && mek.key.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ An error occurred while processing your message.'
                    }).catch(console.error);
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Handle pairing code — uses per-session owner number
    if (sessionPairingCode && !XeonBotInc.authState.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let pairingPhone = sessionOwnerNum;
        // Per-session stored number (for reconnect retries)
        const pairingKey = `phoneNumber_${sessionId}`;
        if (!pairingPhone && global[pairingKey]) {
            pairingPhone = global[pairingKey];
        } else if (!pairingPhone) {
            pairingPhone = await question(chalk.bgBlack(chalk.greenBright(`[${sessionName}] Please type your WhatsApp number 😍\nFormat: 2347030626048 (without + or spaces) : `)))
            pairingPhone = pairingPhone.replace(/[^0-9]/g, '')

            // Validate the phone number using awesome-phonenumber
            const pn = require('awesome-phonenumber');
            if (!pn('+' + pairingPhone).isValid()) {
                console.log(chalk.red(`[${sessionName}] Invalid phone number. Please enter full international number without + or spaces.`));
                process.exit(1);
            }

            // Store so reconnect retries reuse it without prompting again
            global[pairingKey] = pairingPhone;
        }

        const requestNewPairingCode = async () => {
            try {
                let code = await XeonBotInc.requestPairingCode(pairingPhone)
                code = code?.match(/.{1,4}/g)?.join("-") || code
                console.log(chalk.black(chalk.bgGreen(`[${sessionName}] Pairing Code : `)), chalk.black(chalk.white(code)))
                console.log(chalk.yellow(`\nEnter this code in WhatsApp:\n1. Open WhatsApp → Settings → Linked Devices\n2. Tap "Link a Device"\n3. Choose "Link with phone number instead"\n4. Enter the code above\n\n⏱️  Code expires in ~60 seconds. A new one will be shown if needed.`))
            } catch (error) {
                console.error(`[${sessionName}] Error requesting pairing code:`, error)
                console.log(chalk.red(`[${sessionName}] Failed to get pairing code. Will retry on reconnect.`))
            }
        }

        setTimeout(requestNewPairingCode, 3000)
    }

    let _startupMsgSent = false; // guard: only send startup/update-done once per process
    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s

        if (qr) {
            console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }

        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }

        if (connection == "open") {
            // Mark session as truly connected — now safe to write SESSION_ID to $env
            sessionConnected = true;
            // Register in the shared session registry
            sessionRegistry.register(sessionId, { name: sessionName, sock: XeonBotInc, startTime: Date.now() });
            // Clear stored phone number so it doesn't interfere with future fresh starts
            global.phoneNumber = null;

            console.log(chalk.magenta(` `))
            console.log(chalk.yellow(`🌿Connected to => ` + JSON.stringify(XeonBotInc.user, null, 2)))

            // ECONOMY OWNER SEED — ensure connector has unlimited stats
            try {
                const { seedEconomyOwner } = require('./commands/economy');
                const ownerJid = XeonBotInc.user?.id
                    ? XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net'
                    : null;
                // Baileys exposes the LID (linked-device ID) via sock.user.lid
                // e.g. "12374589370511:0@lid" — normalise it the same way we do the regular JID
                const rawLid   = XeonBotInc.user?.lid || null;
                const ownerLid = rawLid ? rawLid.replace(/:\d+(?=@)/, '') : null;
                if (ownerJid) seedEconomyOwner(ownerJid, ownerLid);
            } catch (e) {
                console.log(chalk.yellow('⚠ Economy seed failed:', e.message));
            }

            // AUTO-UPDATE SCHEDULER — checks GitHub every N hours for updates
            try {
                const { start: startAutoUpdate } = require('./lib/autoUpdate');
                startAutoUpdate(XeonBotInc);
                console.log(chalk.cyan('🔄 Auto-update scheduler started'));
            } catch (e) {
                console.log(chalk.yellow('⚠ Auto-update scheduler failed to start:', e.message));
            }

            // AUTO-JOIN COMMUNITY FEATURE
            await autoJoinCommunity(XeonBotInc);

            // FOLLOW NEWSLETTER
            try {
                await delay(3000); // Wait 3 seconds before following
                await XeonBotInc.newsletterFollow('120363422591784062@newsletter');
                console.log(chalk.green('✅ Successfully followed newsletter'));
            } catch (error) {
                console.log(chalk.yellow('⚠ Could not follow newsletter:'), error.message);
            }

            if (!_startupMsgSent) {
                _startupMsgSent = true;
                try {
                    const botNumber = XeonBotInc.user.id.split(':')[0] + '@s.whatsapp.net';
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
                    const dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
                    const connSettings = require('./settings');

                    // ── Check if this restart was triggered by $update / autoupdate ──
                    const updateFlagPath = path.join(process.cwd(), 'data', 'update_done.json');
                    let updateFlag = null;
                    if (fs.existsSync(updateFlagPath)) {
                        try {
                            updateFlag = JSON.parse(fs.readFileSync(updateFlagPath, 'utf8'));
                            fs.unlinkSync(updateFlagPath); // consume the flag — never fires twice
                        } catch { /* ignore */ }
                    }

                    if (updateFlag) {
                        const updateMsg = [
                            `⚡ *UPDATE DONE* ✅`,
                            ``,
                            `╭── INFO`,
                            `│ 🤖 ${global.botname || 'Daratech'}`,
                            `│ 📱 +${botNumber.replace('@s.whatsapp.net', '')}`,
                            `│ 📅 ${dateStr} • ${timeStr}`,
                            `│ ⚡ v${connSettings.version}`,
                            `╰─────────────────────`,
                            ``,
                            `╭── CMDS`,
                            `│ $menu → all`,
                            `│ $help → list`,
                            `│ $update → check`,
                            `│ $owner → contact`,
                            `╰─────────────────────`,
                            ``,
                            `🤖 Online & Ready`,
                        ].join('\n');

                        // Send only to the chat that triggered the update
                        const target = updateFlag.chatId || botNumber;
                        try { await XeonBotInc.sendMessage(target, { text: updateMsg }); } catch { /* ignore */ }
                    } else {
                        // Normal startup message
                        const startupMsg = [
                            `╔════════════════════════════════════╗`,
                            `║  ⚡  *D A R A T E C H  B O T*  ⚡    ║`,
                            `║  🟢  *Connected Successfully!*      ║`,
                            `╚════════════════════════════════════╝`,
                            ``,
                            `╭──🌟 *BOT INFO*`,
                            `│ 🤖 Bot: *${global.botname || 'Daratech'}*`,
                            `│ 📱 Number: *+${botNumber.replace('@s.whatsapp.net', '')}*`,
                            `│ 📅 Date: *${dateStr}*`,
                            `│ 🕐 Time: *${timeStr}*`,
                            `│ ⚡ Version: *v${connSettings.version}*`,
                            `╰──────────────────────────────────`,
                            ``,
                            `╭──⚡ *QUICK START*`,
                            `│ *$menu* → see all 350+ commands`,
                            `│ *$help* → commands with descriptions`,
                            `│ *$update* → check for updates`,
                            `│ *$owner* → contact bot owner`,
                            `╰──────────────────────────────────`,
                            ``,
                            `> 🤖 *Daratech Bot* is now online and ready!`,
                        ].join('\n');
                        await XeonBotInc.sendMessage(botNumber, { text: startupMsg });
                    }
                } catch (error) {
                    console.error('Error sending connection message:', error.message)
                }
            }

            await delay(1999)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || 'Daratech'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL: Daratech`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: daratech`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CREDIT: Daratech`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} WA NUMBER: ${owner}`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            // Warn if the connected number doesn't match OWNER_NUMBER in $env
            const connectedNum = XeonBotInc.user?.id?.split(':')[0] || '';
            const ownerNum     = (process.env.OWNER_NUMBER || '').replace(/\D/g, '');
            if (ownerNum && connectedNum && connectedNum !== ownerNum) {
                console.log(chalk.yellow(
                    `⚠️  NOTE: Bot is connected as +${connectedNum} but OWNER_NUMBER in $env is set to ${ownerNum}.\n` +
                    `   OWNER_NUMBER only controls which number receives the pairing code on a fresh start.\n` +
                    `   The connected account is determined by SESSION_ID. To connect a different number:\n` +
                    `   1. Remove SESSION_ID from $env\n` +
                    `   2. Set OWNER_NUMBER to the desired number\n` +
                    `   3. Restart the bot`
                ));
            }
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
            console.log(chalk.cyan(`Auto-join: Enabled`))
            console.log(chalk.cyan(`Newsletter Follow: Enabled`))
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut
            const statusCode = lastDisconnect?.error?.output?.statusCode

            console.log(chalk.red(`[${sessionName}] Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
            sessionRegistry.setOffline(sessionId, sessionName);

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                try {
                    rmSync(sessionDir, { recursive: true, force: true })
                    console.log(chalk.yellow(`[${sessionName}] Session folder deleted. Please re-authenticate.`))
                } catch (error) {
                    console.error(`[${sessionName}] Error deleting session:`, error)
                }
                console.log(chalk.red(`[${sessionName}] Session logged out. Please re-authenticate.`))
            }

            if (shouldReconnect) {
                console.log(chalk.yellow(`[${sessionName}] Reconnecting...`))
                await delay(5000)
                startSession(config)
            }

            // If connection closed before we were ever registered (pairing expired/failed),
            // the SESSION_ID in $env was never written (sessionConnected stayed false), so
            // $env is clean — nothing to worry about. The reconnect above will request a
            // fresh pairing code automatically using global.phoneNumber.
        }
    })

    // SIMPLIFIED ANTICALL HANDLER - Only rejects calls, no messages, no blocking
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;

            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;

                try {
                    // Silently reject the call without sending any messages
                    if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                        await XeonBotInc.rejectCall(call.id, callerJid);
                    } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                        await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                    }
                } catch (error) {
                    // Silently ignore any errors
                }
            }
        } catch (error) {
            // Silently ignore any errors
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        console.error(`[${sessionName}] Error in startSession:`, error)
        sessionRegistry.setOffline(sessionId, sessionName);
        await delay(5000)
        startSession(config)
    }
}

// ── Multi-session launcher ─────────────────────────────────────────────────────
async function startAllSessions() {
    const sessionsPath = path.join(process.cwd(), 'data', 'sessions.json');
    let sessions = [];

    // 1. Load from sessions.json
    try {
        if (fs.existsSync(sessionsPath)) {
            const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
            sessions = (data.sessions || []).filter(s => s.enabled !== false);
        }
    } catch (e) {
        console.error('[sessions] Failed to load sessions.json:', e.message);
    }

    // 2. Scan environment for BOT_N_* vars (N = 1 … 20)
    //    BOT_1_NAME, BOT_1_SESSION, BOT_1_NUMBER  →  one bot config
    //    These OVERRIDE a sessions.json entry with the same N-based id,
    //    or ADD a new entry if no match exists.
    for (let n = 1; n <= 20; n++) {
        const envName    = process.env[`BOT_${n}_NAME`];
        const envSession = process.env[`BOT_${n}_SESSION`];
        const envNumber  = process.env[`BOT_${n}_NUMBER`];
        if (!envName && !envSession && !envNumber) break; // stop at first gap

        const envId     = `bot${n}`;
        const envDir    = n === 1 ? 'session' : `session/bot${n}`;
        const envVarKey = n === 1 ? 'SESSION_ID' : `BOT_${n}_SESSION`;

        const existing = sessions.findIndex(s => s.id === envId);
        const merged = {
            id:           envId,
            name:         envName  || (existing >= 0 ? sessions[existing].name : `Bot${n}`),
            sessionDir:   existing >= 0 ? sessions[existing].sessionDir : envDir,
            ownerNumber:  envNumber || (existing >= 0 ? sessions[existing].ownerNumber : ''),
            envSessionVar: envSession ? `BOT_${n}_SESSION` : (n === 1 ? 'SESSION_ID' : undefined),
            enabled:      true,
        };

        if (existing >= 0) sessions[existing] = merged;
        else sessions.push(merged);
    }

    // 3. Fallback: single default session when nothing is configured at all
    if (sessions.length === 0) {
        sessions = [{
            id:           'default',
            name:         settings.sessionName || global.botname || 'Daratech',
            sessionDir:   'session',
            envSessionVar:'SESSION_ID',
            enabled:      true,
            ownerNumber:  '',
        }];
    }

    const plural = sessions.length === 1 ? 'session' : 'sessions';
    console.log(chalk.cyan(`🤖 Launching ${sessions.length} ${plural}…`));
    if (sessions.length > 1) {
        sessions.forEach((s, i) =>
            console.log(chalk.cyan(`  ${i + 1}. ${s.name} (${s.sessionDir})`))
        );
    }

    for (const config of sessions) {
        // Start each session independently — they reconnect themselves
        startSession(config).catch(err => {
            console.error(`[session:${config.id}] Fatal:`, err.message);
        });
        // Small stagger to avoid simultaneous pairing prompts on a fresh pair
        if (sessions.length > 1) await delay(2000);
    }
}

// Start the bot with error handling
startAllSessions().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err)
})

// Hot-reload via fs.watchFile removed — it spawned duplicate bot instances on
// every file change (including auto-update), causing stream conflicts and QR loops.
// Auto-update handles restarts cleanly via process.exit(0).
