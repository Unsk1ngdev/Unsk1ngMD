'use strict';

const path = require('path');
const fs = require('fs-extra');
const { generateQRWithLogo } = require('../../lib/media');
const config = require('../../config');
const logger = require('../../lib/logger');

module.exports = {
    name: 'generarqr',
    alias: ['qrlogo', 'botqr', 'qrconlogo', 'qrcodebot'],
    category: 'multimedia',
    desc: 'Genera un código QR de alta resolución con el logo oficial del bot en el centro',
    usage: '.generarqr <texto o enlace>',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        if (!text || !text.trim()) {
            const prefix = config.defaultPrefix || '.';
            return await sock.sendMessage(jid, {
                text: [
                    '📱 *GENERADOR DE QR CON LOGO* 📱',
                    '',
                    '❌ *Debes ingresar un texto o enlace.*',
                    '',
                    '📌 *Ejemplos de uso:*',
                    `• *${prefix}generarqr https://github.com/Unsk1ngdev/Unsk1ngMD*`,
                    `• *${prefix}generarqr Unete a mi grupo: https://chat.whatsapp.com/...*`,
                    `• *${prefix}generarqr Contacto de Soporte Oficial*`,
                    '',
                    `_${config.authorName || 'Unknown Codexツ</>'}_`
                ].join('\n')
            }, { quoted: m });
        }

        const cleanText = text.trim();
        await m.react?.('⏳');

        try {
            // 1. Obtener la foto de perfil del bot o usar el logo en assets/comandos.jpg
            let logoBuffer = null;
            const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';

            if (botJid && typeof sock.profilePictureUrl === 'function') {
                try {
                    const pfpUrl = await sock.profilePictureUrl(botJid, 'image');
                    if (pfpUrl) {
                        const axios = require('axios');
                        const res = await axios.get(pfpUrl, { responseType: 'arraybuffer', timeout: 5000 });
                        if (res.status === 200 && res.data) {
                            logoBuffer = Buffer.from(res.data);
                        }
                    }
                } catch (_) {
                    // Fallback a assets/comandos.jpg si no tiene pfp
                }
            }

            if (!logoBuffer) {
                const defaultLogo = path.join(process.cwd(), 'assets', 'comandos.jpg');
                if (await fs.pathExists(defaultLogo)) {
                    logoBuffer = defaultLogo;
                }
            }

            // 2. Generar el código QR con el logo en el centro
            const qrBuffer = await generateQRWithLogo(cleanText, logoBuffer, { width: 700 });

            // 3. Enviar la imagen
            const captionText = [
                '📱 *CÓDIGO QR GENERADO CON LOGO* 📱',
                '',
                `🔗 *Contenido:* ${cleanText}`,
                `🤖 *Bot:* ${config.botName || 'Unsk1ngMD'}`,
                '',
                '📷 _Escanea el código con tu cámara de celular o app lectora de QR._',
                '',
                `_${config.authorName || 'Unknown Codexツ</>'}_`
            ].join('\n');

            await sock.sendMessage(jid, {
                image: qrBuffer,
                caption: captionText
            }, { quoted: m });

            await m.react?.('✅');
        } catch (err) {
            logger.error(`[GENERARQR] Error generando QR con logo: ${err.message}`);
            await m.react?.('❌');
            await sock.sendMessage(jid, {
                text: `❌ Error al generar el código QR con logo: ${err.message}`
            }, { quoted: m });
        }
    }
};

