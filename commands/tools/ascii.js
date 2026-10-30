'use strict';

const cfonts = require('cfonts');
const config = require('../../config');

module.exports = {
    name: 'ascii',
    alias: ['banner', 'asciitext', 'textart', 'figlet'],
    category: 'herramientas',
    desc: 'Convierte cualquier texto en arte ASCII estilo banner con letras grandes',
    usage: '.ascii <texto>',

    execute: async ({ sock, m, text }) => {
        const jid = m.chat;

        if (!text || !text.trim()) {
            const prefix = config.defaultPrefix || '.';
            return await sock.sendMessage(jid, {
                text: [
                    '🎨 *CONVERSOR DE ARTE ASCII* 🎨',
                    '',
                    '❌ *Debes proporcionar el texto a convertir.*',
                    '',
                    '📌 *Ejemplos de uso:*',
                    `• *${prefix}ascii HOLA*`,
                    `• *${prefix}ascii ${config.botName || 'Unsk1ngMD'}*`,
                    `• *${prefix}ascii WIN*`,
                    '',
                    '💡 _Recomendación: Máximo 15-20 caracteres para que encaje perfecto en pantallas de celular._'
                ].join('\n')
            }, { quoted: m });
        }

        const cleanText = text.trim();

        // Control de longitud para evitar que en móvil las líneas se rompan de forma desordenada
        if (cleanText.length > 25) {
            return await sock.sendMessage(jid, {
                text: '❌ El texto es demasiado largo para un banner ASCII (máximo 25 caracteres para mantener la alineación).'
            }, { quoted: m });
        }

        await m.react?.('🎨');

        try {
            // Renderizar arte ASCII limpio y legible en WhatsApp (estilo simple/banner clásico)
            const rendered = cfonts.render(cleanText, {
                font: 'simple',
                rawMode: true,
                align: 'left'
            });

            const asciiArt = (rendered.string || '').trimEnd();

            const messageText = [
                '🎨 *ARTE ASCII RESULTANTE:*',
                '```',
                asciiArt,
                '```',
                `_${config.authorName || 'Unknown Codexツ</>'}_`
            ].join('\n');

            await sock.sendMessage(jid, {
                text: messageText
            }, { quoted: m });

            await m.react?.('✅');
        } catch (err) {
            await m.react?.('❌');
            return await sock.sendMessage(jid, {
                text: `❌ Error generando arte ASCII: ${err.message}`
            }, { quoted: m });
        }
    }
};

