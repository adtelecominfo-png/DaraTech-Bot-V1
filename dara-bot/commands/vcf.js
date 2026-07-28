// commands/vcf.js
async function vcfCommand(sock, chatId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            return await sock.sendMessage(chatId, { text: '❌ This command can only be used in groups.' });
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants  = groupMetadata.participants;

        let vcfData  = '';
        let exported = 0;

        for (const participant of participants) {
            try {
                // Prefer phoneNumber field (avoids LID); fall back to id only if it's a real JID
                const phoneJid = participant.phoneNumber
                    || (!participant.id.endsWith('@lid') ? participant.id : '');

                if (!phoneJid) continue;   // LID with no phoneNumber — skip

                const number = phoneJid.split(':')[0].split('@')[0];
                if (!number || !/^\d+$/.test(number)) continue;

                // Name: notify (WhatsApp display name in group) → name → number fallback
                let name = (participant.notify || participant.name || '').trim();
                if (!name) name = `+${number}`;
                name = name.replace(/[;,]/g, '').trim();

                vcfData += `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;TYPE=CELL;waid=${number}:+${number}\nEND:VCARD\n`;
                exported++;
            } catch (err) {
                continue;
            }
        }

        if (!vcfData) {
            return await sock.sendMessage(chatId, { text: '❌ No contacts to export.' });
        }

        await sock.sendMessage(chatId, {
            document: Buffer.from(vcfData, 'utf-8'),
            mimetype: 'text/x-vcard',
            fileName: `contacts_${Date.now()}.vcf`,
            caption: `✅ Exported ${exported} contacts`
        }, { quoted: message });

    } catch (error) {
        console.error('Error:', error);
        await sock.sendMessage(chatId, { text: '❌ Failed to export contacts.' });
    }
}

module.exports = vcfCommand;
