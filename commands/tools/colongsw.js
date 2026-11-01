'use strict';

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');

module.exports = {
    name: 'colongsw',
    alias: ['swcolong', 'robarstatus', 'robarsw', 'getstatus', 'descargarstatus'],
    category: 'tools',
    desc: 'Descarga y te entrega el contenido del estado (story) de WhatsApp de la persona que te mencionó',
    usage: '.colongsw (respondiendo al mensaje donde te mencionaron en un estado)',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        if (!quoted) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📥 DESCARGADOR DE ESTADOS (COLONGSW) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *¿Para qué sirve?*',
                    '┃  Cuando un contacto sube un estado a WhatsApp y te menciona,',
                    '┃  WhatsApp te envía un mensaje con la mención del estado.',
                    '┃  Con este comando puedes descargar la foto o video',
                    '┃  original de ese estado en alta calidad.',
                    '┃',
                    '┃├◆ 📌 *Modo de uso:*',
                    '┃  1. Mantén presionado el mensaje de WhatsApp donde',
                    '┃     te mencionaron en el estado.',
                    '┃  2. Dale a *Responder* (Reply).',
                    '┃  3. Escribe `.colongsw`',
                    '┃  4. ¡El bot te enviará la foto o video del estado!',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        try {
            await m.react?.('⏳');

            const qMsg = quoted.message || {};
            const isImage = Boolean(qMsg.imageMessage || quoted.type === 'imageMessage' || quoted.mtype === 'imageMessage');
            const isVideo = Boolean(qMsg.videoMessage || quoted.type === 'videoMessage' || quoted.mtype === 'videoMessage');
            const caption = qMsg.imageMessage?.caption || qMsg.videoMessage?.caption || quoted.body || quoted.text || '';

            if (isImage || isVideo) {
                let buffer = null;
                if (typeof quoted.download === 'function') {
                    try { buffer = await quoted.download(); } catch (_) {}
                }

                if (!buffer) {
                    buffer = await downloadMediaMessage(
                        { message: qMsg, key: quoted.key || m.key },
                        'buffer',
                        {},
                        { logger, reuploadRequest: sock.updateMediaMessage }
                    );
                }

                if (!buffer || buffer.length === 0) {
                    return await sock.sendMessage(jid, {
                        text: '❌ No se pudo descargar el contenido multimedia del estado citado.\n\n_Unknown Codexツ</>_'
                    }, { quoted: m });
                }

                await m.react?.('📥');

                if (isVideo) {
                    return await sock.sendMessage(jid, {
                        video: buffer,
                        caption: [
                            '┏❐ 《 🎬 ESTADO RECUPERADO 》 ❐',
                            '┃',
                            caption ? `┃├◆ 📝 *Texto del estado:*\n┃   ${caption}\n┃` : '',
                            '┃├◆ 📥 Estado descargado con éxito vía ColongSW.',
                            '┗❐\n',
                            '_Unknown Codexツ</>_'
                        ].filter(Boolean).join('\n')
                    }, { quoted: m });
                } else {
                    return await sock.sendMessage(jid, {
                        image: buffer,
                        caption: [
                            '┏❐ 《 🖼️ ESTADO RECUPERADO 》 ❐',
                            '┃',
                            caption ? `┃├◆ 📝 *Texto del estado:*\n┃   ${caption}\n┃` : '',
                            '┃├◆ 📥 Estado descargado con éxito vía ColongSW.',
                            '┗❐\n',
                            '_Unknown Codexツ</>_'
                        ].filter(Boolean).join('\n')
                    }, { quoted: m });
                }
            } else if (caption) {
                // Estado de solo texto
                await m.react?.('📝');
                return await sock.sendMessage(jid, {
                    text: [
                        '┏❐ 《 📝 ESTADO DE TEXTO RECUPERADO 》 ❐',
                        '┃',
                        `┃├◆ 💬 *Contenido:*\n${caption}`,
                        '┃',
                        '┃├◆ 📥 Estado extraído con éxito vía ColongSW.',
                        '┗❐\n',
                        '_Unknown Codexツ</>_'
                    ].join('\n')
                }, { quoted: m });
            } else {
                return await sock.sendMessage(jid, {
                    text: '⚠️ El mensaje citado no contiene contenido multimedia ni texto de estado reconocible.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

        } catch (err) {
            logger.error('[COLONGSW ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al extraer el estado: ${err.message}\n\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

