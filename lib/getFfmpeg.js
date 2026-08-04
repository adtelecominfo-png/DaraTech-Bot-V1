'use strict';
const fs = require('fs');
const path = require('path');

function getFfmpegPath() {
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
        return process.env.FFMPEG_PATH;
    }

    const candidates = [
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/opt/homebrew/bin/ffmpeg',
        '/Applications/CapCut.app/Contents/Resources/ffmpeg',
    ];

    for (const bin of candidates) {
        try {
            if (fs.existsSync(bin)) return bin;
        } catch {}
    }

    try {
        const staticPath = require('ffmpeg-static');
        if (staticPath && fs.existsSync(staticPath)) return staticPath;
    } catch {}

    return 'ffmpeg';
}

module.exports = getFfmpegPath;
