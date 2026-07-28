'use strict';

async function gitcloneCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        let repoUrl = text.split(' ').slice(1).join(' ').trim();
        if (!repoUrl || !repoUrl.includes('github.com')) {
            return sock.sendMessage(chatId, {
                text: '🐙 Usage: $gitclone <GitHub repo URL>\nExample: $gitclone https://github.com/owner/repo',
            }, { quoted: message });
        }
        repoUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
        const parts = repoUrl.split('github.com/');
        if (parts.length < 2) {
            return sock.sendMessage(chatId, { text: '❌ Invalid GitHub URL format.' }, { quoted: message });
        }
        const repoPath = parts[1];
        await sock.sendMessage(chatId, {
            text: `╭━═『 *GIT CLONE* 』━╮\n┃ 🐙 *Repo:* ${repoPath}\n┃ 📦 *Task:* Downloading ZIP...\n╰━━━━━━━━━━━━━━━━╯`,
        }, { quoted: message });
        // Try main branch first, fallback to master
        const branches = ['main', 'master'];
        let sent = false;
        for (const branch of branches) {
            try {
                const zipUrl = `https://github.com/${repoPath}/archive/refs/heads/${branch}.zip`;
                await sock.sendMessage(chatId, {
                    document: { url: zipUrl },
                    mimetype: 'application/zip',
                    fileName: `${repoPath.replace(/\//g, '_')}_${branch}.zip`,
                    caption: `*GitHub Repo Downloaded!*\n🐙 *Repo:* ${repoPath}\n🌿 *Branch:* ${branch}\n\n🚀 *Daratech Bot*`,
                }, { quoted: message });
                sent = true;
                break;
            } catch {}
        }
        if (!sent) throw new Error('Failed to download any branch');
    } catch (err) {
        console.error('[gitclone]', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Git clone failed. Make sure the repo URL is correct and public.',
        }, { quoted: message });
    }
}

module.exports = gitcloneCommand;
