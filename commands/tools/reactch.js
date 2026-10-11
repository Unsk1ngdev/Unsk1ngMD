'use strict';

/**
 * Comando: .reactch [url_canal/id_mensaje] [texto]
 * Solo el OWNER puede ejecutarlo. Si no es el owner, se ignora silenciosamente.
 * Reacciona a un mensaje específico de un canal de WhatsApp usando letras estilizadas (🅐🅑🅒...).
 *
 * Ejemplo de uso:
 * .reactch https://whatsapp.com/channel/0029VaXXXXX/123 hola mundo
 */

const fuenteEstilizada = {
    a: '🅐', b: '🅑', c: '🅒', d: '🅓', e: '🅔', f: '🅕', g: '🅖',
    h: '🅗', i: '🅘', j: '🅙', k: '🅚', l: '🅛', m: '🅜', n: '🅝',
    o: '🅞', p: '🅟', q: '🅠', r: '🅡', s: '🅢', t: '🅣', u: '🅤',
    v: '🅥', w: '🅦', x: '🅧', y: '🅨', z: '🅩',
    '0': '⓿', '1': '➊', '2': '➋', '3': '➌', '4': '➍',
    '5': '➎', '6': '➏', '7': '➐', '8': '➑', '9': '➒'
};

module.exports = {
    name: 'reactch',
    alias: ['reaccionarcanal', 'chreact', 'react'],
    category: 'tools',
    desc: 'Reacciona a un mensaje de canal de WhatsApp con texto estilizado (solo owner)',
    usage: '.reactch [url_canal/id_mensaje] [texto]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: false, // Manejado manualmente para ignorar silenciosamente si no es el owner

    execute: async ({ sock, m, args, isOwner }) => {
        // 1. Solo owner (ignorar silenciosamente si no es el owner)
        if (!isOwner) return;

        const chatId = m.chat || m.key.remoteJid;

        // 2. Validar URL
        if (!args[0] || !args[0].startsWith('https://whatsapp.com/channel/')) {
            return await sock.sendMessage(chatId, {
                text: '❌ *Ejemplo de uso:*\n' +
                      '*.reactch https://whatsapp.com/channel/xxx/yyy texto*\n\n' +
                      '📌 *Ejemplo:*\n' +
                      '`.reactch https://whatsapp.com/channel/0029VaXXXXX/123 hola mundo`\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 3. Validar texto
        const textoPlano = args.slice(1).join(' ').trim();
        if (!textoPlano) {
            return await sock.sendMessage(chatId, {
                text: '❌ Debes escribir el texto o emoji para la reacción.\n' +
                      'Ejemplo: `.reactch https://whatsapp.com/channel/xxx/yyy hola`'
            }, { quoted: m });
        }

        // 4. Convertir texto a letras estilizadas
        const textoConvertido = textoPlano.toLowerCase().split('').map(c => {
            if (c === ' ') return '␣';
            return fuenteEstilizada[c] || c;
        }).join('');

        try {
            // 5. Extraer ID del canal y del mensaje
            const cleanUrl = args[0].split('?')[0].replace(/\/+$/, '');
            const partes = cleanUrl.split('/');
            const idCanal = partes[4];
            const idMensaje = partes[5];

            if (!idCanal || !idMensaje) {
                return await sock.sendMessage(chatId, {
                    text: '❌ URL inválida. Asegúrate de incluir tanto el código del canal como el ID del mensaje.\n\n' +
                          '📌 Formato: *https://whatsapp.com/channel/ID_CANAL/ID_MENSAJE*'
                }, { quoted: m });
            }

            // 6. Obtener metadata del canal
            const datosCanal = await sock.newsletterMetadata('invite', idCanal);

            // 7. Enviar la reacción al mensaje del canal usando newsletterReactMessage
            await sock.newsletterReactMessage(datosCanal.id, idMensaje, textoConvertido);

            // 8. Confirmación al owner
            return await sock.sendMessage(chatId, {
                text: `✅ Reacción enviada con *${textoConvertido}* al mensaje del canal *${datosCanal.name || idCanal}*.\n\n_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (err) {
            console.error('[REACTCH] Error:', err);
            return await sock.sendMessage(chatId, {
                text: `❌ Error al reaccionar.\n📋 Detalle: ${err.message || 'Error desconocido'}\n\n` +
                      `💡 Verifica que:\n` +
                      `1. La URL sea correcta y contenga el ID del mensaje\n` +
                      `2. El canal exista y permita reacciones`
            }, { quoted: m });
        }
    }
};
