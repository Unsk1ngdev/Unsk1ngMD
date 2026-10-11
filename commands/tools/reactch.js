'use strict';

/**
 * Comando: .reactch [url_canal/id_mensaje] [emoji o palabra]
 * Cuando el owner use .reactch:
 * 1. Verifica que quien ejecuta es el owner del bot.
 * 2. Si NO es el owner: ignorar silenciosamente.
 * 3. Valida que la URL sea de canal de WhatsApp (https://whatsapp.com/channel/).
 * 4. Extrae el ID del canal y el ID del mensaje de la URL.
 * 5. Mapea palabras clave a emojis reales de WhatsApp.
 * 6. Si es emoji directo, lo usa tal cual.
 * 7. Si no se reconoce la palabra, usa ✅ por defecto avisando al owner.
 * 8. Si WhatsApp rechaza el emoji, intenta con ✅ por defecto.
 */

// ── Mapa de palabras a emojis reales ──
// WhatsApp solo acepta emojis Unicode estándar como reacciones
const palabraAEmoji = {
    // Positivos
    'ok': '✅', 'bien': '👍', 'perfecto': '💯', 'excelente': '🏆',
    'si': '✅', 'no': '❌', 'love': '❤️', 'amor': '❤️',
    'fuego': '🔥', 'fire': '🔥', 'caliente': '🔥',
    'jaja': '😂', 'risa': '😂', 'gracioso': '😂',
    'wow': '😮', 'sorpresa': '😮', 'increible': '🤯',
    'triste': '😢', 'llorar': '😭', 'sad': '😢',
    'bravo': '👏', 'aplausos': '👏', 'felicidades': '🎉',
    'fiesta': '🎉', 'celebrar': '🎊', 'cumple': '🎂',
    // Reacciones comunes
    'corazon': '❤️', 'heart': '❤️', 'like': '👍',
    'dislike': '👎', 'mano': '👋', 'hola': '👋',
    'dinero': '💰', 'money': '💸', 'rico': '🤑',
    'musica': '🎵', 'nota': '🎶', 'baile': '💃',
    'corona': '👑', 'rey': '👑', 'domina': '💪',
    'fuerte': '💪', 'calavera': '💀', 'muerte': '💀',
    'nuke': '☠️', 'bomba': '💣', 'explosion': '💥',
    'ojo': '👀', 'ver': '👀', 'spy': '🕵️',
    'raro': '🤔', 'pensar': '🤔', 'duda': '❓',
    'importante': '‼️', 'alerta': '⚠️', 'peligro': '🚨',
    'check': '✅', 'x': '❌', 'cruz': '❌',
    'estrella': '⭐', 'brillo': '✨', 'chido': '😎',
    'frio': '🥶', 'calor': '🥵', 'dormir': '😴',
    'enojado': '😡', 'bravo2': '🤬', 'diablo': '😈',
    'angel': '😇', 'rezar': '🙏', 'gracias': '🙏',
    'paloma': '🕊️', 'paz': '🕊️', 'aguila': '🦅',
    'codex': '💀', 'unknown': '👑', 'bot': '🤖'
};

module.exports = {
    name: 'reactch',
    alias: ['reaccionarcanal', 'chreact'],
    category: 'tools',
    desc: 'Reacciona a un mensaje de canal de WhatsApp con un emoji o palabra clave (solo owner)',
    usage: '.reactch [url_canal/id_mensaje] [emoji o palabra]',
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
                      '*.reactch https://whatsapp.com/channel/xxx/yyy [emoji]*\n\n' +
                      '📌 Ejemplos:\n' +
                      '*.reactch [url] 🔥*\n' +
                      '*.reactch [url] fuego*\n' +
                      '*.reactch [url] amor*\n' +
                      '*.reactch [url] ok*'
            }, { quoted: m });
        }

        // 3. Extraer ID del canal y del mensaje
        const cleanUrl = args[0].split('?')[0].replace(/\/+$/, '');
        const partes = cleanUrl.split('/');
        const idCanal = partes[4];
        const idMensaje = partes[5];

        if (!idCanal || !idMensaje) {
            return await sock.sendMessage(chatId, {
                text: '❌ URL inválida. Asegúrate de que tenga el formato:\n' +
                      '*https://whatsapp.com/channel/ID_CANAL/ID_MENSAJE*'
            }, { quoted: m });
        }

        // 4. Procesar el texto/emoji del usuario
        const inputTexto = args.slice(1).join(' ').toLowerCase().trim();
        let emojiAUsar = '';

        if (!inputTexto) {
            // Sin argumento: usar 🔥 por defecto
            emojiAUsar = '🔥';
        } else {
            // Verificar si el usuario puso un emoji directamente
            const esEmoji = /\p{Extended_Pictographic}/u.test(inputTexto);

            if (esEmoji) {
                // El usuario ya puso un emoji directamente
                emojiAUsar = inputTexto;
            } else if (palabraAEmoji[inputTexto]) {
                // Palabra conocida → mapear a emoji
                emojiAUsar = palabraAEmoji[inputTexto];
            } else if (['quitar', 'remove', 'delete', 'borrar'].includes(inputTexto)) {
                // Opción para eliminar la reacción
                emojiAUsar = '';
            } else {
                // Palabra no reconocida → usar ✅ por defecto
                emojiAUsar = '✅';
                await sock.sendMessage(chatId, {
                    text: `⚠️ Palabra no reconocida. Usando *✅* por defecto.\n` +
                          `💡 Tip: Usa directamente un emoji como *🔥 ❤️ 👍 💯*`
                }, { quoted: m });
            }
        }

        try {
            // Obtener metadata del canal
            const datosCanal = await sock.newsletterMetadata('invite', idCanal);

            // Enviar la reacción
            await sock.newsletterReactMessage(datosCanal.id, idMensaje, emojiAUsar);

            if (!emojiAUsar) {
                await sock.sendMessage(chatId, {
                    text: `🗑️ Reacción eliminada del mensaje en el canal *${datosCanal.name || idCanal}*\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
            } else {
                await sock.sendMessage(chatId, {
                    text: `✅ *Reacción enviada exitosamente*\n\n` +
                          `📢 Canal: *${datosCanal.name || idCanal}*\n` +
                          `⚡ Reacción: *${emojiAUsar}*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

        } catch (err) {
            console.error('[REACTCH] Error:', err.message);

            // Si falla, intentar con emoji básico (✅)
            try {
                const datosCanal = await sock.newsletterMetadata('invite', idCanal);
                await sock.newsletterReactMessage(datosCanal.id, idMensaje, '✅');

                await sock.sendMessage(chatId, {
                    text: `⚠️ El emoji original falló.\n✅ Se usó *✅* como alternativa.\n\n` +
                          `📢 Canal: *${datosCanal.name || idCanal}*\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            } catch (err2) {
                await sock.sendMessage(chatId, {
                    text: `❌ Error al reaccionar.\n📋 Detalle: ${err.message}\n\n` +
                          `💡 Verifica que:\n` +
                          `1. La URL sea correcta\n` +
                          `2. El bot esté suscrito al canal\n` +
                          `3. El ID del mensaje sea válido`
                }, { quoted: m });
            }
        }
    }
};
