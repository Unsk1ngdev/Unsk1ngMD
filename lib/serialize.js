const { downloadContentFromMessage, getContentType, jidDecode } = require('@whiskeysockets/baileys');

/**
 * Decodifica y limpia JIDs de WhatsApp
 */
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return (decode.user && decode.server && `${decode.user}@${decode.server}`) || jid;
    }
    return jid;
};

/**
 * Descarga el contenido multimedia de un mensaje
 */
const downloadMediaMessage = async (message) => {
    let type = Object.keys(message)[0];
    let msg = message[type];

    if (type === 'viewOnceMessageV2' || type === 'viewOnceMessage' || type === 'viewOnceMessageV2Extension') {
        msg = msg.message;
        type = Object.keys(msg)[0];
        msg = msg[type];
    }

    const mimeType = msg?.mimetype || '';
    let mediaType = type.replace('Message', '');
    if (mediaType === 'image') mediaType = 'image';
    else if (mediaType === 'video') mediaType = 'video';
    else if (mediaType === 'audio') mediaType = 'audio';
    else if (mediaType === 'sticker') mediaType = 'sticker';
    else if (mediaType === 'document') mediaType = 'document';

    const stream = await downloadContentFromMessage(msg, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
};

/**
 * Serializa y normaliza un mensaje de Baileys para facilitar su consumo
 */
const serialize = (sock, m) => {
    if (!m) return m;

    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = decodeJid(m.key.remoteJid);
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = decodeJid(m.fromMe ? sock.user.id : m.key.participant || m.chat);
    }

    if (m.message) {
        m.type = getContentType(m.message);

        // Desempaquetar ViewOnce
        if (m.type === 'viewOnceMessage' || m.type === 'viewOnceMessageV2' || m.type === 'viewOnceMessageV2Extension') {
            m.message = m.message[m.type].message;
            m.type = getContentType(m.message);
        }

        const messageContent = m.message[m.type];

        // Extracción limpia del texto
        m.body = m.message.conversation ||
            m.message.extendedTextMessage?.text ||
            messageContent?.caption ||
            messageContent?.text ||
            (m.type === 'listResponseMessage' && messageContent?.singleSelectReply?.selectedRowId) ||
            (m.type === 'buttonsResponseMessage' && messageContent?.selectedButtonId) ||
            (m.type === 'templateButtonReplyMessage' && messageContent?.selectedId) ||
            '';

        m.mentionedJid = messageContent?.contextInfo?.mentionedJid || [];

        // Mensaje Citado (Quoted)
        const quoted = messageContent?.contextInfo?.quotedMessage;
        if (quoted) {
            let quotedType = getContentType(quoted);
            let quotedObj = quoted[quotedType];

            if (quotedType === 'viewOnceMessage' || quotedType === 'viewOnceMessageV2' || quotedType === 'viewOnceMessageV2Extension') {
                quotedObj = quotedObj.message;
                quotedType = getContentType(quotedObj);
                quotedObj = quotedObj[quotedType];
            }

            const rawParticipant = messageContent.contextInfo.participant;
            const decodedParticipant = decodeJid(rawParticipant);
            const botJid = decodeJid(sock.user?.id || sock.user?.jid || '');
            const botLid = decodeJid(sock.user?.lid || '');

            const isQuotedFromMe = Boolean(
                (rawParticipant && (decodedParticipant === botJid || (botLid && decodedParticipant === botLid))) ||
                (!m.isGroup && !rawParticipant)
            );

            m.quoted = {
                id: messageContent.contextInfo.stanzaId,
                sender: decodedParticipant || (m.isGroup ? '' : (isQuotedFromMe ? botJid : m.chat)),
                fromMe: isQuotedFromMe,
                participant: rawParticipant || undefined,
                type: quotedType,
                message: quoted,
                body: quotedObj?.text || quotedObj?.caption || quoted.conversation || '',
                download: async () => {
                    return await downloadMediaMessage({ [quotedType]: quotedObj });
                }
            };
        } else {
            m.quoted = null;
        }

        // Método para descargar media del mensaje actual
        m.download = async () => {
            return await downloadMediaMessage(m.message);
        };
    }

    // Funciones de ayuda asociadas al mensaje
    m.reply = async (text, options = {}) => {
        return await sock.sendMessage(m.chat, { text, ...options }, { quoted: m });
    };

    m.react = async (emoji) => {
        return await sock.sendMessage(m.chat, {
            react: {
                text: emoji,
                key: m.key
            }
        });
    };

    return m;
};

module.exports = {
    decodeJid,
    downloadMediaMessage,
    serialize
};

