'use strict';

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const premium = require('../../lib/premium');
const database = require('../../lib/database');
const logger = require('../../lib/logger');

module.exports = {
    name: 'imglink',
    alias: ['tourlimg', 'subirimg', 'uploadimg', 'imgbb', 'imgurl'],
    category: 'multimedia',
    desc: 'Sube una imagen a ImgBB y genera enlaces públicos directos, web y de eliminación',
    usage: '.imglink (respondiendo a una imagen)',

    execute: async ({ sock, m, args, text, isOwner, isAdmin }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender || m.key.participant || jid;

        // 1. Verificación de permisos: Owner, Premium o Admin de grupo
        const isPermitted = isOwner || database.isOwner(sender, sock) || premium.isPremium(sender, sock) || isAdmin;
        if (!isPermitted) {
            return await sock.sendMessage(jid, {
                text: '⛔ No tienes permiso para usar este comando.\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 2. Identificar si hay una imagen citada o enviada en el mensaje actual
        const quoted = m.quoted;
        let isImage = false;
        let targetMsg = null;
        let targetKey = null;

        if (quoted) {
            const qMime = quoted.mimetype || quoted.message?.imageMessage?.mimetype || '';
            if (
                quoted.type === 'imageMessage' ||
                qMime.startsWith('image/') ||
                !!quoted.message?.imageMessage ||
                (quoted.type === 'viewOnceMessage' && !!quoted.message?.imageMessage)
            ) {
                isImage = true;
                targetMsg = quoted.message?.imageMessage ? { imageMessage: quoted.message.imageMessage } : quoted.message;
                targetKey = quoted.key || m.key;
            }
        } else if (
            m.type === 'imageMessage' ||
            (m.mimetype || '').startsWith('image/') ||
            !!m.message?.imageMessage
        ) {
            isImage = true;
            targetMsg = m.message?.imageMessage ? { imageMessage: m.message.imageMessage } : m.message;
            targetKey = m.key;
        }

        // Si no se proporcionó una imagen, mostrar el menú interactivo
        if (!isImage) {
            return await sock.sendMessage(jid, {
                text: [
                    '╔══════════════════════════╗',
                    '║   🖼️  IMG LINK          ║',
                    '╚══════════════════════════╝',
                    '┃',
                    '┃ • .imglink (respondiendo imagen)',
                    '┃   Sube la imagen a internet y genera',
                    '┃   el link directo para verla.',
                    '┃',
                    '┃ Devuelve:',
                    '┃   🔗 Link directo a la imagen',
                    '┃',
                    '┃ Ejemplo:',
                    '┃   [Responde una foto] .imglink',
                    '╚══════════════════════════╝',
                    '',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Validar API Key de ImgBB en variables de entorno
        const IMGBB_KEY = (process.env.IMGBB_KEY || '').trim();
        if (!IMGBB_KEY) {
            return await sock.sendMessage(jid, {
                text: '❌ Falta configurar `IMGBB_KEY` en el archivo `.env`.\nObtén tu API key gratuita en: https://api.imgbb.com'
            }, { quoted: m });
        }

        await sock.sendMessage(jid, { text: '⬆️ Subiendo imagen a ImgBB...' }, { quoted: m });

        try {
            // 4. Descargar el buffer de la imagen de forma resiliente
            let buffer = null;

            if (quoted && typeof quoted.download === 'function') {
                try {
                    buffer = await quoted.download();
                } catch (_) {}
            }

            if (!buffer && typeof m.download === 'function') {
                try {
                    buffer = await m.download();
                } catch (_) {}
            }

            if (!buffer && targetMsg) {
                buffer = await downloadMediaMessage(
                    { message: targetMsg, key: targetKey },
                    'buffer',
                    {},
                    { logger, reuploadRequest: sock.updateMediaMessage }
                );
            }

            if (!buffer || buffer.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '❌ Error: No se pudo descargar la imagen desde WhatsApp.'
                }, { quoted: m });
            }

            // 5. Preparar formulario multipart/form-data
            const form = new FormData();
            form.append('key', IMGBB_KEY);
            form.append('image', buffer, {
                filename: `img_${Date.now()}.jpg`,
                contentType: 'image/jpeg'
            });
            form.append('expiration', '0'); // Permanente (nunca expira)

            const res = await axios.post('https://api.imgbb.com/1/upload', form, {
                headers: {
                    ...form.getHeaders(),
                    'User-Agent': 'curl/8.21.0'
                },
                timeout: 30000
            });

            const data = res.data;
            if (!data || !data.success || !data.data) {
                throw new Error(data?.error?.message || 'Respuesta inválida del servidor ImgBB');
            }

            const { url, display_url } = data.data;
            const directLink = display_url || url;

            return await sock.sendMessage(jid, {
                text: directLink
            }, { quoted: m });

        } catch (err) {
            logger.error('Error en comando .imglink:', err.response?.data || err.message);
            const errMsg = err.response?.data?.error?.message || err.message || 'Error desconocido';
            return await sock.sendMessage(jid, {
                text: `❌ Error al subir la imagen: ${errMsg}`
            }, { quoted: m });
        }
    }
};

