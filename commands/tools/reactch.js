'use strict';

/**
 * Comando: .reactch [url_canal] [texto]
 * Cuando el owner use .reactch:
 * 1. Verifica que quien ejecuta es el owner del bot. Si no es, ignora silenciosamente.
 * 2. Valida que la URL sea de canal de WhatsApp (https://whatsapp.com/channel/).
 * 3. Extrae el ID del canal de la URL.
 * 4. Convierte el texto a letras estilizadas con emojis de círculo negro (🅐🅑🅒...).
 * 5. Envía el texto estilizado como MENSAJE al canal (sock.sendMessage al JID @newsletter).
 * 6. Confirma que el mensaje fue enviado al canal.
 */

// ── Fuente estilizada (Círculos negros con letras y números) ──
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
    alias: ['canalmsg', 'chmsg', 'react'],
    category: 'tools',
    desc: 'Publica un mensaje estilizado con letras circulares en un canal de WhatsApp (solo owner)',
    usage: '.reactch [url_canal] [texto]',
    groupOnly: false,
    adminOnly: false,
    ownerOnly: false, // Manejo manual para ignorar silenciosamente si no es el owner

    execute: async ({ sock, m, args, isOwner }) => {
        // 1. Solo owner (ignorar silenciosamente si no es el owner)
        if (!isOwner) return;

        const chatId = m.chat || m.key.remoteJid;

        // 2. Validar URL del canal
        if (!args[0] || !args[0].startsWith('https://whatsapp.com/channel/')) {
            return await sock.sendMessage(chatId, {
                text: '❌ Uso correcto:\n' +
                      '*.reactch https://whatsapp.com/channel/xxx hola mundo*\n\n' +
                      '📌 El texto se enviará estilizado al canal:\n' +
                      '🅗🅞🅛🅐␣🅜🅤🅝🅓🅞\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // 3. Validar que escribió un texto
        if (!args[1]) {
            return await sock.sendMessage(chatId, {
                text: '❌ Debes escribir un texto.\nEjemplo: *.reactch [url] hola mundo*'
            }, { quoted: m });
        }

        // 4. Convertir texto plano a fuente estilizada
        const textoPlano = args.slice(1).join(' ').toLowerCase();
        const textoConvertido = textoPlano.split('').map(c => {
            if (c === ' ') return '␣';
            return fuenteEstilizada[c] || c;
        }).join('');

        try {
            // 5. Extraer ID del canal desde la URL
            const cleanUrl = args[0].split('?')[0].replace(/\/+$/, '');
            const partes = cleanUrl.split('/');
            const idCanal = partes[4];

            if (!idCanal) {
                return await sock.sendMessage(chatId, {
                    text: '❌ URL inválida.\nFormato: *https://whatsapp.com/channel/ID_CANAL*'
                }, { quoted: m });
            }

            // 6. Obtener metadata del canal
            const datosCanal = await sock.newsletterMetadata('invite', idCanal);

            // 7. Enviar como MENSAJE al canal (soporte oficial de Baileys a @newsletter)
            if (typeof sock.newsletterSendMessage === 'function') {
                await sock.newsletterSendMessage(datosCanal.id, { text: textoConvertido });
            } else {
                await sock.sendMessage(datosCanal.id, { text: textoConvertido });
            }

            // 8. Confirmar al owner
            await sock.sendMessage(chatId, {
                text: `✅ *Mensaje enviado al canal*\n\n` +
                      `📢 Canal: *${datosCanal.name || idCanal}*\n` +
                      `📝 Texto: *${textoConvertido}*\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });

        } catch (err) {
            console.error('[REACTCH] Error:', err.message);
            await sock.sendMessage(chatId, {
                text: `❌ Error al enviar al canal.\n📋 Detalle: ${err.message}\n\n` +
                      `💡 Verifica:\n` +
                      `1. URL correcta\n` +
                      `2. Bot suscrito al canal\n` +
                      `3. Bot tiene permisos para publicar en el canal`
            }, { quoted: m });
        }
    }
};
