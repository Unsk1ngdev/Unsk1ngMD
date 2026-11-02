'use strict';

const axios = require('axios');
const FormData = require('form-data');
const sharp = require('../../lib/sharp');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const logger = require('../../lib/logger');

module.exports = {
    name: 'ocr',
    alias: ['leertesto', 'extraertexto', 'imagetotext', 'imagetext'],
    category: 'herramientas',
    desc: 'Extrae texto editable de una foto o captura de pantalla (OCR)',
    usage: 'Cita una imagen con .ocr',

    execute: async ({ sock, m }) => {
        const jid = m.chat || m.key.remoteJid;
        const quoted = m.quoted;

        if (!quoted) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔍 RECONOCEDOR DE TEXTO (OCR) 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* Cita una foto o screenshot y escribe: `.ocr`',
                    '┃├◆ 💡 *Tip:* Extrae texto de recibos, libros, capturas de pantalla o letreros.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const isImage = Boolean(
            quoted.message?.imageMessage ||
            quoted.mtype === 'imageMessage' ||
            quoted.msg?.mimetype?.includes('image') ||
            quoted.mimetype?.includes('image')
        );

        if (!isImage) {
            return await sock.sendMessage(jid, {
                text: '❌ Debes citar una fotografía o imagen para extraer su texto.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            await m.react?.('🔍');
        } catch (_) {}

        await sock.sendMessage(jid, {
            text: '🔎 Leyendo y digitalizando texto de la imagen... Un momento por favor.'
        }, { quoted: m });

        try {
            const targetMsg = {
                key: quoted.key || { id: quoted.id, remoteJid: jid },
                message: quoted.message || { imageMessage: quoted.msg || quoted }
            };

            const rawBuffer = await downloadMediaMessage(targetMsg, 'buffer', {}, {
                logger: { level: 'silent', child: () => ({ level: 'silent' }) }
            });

            if (!rawBuffer || rawBuffer.length === 0) {
                throw new Error('No se pudo descargar la imagen.');
            }

            // Normalizar a PNG nítido con Sharp
            const optimizedPng = await sharp(rawBuffer)
                .resize({ width: 1600, withoutEnlargement: true })
                .png()
                .toBuffer();

            const form = new FormData();
            form.append('apikey', 'K88829443788957');
            form.append('file', optimizedPng, { filename: 'ocr_image.png', contentType: 'image/png' });
            form.append('language', 'spa');
            form.append('scale', 'true');
            form.append('OCREngine', '2');

            const res = await axios.post('https://api.ocr.space/parse/image', form, {
                headers: form.getHeaders(),
                timeout: 30000
            });

            const parsedResults = res.data?.ParsedResults;
            if (!Array.isArray(parsedResults) || parsedResults.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No se pudo extraer texto de la imagen proporcionada.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const extractedText = (parsedResults[0].ParsedText || '').trim();

            if (!extractedText) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ La imagen no parece contener texto legible.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 📄 TEXTO EXTRAÍDO CON ÉXITO 》 ❐',
                    '┃',
                    '┃├◆ 📝 *Contenido:*',
                    '',
                    extractedText,
                    '',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });

        } catch (err) {
            logger.error('[OCR ERROR]:', err.message);
            await sock.sendMessage(jid, {
                text: `❌ Error al procesar OCR: ${err.message}\n_Unknown Codexツ</>_`
            }, { quoted: m });
        }
    }
};

