async function clearCommand(sock, chatId) {
    try {
        // First, send a temporary message
        const statusMessage = await sock.sendMessage(chatId, { 
            text: '🗑️ Clearing all bot messages...' 
        });
        
        // Fetch the chat history
        const messages = await sock.fetchMessagesFromWA(chatId, 100); // Adjust number as needed
        
        // Filter messages sent by the bot
        const botMessages = messages.filter(msg => {
            return msg.key.fromMe === true;
        });
        
        if (botMessages.length === 0) {
            // Delete the status message
            await sock.sendMessage(chatId, { delete: statusMessage.key });
            
            // Send a message saying no bot messages found
            const noMessages = await sock.sendMessage(chatId, { 
                text: 'No bot messages found to delete.' 
            });
            
            // Auto-delete after 3 seconds
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, { delete: noMessages.key });
                } catch (error) {
                    console.error('Error auto-deleting message:', error);
                }
            }, 3000);
            
            return;
        }
        
        // Delete each bot message
        for (const message of botMessages) {
            try {
                await sock.sendMessage(chatId, { delete: message.key });
                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error('Error deleting message:', error);
            }
        }
        
        // Update status message
        await sock.sendMessage(chatId, { 
            text: `✅ Cleared ${botMessages.length} bot message(s).`,
            edit: statusMessage.key 
        });
        
        // Auto-delete the status message after 3 seconds
        setTimeout(async () => {
            try {
                await sock.sendMessage(chatId, { delete: statusMessage.key });
            } catch (error) {
                console.error('Error auto-deleting status message:', error);
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error in clear command:', error);
        // Try to send an error message
        try {
            const errorMsg = await sock.sendMessage(chatId, { 
                text: '❌ An error occurred while clearing messages.' 
            });
            
            // Auto-delete error message after 3 seconds
            setTimeout(async () => {
                try {
                    await sock.sendMessage(chatId, { delete: errorMsg.key });
                } catch (error) {
                    console.error('Error auto-deleting error message:', error);
                }
            }, 3000);
        } catch (sendError) {
            console.error('Could not send error message:', sendError);
        }
    }
}

module.exports = { clearCommand };