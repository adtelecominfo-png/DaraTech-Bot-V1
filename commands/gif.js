const axios = require('axios');
const settings = require('../settings');

async function gifCommand(sock, chatId, query) {
    const apiKey = settings.giphyApiKey;

    if (!query) {
        await sock.sendMessage(chatId, { text: 'Please provide a search term for the GIF.' });
        return;
    }

    try {
        const response = await axios.get(`https://api.giphy.com/v1/gifs/search`, {
            params: {
                api_key: apiKey,
                q: query,
                limit: 1,
                rating: 'g'
            }
        });

        const images = response.data.data[0]?.images || {};
        // WhatsApp needs an MP4 for gifPlayback. Giphy provides MP4 renditions
        // alongside the original GIF, so prefer those over the raw .gif URL.
        const gifUrl =
            images.original_mp4?.mp4 ||
            images.downsized_small?.mp4 ||
            images.downsized_medium?.mp4;

        if (gifUrl) {
            await sock.sendMessage(chatId, {
                video: { url: gifUrl },
                gifPlayback: true,
                mimetype: 'video/mp4',
                caption: `Here is your GIF for "${query}"`
            });
        } else {
            await sock.sendMessage(chatId, { text: 'No GIFs found for your search term.' });
        }
    } catch (error) {
        console.error('Error fetching GIF:', error);
        await sock.sendMessage(chatId, { text: 'Failed to fetch GIF. Please try again later.' });
    }
}

module.exports = gifCommand;
