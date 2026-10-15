'use strict';
/**
 * gcstatus.js — Post text / image / video / sticker / audio as a WhatsApp Group Status
 *
 * $gcstatus -list — list all participating groups with numbers
 * $gcstatus <num(s)> <text> — post to group numbers e.g. 1, 1,3,5, 8-10, 1,3,5,8-10, all
 * $gcstatus <text> — post text status to current group
 * $gcstatus <groupJid> <text> — post to a specific group JID
 * $gcstatus <jid1,jid2> <text> — post to multiple group JIDs
 * $gcstatus <num(s)> (reply to media) — post media status to group numbers
 * $gcstatus -color <name|random|reset> [group|num] — set group background color
 * $gcstatus -audience <close|all|reset> [group|num] — set group audience
 *
 * Inline flags supported anywhere in the post:
 * -color <name> (or --color)
 * -audience <close|all> (or --audience)
 *
 * Delivery mechanism: posts through the normal sock.sendMessage() pipeline
 * with isGroupStatus/statusSourceType/statusAttributions merged into contextInfo.
 */

const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { PassThrough } = require('stream');
const { downloadContentFromMessage, generateMessageIDV2 } = require('@whiskeysockets/baileys');

let isOwnerOrSudo = null;
try {
    isOwnerOrSudo = require('../lib/isOwner');
} catch { }

// ── Config paths ───────────────────
const CONFIG_PATH = path.join(__dirname, '../data/gcstatus.json');
const GROUPS_CACHE_FILE = path.join(__dirname, '../data/gcstatus_list.json');

