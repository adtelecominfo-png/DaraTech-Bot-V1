/**
 * Networking & system info commands
 * $netinfo  - public IP + ISP + location
 * $ipinfo   - detailed IP info (same as netinfo)
 * $cpuinfo  - CPU / platform info
 * $meminfo  - RAM usage
 * $diskinfo - Disk usage (df -h)
 * $timezone - Current timezone & time
 */

// Uses global fetch (Node.js 18+) — no require needed
const { exec } = require('child_process');
const os = require('os');

function run(cmd) {
    return new Promise((resolve, reject) => {
        exec(cmd, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout.trim());
        });
    });
}

function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB';
    return (bytes / 1024 ** 3).toFixed(1) + ' GB';
}

async function netinfoCommand(sock, chatId, message) {
    try {
        await sock.sendMessage(chatId, { text: '🌐 Fetching network info...' }, { quoted: message });
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();

        const text = [
            '🌐 *Network Info*',
            '',
            `🖥️ *IP Address:* \`${data.ip || 'N/A'}\``,
            `🏙️ *City:* ${data.city || 'N/A'}`,
            `🌍 *Region:* ${data.region || 'N/A'}`,
            `🚩 *Country:* ${data.country_name || 'N/A'} (${data.country_code || ''})`,
            `📍 *Coordinates:* ${data.latitude || 'N/A'}, ${data.longitude || 'N/A'}`,
            `🕐 *Timezone:* ${data.timezone || 'N/A'}`,
            `📡 *ISP:* ${data.org || 'N/A'}`,
            `🔢 *ASN:* ${data.asn || 'N/A'}`,
            `🔗 *Currency:* ${data.currency || 'N/A'} (${data.currency_name || ''})`,
        ].join('\n');

        await sock.sendMessage(chatId, { text }, { quoted: message });
    } catch (err) {
        await sock.sendMessage(chatId, { text: `❌ Could not fetch network info: ${err.message}` }, { quoted: message });
    }
}

async function cpuinfoCommand(sock, chatId, message) {
    const cpus = os.cpus();
    const cpu = cpus[0] || {};
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();
    const uptime = process.uptime();
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = Math.floor(uptime % 60);

    const text = [
        '💻 *CPU & System Info*',
        '',
        `🖥️ *CPU Model:* ${cpu.model || 'N/A'}`,
        `⚙️ *Cores:* ${cpus.length}`,
        `🔧 *Speed:* ${cpu.speed || 'N/A'} MHz`,
        `🖱️ *Platform:* ${platform} (${arch})`,
        `🌐 *Hostname:* ${hostname}`,
        `🔢 *Node.js:* ${process.version}`,
        `⏱️ *Bot Uptime:* ${h}h ${m}m ${s}s`,
        `🕐 *System Uptime:* ${Math.floor(os.uptime() / 3600)}h`,
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

async function meminfoCommand(sock, chatId, message) {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const pct = ((used / total) * 100).toFixed(1);

    const proc = process.memoryUsage();

    const text = [
        '🧠 *Memory Info*',
        '',
        `📦 *Total RAM:* ${fmtBytes(total)}`,
        `✅ *Free RAM:* ${fmtBytes(free)}`,
        `🔴 *Used RAM:* ${fmtBytes(used)} (${pct}%)`,
        '',
        '🤖 *Bot Process Memory:*',
        `  RSS:      ${fmtBytes(proc.rss)}`,
        `  Heap Used: ${fmtBytes(proc.heapUsed)}`,
        `  Heap Total: ${fmtBytes(proc.heapTotal)}`,
        `  External: ${fmtBytes(proc.external)}`,
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

async function diskinfoCommand(sock, chatId, message) {
    try {
        const df = await run('df -h --output=source,size,used,avail,pcent,target 2>/dev/null | head -10');
        await sock.sendMessage(chatId, {
            text: `💾 *Disk Info*\n\n\`\`\`\n${df}\n\`\`\``
        }, { quoted: message });
    } catch {
        await sock.sendMessage(chatId, {
            text: '❌ Could not fetch disk info on this system.'
        }, { quoted: message });
    }
}

async function timezoneCommand(sock, chatId, message) {
    const now = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const text = [
        '🕐 *Timezone Info*',
        '',
        `🌍 *Timezone:* ${tz}`,
        `📅 *Date:* ${now.toDateString()}`,
        `🕐 *Time:* ${now.toTimeString()}`,
        `🔢 *UTC Offset:* UTC${now.getTimezoneOffset() > 0 ? '-' : '+'}${Math.abs(now.getTimezoneOffset() / 60)}`,
        `⏳ *Unix Timestamp:* ${Math.floor(now.getTime() / 1000)}`,
    ].join('\n');

    await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = { netinfoCommand, cpuinfoCommand, meminfoCommand, diskinfoCommand, timezoneCommand };