const MEMORY_GROUP_CACHE = new Map(); // senderKey -> { list, ts }
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function loadConfig() {
    try {
        if (!fs.existsSync(CONFIG_PATH)) return {};
        return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveConfig(cfg) {
    try {
        const dir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
    } catch { }
}

function getGroupSettings(groupId) {
    const raw = loadConfig()[groupId];
    if (raw === undefined || raw === null) return { color: null, audience: 'all' };
    if (typeof raw === 'string') return { color: raw, audience: 'all' };
    return { color: raw.color ?? null, audience: raw.audience ?? 'all' };
}

function setGroupColor(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = { ...getGroupSettings(groupId), color: value };
    saveConfig(cfg);
}

function resetGroupColor(groupId) {
    const cfg = loadConfig();
    cfg[groupId] = { ...getGroupSettings(groupId), color: null };
    saveConfig(cfg);
}

function setGroupAudience(groupId, value) {
    const cfg = loadConfig();
    cfg[groupId] = { ...getGroupSettings(groupId), audience: value };
    saveConfig(cfg);
}

// ── Groups list cache persistence ───────────────────
function loadGroupsDiskCache() {
    try {
        if (!fs.existsSync(GROUPS_CACHE_FILE)) return {};
        return JSON.parse(fs.readFileSync(GROUPS_CACHE_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveGroupsDiskCache(data) {
    try {
        const dir = path.dirname(GROUPS_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(GROUPS_CACHE_FILE, JSON.stringify(data, null, 2));
    } catch { }
}

// ── Color map ───────────────────
const COLOR_MAP = {
    purple: '#9C27B0', violet: '#7B1FA2', pink: '#E91E63', hotpink: '#FF4081',
    red: '#F44336', orange: '#FF5722', amber: '#FF8F00', yellow: '#FFC107',
    lime: '#8BC34A', green: '#4CAF50', teal: '#009688', cyan: '#00BCD4',
    blue: '#2196F3', navy: '#1565C0', indigo: '#3F51B5', black: '#212121',
    dark: '#263238', grey: '#607D8B', white: '#FAFAFA', brown: '#795548',
    gold: '#F9A825', maroon: '#880E4F',
};
const COLOR_NAMES = Object.keys(COLOR_MAP).join(', ');
const DEFAULT_COLOR = COLOR_MAP.purple;

function resolveColor(name) {
    const lower = (name || '').toLowerCase().trim();
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    const hex = lower.replace('#', '');
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    return null;
}

function pickColor(groupId, inlineColor) {
    if (inlineColor) return inlineColor;
    const saved = getGroupSettings(groupId).color;
    if (saved === 'random' || !saved) {
        const randomHex = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
        return `#${randomHex}`;
    }
    return resolveColor(saved) || DEFAULT_COLOR;
}

// ── Helper: Normalize JID ───────────────────
function normalizeJid(jid) {
    if (!jid) return '';
    return String(jid).trim().replace(/:[^@]*/, '');
}

function extractDigits(jid) {
    if (!jid) return '';
    const clean = normalizeJid(jid).split('@')[0];
    return clean.replace(/\D/g, '') || clean;
}

function normalizeGroupJid(raw) {
    if (!raw || typeof raw !== 'string') return null;
    let s = raw.trim();
    if (s.endsWith('@g.us')) return s;
    if (s.includes('@')) return null;
    if (/^\d+(?:-\d+)?$/.test(s) && s.length >= 10) {
        return `${s}@g.us`;
    }
    return null;
}

// ── Fetch user's participating groups with caching ───────────────────
async function fetchUserGroups(sock, senderId, forceRefresh = false) {
    const senderKey = extractDigits(senderId) || 'default';

    if (!forceRefresh) {
        const cached = MEMORY_GROUP_CACHE.get(senderKey);
        if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
            return cached.list;
        }
        const diskCache = loadGroupsDiskCache();
        if (diskCache[senderKey]?.length) {
            MEMORY_GROUP_CACHE.set(senderKey, { list: diskCache[senderKey], ts: Date.now() });
            return diskCache[senderKey];
        }
    }

    let rawMap = {};
    try {
        if (typeof sock.groupFetchAllParticipating === 'function') {
            rawMap = await sock.groupFetchAllParticipating();
        }
    } catch (err) {
        console.warn('[gcstatus] groupFetchAllParticipating error:', err.message);
    }

    if (!rawMap || !Object.keys(rawMap).length) {
        if (sock?.chats) {
            for (const [jid, chat] of Object.entries(sock.chats)) {
                if (jid.endsWith('@g.us')) {
                    rawMap[jid] = { id: jid, subject: chat.name || chat.subject || jid };
                }
            }
        }
    }

    let isOwner = false;
    try {
        if (typeof isOwnerOrSudo === 'function') {
            isOwner = await isOwnerOrSudo(senderId, sock);
        }
    } catch { }

    const botJid = sock.user?.id || sock.user?.jid || '';
    const isBotSender = botJid && (extractDigits(botJid) === extractDigits(senderId));

    const groupEntries = Object.values(rawMap || {});
    let userGroups = [];

    if (isOwner || isBotSender) {
        userGroups = groupEntries;
    } else {
        userGroups = groupEntries.filter(g => {
            if (!g.participants?.length) return true;
            return g.participants.some(p => {
                const pClean = extractDigits(p.id);
                const sClean = extractDigits(senderId);
                if (pClean && sClean && pClean === sClean) return true;
                if (p.lid && extractDigits(p.lid) === sClean) return true;
                return false;
            });
        });
    }

    if (!userGroups.length && groupEntries.length) {
        userGroups = groupEntries;
    }

    userGroups.sort((a, b) => {
        const nameA = (a.subject || a.id || '').toLowerCase();
        const nameB = (b.subject || b.id || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const list = userGroups.map((g, idx) => ({
        index: idx + 1,
        jid: g.id,
        name: g.subject || g.id.replace(/@g\.us$/, '')
    }));

    if (list.length) {
        MEMORY_GROUP_CACHE.set(senderKey, { list, ts: Date.now() });
        const disk = loadGroupsDiskCache();
        disk[senderKey] = list;
        saveGroupsDiskCache(disk);
    }

    return list;
}

// ── Target & Flag Extraction Helpers ───────────────────
function extractFlags(input) {
    let text = (input || '').trim();
    let color = null;
    let audience = null;

    // Check color flag: -color <val> or --color <val> or -color=<val>
    const colorMatch = text.match(/(?:^|\s)(?:--?color)(?:=|\s+)([^\s]+)/i);
    if (colorMatch) {
        const resolved = resolveColor(colorMatch[1]);
        if (resolved) {
            color = resolved;
            text = text.replace(colorMatch[0], ' ').trim();
        }
    }

    // Check audience flag: -audience <val> or --audience <val> or -audience=<val>
    const audienceMatch = text.match(/(?:^|\s)(?:--?audience)(?:=|\s+)([^\s]+)/i);
    if (audienceMatch) {
        const aVal = audienceMatch[1].toLowerCase();
        if (['close', 'closefriends', 'cf'].includes(aVal)) {
            audience = 'close';
            text = text.replace(audienceMatch[0], ' ').trim();
        } else if (['all', 'everyone', 'reset'].includes(aVal)) {
            audience = 'all';
            text = text.replace(audienceMatch[0], ' ').trim();
        }
    }

    return { cleanText: text.trim(), color, audience };
}

function parseTargetItem(item) {
    item = (item || '').trim().replace(/^#/, '');
    if (!item) return null;

    // Number range e.g. 8-10 or 1 - 5
    if (/^(\d+)\s*-\s*(\d+)$/.test(item)) {
        const [, s1, s2] = item.match(/^(\d+)\s*-\s*(\d+)$/);
        const start = parseInt(s1, 10);
        const end = parseInt(s2, 10);
        if (start > 0 && end > 0 && start < 10000 && end < 10000) {
            const [min, max] = start <= end ? [start, end] : [end, start];
            const list = [];
            for (let i = min; i <= max && (i - min) <= 100; i++) {
                list.push({ type: 'index', value: i });
            }
            return list;
        }
    }

    // Single number (index or raw JID)
    if (/^\d+$/.test(item)) {
        const num = parseInt(item, 10);
        if (num > 0 && num < 10000) return [{ type: 'index', value: num }];
        if (item.length >= 10) return [{ type: 'jid', value: `${item}@g.us` }];
    }

    // Explicit group JID
    if (item.endsWith('@g.us')) return [{ type: 'jid', value: item }];

    return null;
}

function parseTargetsToken(token) {
    if (!token || typeof token !== 'string') return null;
    const lower = token.trim().toLowerCase();
    if (lower === 'all' || lower === '*') return [{ type: 'all' }];

    const parts = token.split(',').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return null;

    const items = [];
    for (const part of parts) {
        const res = parseTargetItem(part);
        if (!res) return null;
        items.push(...res);
    }
    return items.length ? items : null;
}

function extractTargets(rawText, defaultChatId) {
    let text = (rawText || '').trim();

    // Check for explicit --jid flag
    if (text.toLowerCase().startsWith('--jid=') || text.toLowerCase().startsWith('jid=')) {
        const eqIdx = text.indexOf('=');
        const token = text.slice(eqIdx + 1).split(/\s+/)[0];
        const parsed = parseTargetsToken(token);
        if (parsed) {
            return {
                targetSpecs: parsed,
                remainingContent: text.slice(eqIdx + 1 + token.length).trim()
            };
        }
    }

    // Pattern matching leading targets: "1,3,5,8-10 Hello" or "1 Hello" or "all Hello" or "120363024849204820@g.us Hello"
    const match = text.match(/^((?:(?:[\w@#.-]+|\d+\s*-\s*\d+)\s*,\s*)*(?:[\w@#.-]+|\d+\s*-\s*\d+))(?:\s+([\s\S]*))?$/);
    if (match) {
        const candidate = match[1];
        const parsed = parseTargetsToken(candidate);
        if (parsed) {
            return {
                targetSpecs: parsed,
                remainingContent: (match[2] || '').trim()
            };
        }
    }

    return {
        targetSpecs: defaultChatId.endsWith('@g.us') ? [{ type: 'jid', value: defaultChatId }] : [],
        remainingContent: text
    };
}

async function resolveTargetJids(sock, senderId, targetSpecs) {
    if (!targetSpecs || !targetSpecs.length) return { jids: [], missingIndices: [], totalGroups: 0 };

    const needsUserGroups = targetSpecs.some(s => s.type === 'index' || s.type === 'all');
    let userGroups = null;
    if (needsUserGroups) {
        userGroups = await fetchUserGroups(sock, senderId);
    }

    const resolvedJids = [];
    const missingIndices = [];

    for (const spec of targetSpecs) {
        if (spec.type === 'jid') {
            if (!resolvedJids.includes(spec.value)) resolvedJids.push(spec.value);
        } else if (spec.type === 'all') {
            if (userGroups && userGroups.length) {
                for (const g of userGroups) {
                    if (!resolvedJids.includes(g.jid)) resolvedJids.push(g.jid);
                }
            }
        } else if (spec.type === 'index') {
            const found = userGroups ? userGroups.find(g => g.index === spec.value) : null;
            if (found) {
                if (!resolvedJids.includes(found.jid)) resolvedJids.push(found.jid);
            } else {
                missingIndices.push(spec.value);
            }
        }
    }

    return {
        jids: resolvedJids,
        missingIndices,
        totalGroups: userGroups?.length || 0
    };
}

// ── Show Groups List UI ($gcstatus -list) ───────────────────
async function showGroupsList(sock, chatId, senderId, message) {
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });
    try {
        const list = await fetchUserGroups(sock, senderId, true);
        if (!list.length) {
            await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
            return sock.sendMessage(chatId, {
                text: '❌ No participating groups found for your account.\n\nMake sure the bot has joined the groups!\n\n> *POWERED BY DARATECH V2*'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '📋', key: message.key } });

        const formattedGroups = list.map(g => `*${g.index}.* ${g.name}`).join('\n');

        const text = [
            `📋 *GROUPS LIST*`,
            `Total: *${list.length}*`,
            ``,
            formattedGroups,
            ``,
            `💡 *Usage:*`,
            `▸ \`$gcstatus 1 <text>\``,
            `▸ \`$gcstatus 1,3,5 <text>\``,
            `▸ \`$gcstatus 1-4 <text>\``,
            `▸ \`$gcstatus all <text>\``,
            `▸ Reply to media: \`$gcstatus 1,2\``,
            `▸ Reply with caption: \`$gcstatus 1,2 New caption\``,
            `▸ Raw JID media: reply + \`$gcstatus <groupJid>\``,
            `▸ Raw JID media + override: \`$gcstatus <groupJid> New caption\``,
            `▸ Original media captions are kept unless overridden`,
            `▸ Add \`-color\` or \`-audience\` to any post`,
            ``,
            `> *POWERED BY DARATECH V2*`
        ].join('\n');

        return sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (err) {
        console.error('[gcstatus/-list]', err);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `❌ Failed to fetch groups list: ${err.message}\n\n> *POWERED BY DARATECH V2*`
        }, { quoted: message });
    }
}

// ── Channel Post Reshare Detector ───────────────────
function extractChannelReshare(quotedMsg, mediaPayload, message) {
    // Pairs of [contextInfo, rawMsgPayload] — we need both together
    const candidates = [
        [mediaPayload?.imageMessage?.contextInfo, mediaPayload],
        [mediaPayload?.videoMessage?.contextInfo, mediaPayload],
        [mediaPayload?.extendedTextMessage?.contextInfo, mediaPayload],
        [mediaPayload?.audioMessage?.contextInfo, mediaPayload],
        [mediaPayload?.contextInfo, mediaPayload],
        [quotedMsg?.imageMessage?.contextInfo, quotedMsg],
        [quotedMsg?.videoMessage?.contextInfo, quotedMsg],
        [quotedMsg?.extendedTextMessage?.contextInfo, quotedMsg],
        [quotedMsg?.audioMessage?.contextInfo, quotedMsg],
        [quotedMsg?.contextInfo, quotedMsg],
        [message?.message?.extendedTextMessage?.contextInfo, message?.message],
    ].filter(([ctx]) => !!ctx);

    for (const [ctx, rawPayload] of candidates) {
        // 1. Check statusAttributions (Channel reshare in status)
        if (Array.isArray(ctx.statusAttributions)) {
            for (const attr of ctx.statusAttributions) {
                const isReshare = attr.type === 'RESHARE' || attr.type === 2;
                const source = attr.statusReshare?.source;
                const meta = attr.statusReshare?.metadata;
                if (source === 'CHANNEL_RESHARE' || meta?.channelJid || (isReshare && meta)) {
                    return {
                        isChannelPost: true,
                        rawQuotedPayload: rawPayload,  // original proto for relay
                        statusAttributions: ctx.statusAttributions,
                        statusSourceType: ctx.statusSourceType || 'TEXT',
                        pairedMediaType: ctx.pairedMediaType || 'NOT_PAIRED_MEDIA',
                        featureEligibilities: ctx.featureEligibilities || { canReceiveMultiReact: true },
                        channelJid: meta?.channelJid || null,
                        channelMessageId: meta?.channelMessageId || null,
                    };
                }
            }
        }

        // 2. Check forwardedNewsletterMessageInfo (forwarded from a channel)
        if (ctx.forwardedNewsletterMessageInfo) {
            const fwd = ctx.forwardedNewsletterMessageInfo;
            const channelJid = fwd.newsletterJid;
            const channelMessageId = fwd.serverMessageId;
            return {
                isChannelPost: true,
                rawQuotedPayload: rawPayload,
                statusAttributions: [
                    {
                        type: 'RESHARE',
                        statusReshare: {
                            source: 'CHANNEL_RESHARE',
                            metadata: {
                                duration: 0,
                                channelJid: channelJid || '',
                                channelMessageId: channelMessageId || 0,
                                hasMultipleReshares: false,
                            }
                        }
                    }
                ],
                statusSourceType: ctx.statusSourceType || 'TEXT',
                pairedMediaType: ctx.pairedMediaType || 'NOT_PAIRED_MEDIA',
                featureEligibilities: ctx.featureEligibilities || { canReceiveMultiReact: true },
                channelJid,
                channelMessageId,
                channelName: fwd.newsletterName || null,
            };
        }
    }

    return null;
}

// ── Core post ───────────────────
async function postGroupStatus(sock, jid, content, audience) {
    const channelReshare = content.channelReshareInfo;
    const isChannelPost = !!channelReshare?.isChannelPost;

    // ── Channel Post: relay original proto message with group-status contextInfo ──
    if (isChannelPost && channelReshare.rawQuotedPayload) {
        const raw = channelReshare.rawQuotedPayload;

        // Determine which message type holds the payload
        const msgTypeKey = [
            'imageMessage', 'videoMessage', 'audioMessage',
            'extendedTextMessage', 'conversation'
        ].find(k => raw[k]);

        if (msgTypeKey) {
            // Clone the inner message and inject the group-status contextInfo
            const innerMsg = JSON.parse(JSON.stringify(raw[msgTypeKey]));

            // Build the contextInfo that marks this as a group status with channel attribution
            const channelCtx = {
                ...(innerMsg.contextInfo || {}),
                isGroupStatus: true,
                statusSourceType: channelReshare.statusSourceType || 'TEXT',
                statusAttributions: channelReshare.statusAttributions,
            };
            if (channelReshare.pairedMediaType) {
                channelCtx.pairedMediaType = channelReshare.pairedMediaType;
            }
            if (channelReshare.featureEligibilities) {
                channelCtx.featureEligibilities = channelReshare.featureEligibilities;
            }
            if (audience === 'close') {
                channelCtx.statusAudienceMetadata = { audienceType: 'CLOSE_FRIENDS' };
            }

            innerMsg.contextInfo = channelCtx;

            // Relay the original message structure directly
            // This preserves media keys/URLs so WA renders it as a channel post
            const messageProto = { [msgTypeKey]: innerMsg };
            const msgId = generateMessageIDV2();

            // Build a minimal WebMessageInfo so relayMessage can parse it
            const meJid = sock.user?.id || sock.user?.jid || jid;
            const fullMsg = {
                key: { remoteJid: jid, fromMe: true, id: msgId },
                message: messageProto,
                messageTimestamp: Math.floor(Date.now() / 1000),
                participant: meJid,
                status: 0,
            };

            try {
                return await sock.relayMessage(jid, messageProto, {
                    messageId: msgId,
                    statusJidList: [],
                });
            } catch (relayErr) {
                console.warn('[gcstatus] relayMessage failed, falling back to sendMessage:', relayErr.message);
                // Fall through to normal sendMessage below
            }
        }
    }

    // ── Normal (non-channel) post ───────────────────
    let statusSourceType = content.text
        ? 'TEXT'
        : content.image
            ? 'IMAGE'
            : content.video
                ? 'VIDEO'
                : content.audio
                    ? 'AUDIO'
                    : content.sticker
                        ? 'IMAGE'
                        : 'TEXT';

    const contextInfo = {
        ...(content.contextInfo || {}),
        isGroupStatus: true,
        statusSourceType,
        statusAttributions: [{ type: 10 }],
    };

    if (audience === 'close') {
        contextInfo.statusAudienceMetadata = { audienceType: 'CLOSE_FRIENDS' };
    }

    const { backgroundColor, font, channelReshareInfo, ...restContent } = content;
    const options = {};
    if (backgroundColor) options.backgroundColor = backgroundColor;
    if (font) options.font = font;

    return sock.sendMessage(jid, { ...restContent, contextInfo }, options);
}

// ── Media helpers ───────────────────
function detectMediaType(msg) {
    if (!msg || typeof msg !== 'object') return null;
    if (msg.imageMessage) return 'image';
    if (msg.videoMessage) return 'video';
    if (msg.audioMessage) return 'audio';
    if (msg.stickerMessage) return 'sticker';
    return null;
}

function getMediaCaption(msg, type) {
    const caption = msg?.[`${type}Message`]?.caption;
    return caption && caption.trim() ? caption.trim() : null;
}

function extractQuotedText(msg) {
    if (!msg || typeof msg !== 'object') return null;
    const t = msg.conversation || msg.extendedTextMessage?.text || null;
    return t && t.trim() ? t.trim() : null;
}

function unwrapQuotedMessage(msg) {
    let current = msg;
    for (let i = 0; i < 4; i++) {
        const wrapper = current?.viewOnceMessageV2
            || current?.viewOnceMessage
            || current?.viewOnceMessageV2Extension
            || current?.documentWithCaptionMessage;
        if (!wrapper?.message) break;
        current = wrapper.message;
    }
    return current;
}

async function downloadMedia(msg, type) {
    const mediaMessage = msg[`${type}Message`];
    if (!mediaMessage) throw new Error(`Missing ${type} message payload.`);
    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks);
}

async function convertToVoiceNote(buffer) {
    return new Promise((resolve, reject) => {
        const input = new PassThrough();
        input.end(buffer);
        const output = new PassThrough();
        const chunks = [];

        output.on('data', chunk => chunks.push(chunk));
        output.on('end', () => resolve(Buffer.concat(chunks)));
        output.on('error', reject);

        ffmpeg(input)
            .audioCodec('libopus')
            .audioChannels(1)
            .audioFrequency(48000)
            .format('ogg')
            .addOutputOptions(['-avoid_negative_ts make_zero'])
            .on('error', reject)
            .pipe(output);
    });
}

async function generateWaveform(buffer, bars = 64) {
    return new Promise((resolve) => {
        const input = new PassThrough();
        input.end(buffer);
        const output = new PassThrough();
        const rawPcmChunks = [];

        output.on('data', chunk => rawPcmChunks.push(chunk));
        output.on('end', () => {
            try {
                const pcm = Buffer.concat(rawPcmChunks);
                const sampleCount = Math.floor(pcm.length / 2);
                if (!sampleCount) return resolve(undefined);

                const amplitudes = [];
                for (let i = 0; i < sampleCount; i++) {
                    amplitudes.push(Math.abs(pcm.readInt16LE(i * 2)));
                }

                const size = Math.floor(amplitudes.length / bars);
                if (!size) return resolve(undefined);
                const averages = Array.from({ length: bars }, (_, index) => {
                    const slice = amplitudes.slice(index * size, (index + 1) * size);
                    return slice.reduce((sum, value) => sum + value, 0) / slice.length;
                });
                const max = Math.max(...averages);
                if (!max) return resolve(undefined);

                resolve(Buffer.from(averages.map((value) => Math.floor((value / max) * 100))).toString('base64'));
            } catch {
                resolve(undefined);
            }
        });

        ffmpeg(input)
            .audioChannels(1)
            .audioFrequency(16000)
            .format('s16le')
            .on('error', () => resolve(undefined))
            .pipe(output);
    });
}

// ── Group Name Resolution Helper ───────────────────
let getGroupMetadataCached = null;
try {
    ({ getGroupMetadataCached } = require('../lib/isAdmin'));
} catch { }

async function getGroupName(sock, jid) {
    if (!jid || !jid.endsWith('@g.us')) return jid || 'Unknown Group';

    try {
        if (sock?.chats?.[jid]?.subject) return sock.chats[jid].subject;
        if (sock?.chats?.[jid]?.name) return sock.chats[jid].name;
    } catch { }

    try {
        if (typeof getGroupMetadataCached === 'function') {
            const meta = await getGroupMetadataCached(sock, jid);
            if (meta?.subject) return meta.subject;
        }
    } catch { }

    try {
        if (typeof sock?.groupMetadata === 'function') {
            const meta = await sock.groupMetadata(jid);
            if (meta?.subject) return meta.subject;
        }
    } catch { }

    return jid.replace(/@g\.us$/, '');
}

// ── Broadcast helper ───────────────────
async function broadcastStatus(sock, chatId, message, targetJids, getPayload, label, audienceOverride) {
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

    const results = [];
    for (const jid of targetJids) {
        const audience = audienceOverride || getGroupSettings(jid).audience;
        let groupName = jid.replace(/@g\.us$/, '');
        try {
            groupName = await getGroupName(sock, jid);
        } catch { }

        try {
            const payload = typeof getPayload === 'function' ? await getPayload(jid, audience) : getPayload;
            await postGroupStatus(sock, jid, payload, audience);
            results.push({ jid, groupName, success: true });
        } catch (err) {
            results.push({ jid, groupName, success: false, error: err.message });
        }
    }

    const successCount = results.filter(r => r.success).length;
    await sock.sendMessage(chatId, { react: { text: successCount > 0 ? '✅' : '❌', key: message.key } });

    if (targetJids.length === 1) {
        const r = results[0];
        if (r.success) {
            return sock.sendMessage(chatId, {
                text: `✅ *${label} group status posted to ${r.groupName}!*\n\n> *POWERED BY DARATECH V2*`
            }, { quoted: message });
        }
        return sock.sendMessage(chatId, {
            text: `❌ *Failed to post ${label.toLowerCase()} status to ${r.groupName}.*\n\n_${r.error || 'Unknown error'}_\n\n> *POWERED BY DARATECH V2*`
        }, { quoted: message });
    }

    const summaryLines = results.map(r => {
        return r.success ? `✅ *${r.groupName}* — Posted` : `❌ *${r.groupName}* — ${r.error || 'Failed'}`;
    }).join('\n');

    return sock.sendMessage(chatId, {
        text: [
            `📢 *GROUP STATUS RESULTS*`,
            `⚡ *${label} Status Broadcast*`,
            `📊 Sent to *${successCount}/${targetJids.length}* groups:`,
            ``,
            summaryLines,
            ``,
            `> *POWERED BY DARATECH V2*`,
        ].join('\n')
    }, { quoted: message });
}

// ── Main command handler ───────────────────
async function gcstatusCommand(sock, chatId, senderId, message) {
    const raw = (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        ''
    ).trim();

    const body = raw.replace(/^[^\s]+\s*/i, '').trim();
    const args = body.split(/\s+/).filter(Boolean);
    const firstLower = (args[0] || '').toLowerCase();

    // Detect quoted message
    const ctxInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctxInfo?.quotedMessage || null;

    // ── 1. Subcommand: $gcstatus -list ───────────────────
    if (firstLower === '-list' || firstLower === '--list' || (firstLower === 'list' && args.length === 1 && !quotedMsg)) {
        return showGroupsList(sock, chatId, senderId, message);
    }

    // ── 2. Subcommand: $gcstatus -color <name|random|reset> [jid|num] ───────────
    if (firstLower === '-color' || firstLower === '--color') {
        const val = args[1]?.toLowerCase();
        const isConfigAction = !val || val === 'reset' || val === 'random' || (resolveColor(val) && (args.length <= 3));

        if (isConfigAction && !quotedMsg) {
            let targetGroup = null;
            if (args[2]) {
                targetGroup = normalizeGroupJid(args[2]);
                if (!targetGroup && /^\d+$/.test(args[2])) {
                    const list = await fetchUserGroups(sock, senderId);
                    const found = list.find(g => g.index === parseInt(args[2], 10));
                    if (found) targetGroup = found.jid;
                }
            } else if (chatId.endsWith('@g.us')) {
                targetGroup = chatId;
            }

            if (!targetGroup && val) {
                return sock.sendMessage(chatId, {
                    text: `❌ Please specify a group number or JID when configuring from DM:\n\n*Usage:* \`$gcstatus -color ${val} <groupNumber|jid>\``
                }, { quoted: message });
            }

            const groupName = targetGroup ? await getGroupName(sock, targetGroup) : 'Current Group';

            if (!val) {
                const saved = targetGroup ? getGroupSettings(targetGroup).color : null;
                const displayName = saved === 'random' ? 'random 🎲' : (saved || 'purple (default)');
                return sock.sendMessage(chatId, {
                    text: [
                        '🎨 *GC STATUS COLOR*',
                        `Group: *${groupName}*`,
                        `Current: *${displayName}*`,
                        '',
                        '*In this group:*',
                        '*$gcstatus -color <name>*',
                        '*$gcstatus -color random*',
                        '*$gcstatus -color reset*',
                        '',
                        '*By group number:*',
                        '*$gcstatus -color <name> 1*',
                        '*$gcstatus -color reset 1*',
                        '',
                        '*From DM:*',
                        '*$gcstatus -color <name|random|reset> <groupNumber|groupJid>*',
                        '',
                        `*Colors:* ${COLOR_NAMES}`,
                        '',
                        '> *POWERED BY DARATECH V2*',
                    ].join('\n')
                }, { quoted: message });
            }
            if (val === 'reset') {
                resetGroupColor(targetGroup);
                return sock.sendMessage(chatId, { text: `🎨 *GC Status color reset* to default *purple* for *${groupName}*.\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
            }
            if (val === 'random') {
                setGroupColor(targetGroup, 'random');
                return sock.sendMessage(chatId, { text: `🎲 *GC Status color set to random* for *${groupName}*!\n\nA new color will be picked each time.\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
            }
            if (!resolveColor(val)) {
                return sock.sendMessage(chatId, { text: `❌ Unknown color *"${val}"*.\n\nAvailable:\n${COLOR_NAMES}\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
            }
            setGroupColor(targetGroup, val);
            return sock.sendMessage(chatId, { text: `✅ *GC Status color set to ${val}* for *${groupName}*!\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
        }
    }

    // ── 3. Subcommand: $gcstatus -audience <close|all|reset> [jid|num] ─────────
    if (firstLower === '-audience' || firstLower === '--audience') {
        const val = args[1]?.toLowerCase();
        const isAudienceAction = !val || ['close', 'closefriends', 'all', 'everyone', 'reset'].includes(val);

        if (isAudienceAction && args.length <= 3 && !quotedMsg) {
            let targetGroup = null;
            if (args[2]) {
                targetGroup = normalizeGroupJid(args[2]);
                if (!targetGroup && /^\d+$/.test(args[2])) {
                    const list = await fetchUserGroups(sock, senderId);
                    const found = list.find(g => g.index === parseInt(args[2], 10));
                    if (found) targetGroup = found.jid;
                }
            } else if (chatId.endsWith('@g.us')) {
                targetGroup = chatId;
            }

            if (!targetGroup && val) {
                return sock.sendMessage(chatId, {
                    text: `❌ Please specify a group number or JID when configuring from DM:\n\n*Usage:* \`$gcstatus -audience ${val} <groupNumber|jid>\``
                }, { quoted: message });
            }

            const groupName = targetGroup ? await getGroupName(sock, targetGroup) : 'Current Group';

            if (!val) {
                const current = targetGroup ? getGroupSettings(targetGroup).audience : 'all';
                return sock.sendMessage(chatId, {
                    text: [
                        '👥 *GC STATUS AUDIENCE*',
                        `Group: *${groupName}*`,
                        `Current: *${current === 'close' ? 'Close Friends 🤝' : 'Everyone (default)'}*`,
                        '',
                        '*In this group:*',
                        '*$gcstatus -audience close*',
                        '*$gcstatus -audience all*',
                        '',
                        '*By group number:*',
                        '*$gcstatus -audience close 1*',
                        '*$gcstatus -audience all 1*',
                        '',
                        '*From DM:*',
                        '*$gcstatus -audience <close|all|reset> <groupNumber|groupJid>*',
                        '',
                        '> *POWERED BY DARATECH V2*',
                    ].join('\n')
                }, { quoted: message });
            }
            if (val === 'close' || val === 'closefriends') {
                setGroupAudience(targetGroup, 'close');
                return sock.sendMessage(chatId, { text: `🤝 *GC Status audience set to Close Friends* for *${groupName}*.\n\nOnly people on your personal Close Friends list will see statuses posted here from now on.\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
            }
            if (val === 'all' || val === 'reset' || val === 'everyone') {
                setGroupAudience(targetGroup, 'all');
                return sock.sendMessage(chatId, { text: `👥 *GC Status audience set to Everyone* for *${groupName}*.\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
            }
            return sock.sendMessage(chatId, { text: `❌ Unknown audience *"${val}"*.\n\nUse *close* or *all*.\n\n> *POWERED BY DARATECH V2*` }, { quoted: message });
        }
    }

    // ── 4. Extract Inline Flags (-color, -audience) and Target Specs ───────────
    const { cleanText, color: flagColor, audience: flagAudience } = extractFlags(body);
    const { targetSpecs, remainingContent } = extractTargets(cleanText, chatId);

    const { jids: targetJids, missingIndices, totalGroups } = await resolveTargetJids(sock, senderId, targetSpecs);

    if (missingIndices.length > 0 && !targetJids.length) {
        return sock.sendMessage(chatId, {
            text: `❌ Group #${missingIndices.join(', #')} not found.\n\nYou have *${totalGroups}* participating groups (1 to ${totalGroups}).\n\n💡 Use \`$gcstatus -list\` to see your group numbers.\n\n> *POWERED BY DARATECH V2*`
        }, { quoted: message });
    }

    // If no target groups resolved (e.g. called from DM without any JID or group numbers)
    if (!targetJids.length) {
        return sock.sendMessage(chatId, {
            text: [
                `📢 *GROUP STATUS — DM MODE*`,
                `Post text or media to one or more groups from your DM.`,
                ``,
                `📋 *GROUP SELECTION*`,
                `▸ \`$gcstatus -list\``,
                `▸ Use group numbers, ranges, \`all\`, or raw Group JIDs`,
                ``,
                `✍️ *TEXT STATUS*`,
                `▸ \`$gcstatus 1 <message>\``,
                `▸ \`$gcstatus 1,3,5 <message>\``,
                `▸ \`$gcstatus 1,3,5,8-10 <message>\``,
                `▸ \`$gcstatus all <message>\``,
                ``,
                `🖼️ *MEDIA STATUS*`,
                `▸ In a group: reply to media + \`$gcstatus\` to post there`,
                `▸ In a group: reply + \`$gcstatus <caption>\` to override its caption`,
                `▸ Reply to media: \`$gcstatus 1,3,5\``,
                `▸ Reply with caption: \`$gcstatus 1,3,5 New caption\``,
                `▸ Raw JID media: reply + \`$gcstatus 120363...@g.us\``,
                `▸ Raw JID override: \`$gcstatus 120363...@g.us New caption\``,
                `▸ Original media captions are kept unless you provide a new caption.`,
                ``,
                `🎯 *RAW JID POSTING*`,
                `▸ \`$gcstatus <groupJid> <message>\``,
                `▸ \`$gcstatus <jid1,jid2> <message>\``,
                ``,
                `🎨 *STATUS OPTIONS*`,
                `▸ In a group: \`$gcstatus -color\` shows that group's full color config`,
                `▸ In a group: \`$gcstatus -audience\` shows that group's full audience config`,
                `▸ Add \`-color <name|random|reset>\``,
                `▸ Add \`-audience <close|all|reset>\``,
                `▸ Options work with number, \`all\`, and raw-JID posts.`,
                ``,
                `🔍 Tip: Use \`$jidp\` inside a group to get its JID.`,
                ``,
                `> *POWERED BY DARATECH V2*`,
            ].join('\n')
        }, { quoted: message });
    }

    // ── 5. No quoted message: TEXT status ───────────────────
    if (!quotedMsg) {
        if (!remainingContent) {
            return sock.sendMessage(chatId, {
                text: [
                    `📢 *GROUP STATUS*`,
                    `Post text or media to one or more WhatsApp groups.`,
                    ``,
                    `📋 *GROUP SELECTION*`,
                    `▸ *$gcstatus -list* — list groups with numbers`,
                    `▸ Use numbers, ranges, *all*, or raw Group JIDs`,
                    ``,
                    `✍️ *TEXT STATUS*`,
                    `▸ *$gcstatus 1 <message>*`,
                    `▸ *$gcstatus 1,3,5 <message>*`,
                    `▸ *$gcstatus 1,3,5,8-10 <message>*`,
                    `▸ *$gcstatus all <message>*`,
                    ``,
                    `🖼️ *MEDIA STATUS*`,
                    `▸ In a group: reply to media + *$gcstatus* to post there`,
                    `▸ In a group: reply + *$gcstatus <caption>* to override its caption`,
                    `▸ Reply to media: *$gcstatus 1,3,5*`,
                    `▸ Reply with caption: *$gcstatus 1,3,5 New caption*`,
                    `▸ Raw JID media: *$gcstatus 120363...@g.us New caption*`,
                    `▸ Original media captions are kept unless a new caption is provided`,
                    ``,
                    `🎯 *RAW JID POSTING*`,
                    `▸ *$gcstatus <message>*`,
                    `▸ *$gcstatus <groupJid> <message>*`,
                    `▸ *$gcstatus <jid1,jid2> <message>*`,
                    ``,
                    `🎨 *STATUS OPTIONS*`,
                    `▸ In a group: *$gcstatus -color* shows the full color config`,
                    `▸ In a group: *$gcstatus -audience* shows the full audience config`,
                    `▸ *$gcstatus -color <name|random|reset> [num]*`,
                    `▸ *$gcstatus -audience <close|all> [num]*`,
                    `▸ Add *-color* or *-audience* to number, *all*, or raw-JID posts`,
                    ``,
                    `*Colors:* ${COLOR_NAMES}`,
                    ``,
                    `> *POWERED BY DARATECH V2*`,
                ].join('\n')
            }, { quoted: message });
        }

        // Inline color via comma syntax: "$gcstatus Hello,blue" (if -color flag was not passed)
        let statusText = remainingContent;
        let inlineColor = flagColor;
        if (!inlineColor && statusText.includes(',')) {
            const comma = statusText.lastIndexOf(',');
            const maybeColor = statusText.slice(comma + 1).trim();
            const resolved = resolveColor(maybeColor);
            if (resolved !== null) {
                statusText = statusText.slice(0, comma).trim();
                inlineColor = resolved;
            }
        }

        return broadcastStatus(
            sock,
            chatId,
            message,
            targetJids,
            (jid) => ({
                text: statusText,
                backgroundColor: pickColor(jid, inlineColor),
            }),
            'Text',
            flagAudience
        );
    }

    // ── 6. MEDIA / QUOTED MESSAGE ───────────────────
    const mediaPayload = unwrapQuotedMessage(quotedMsg);
    const mediaType = detectMediaType(mediaPayload);
    const channelReshare = extractChannelReshare(quotedMsg, mediaPayload, message);
    const isChannel = !!channelReshare?.isChannelPost;

    if (isChannel) {
        console.log(`📢 [gcstatus] Detected Channel Post status (Channel JID: ${channelReshare.channelJid || 'unknown'})`);
    }

    // If quoted text (not media)
    if (!mediaType) {
        const quotedText = extractQuotedText(mediaPayload) || extractQuotedText(quotedMsg);
        if (quotedText) {
            const inlineColor = flagColor || resolveColor(remainingContent);
            return broadcastStatus(
                sock,
                chatId,
                message,
                targetJids,
                (jid) => ({
                    text: quotedText,
                    backgroundColor: pickColor(jid, inlineColor),
                    channelReshareInfo: channelReshare,
                }),
                isChannel ? 'Channel Post' : 'Text',
                flagAudience
            );
        }

        return sock.sendMessage(chatId, {
            text: '❌ Unsupported message type. Reply to a *text*, *image*, *video*, *sticker*, or *audio* message.\n\n> *POWERED BY DARATECH V2*'
        }, { quoted: message });
    }

    const defaultLabel = mediaType[0].toUpperCase() + mediaType.slice(1);
    const label = isChannel ? 'Channel Post' : defaultLabel;
    await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

    try {
        const buffer = await downloadMedia(mediaPayload, mediaType);
        if (!buffer?.length) throw new Error('The quoted media could not be downloaded.');

        if (mediaType === 'audio') {
            const voiceNote = await convertToVoiceNote(buffer);
            const waveform = await generateWaveform(buffer).catch(() => undefined);
            return broadcastStatus(
                sock,
                chatId,
                message,
                targetJids,
                () => ({
                    audio: voiceNote,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    waveform,
                    channelReshareInfo: channelReshare,
                }),
                isChannel ? 'Channel Post' : 'Audio',
                flagAudience
            );
        }

        if (mediaType === 'sticker') {
            return broadcastStatus(
                sock,
                chatId,
                message,
                targetJids,
                () => ({
                    sticker: buffer,
                    channelReshareInfo: channelReshare,
                }),
                isChannel ? 'Channel Post' : 'Sticker',
                flagAudience
            );
        }

        // Image or Video
        const originalCaption = getMediaCaption(mediaPayload, mediaType);
        const finalCaption = remainingContent || originalCaption || '';

        return broadcastStatus(
            sock,
            chatId,
            message,
            targetJids,
            () => ({
                [mediaType]: buffer,
                caption: finalCaption,
                channelReshareInfo: channelReshare,
            }),
            label,
            flagAudience
        );

    } catch (err) {
        console.error(`[gcstatus/${mediaType}]`, err);
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
        return sock.sendMessage(chatId, {
            text: `❌ Failed to process ${mediaType} status: ${err.message}\n\n> *POWERED BY DARATECH V2*`
        }, { quoted: message });
    }
}

module.exports = gcstatusCommand;
