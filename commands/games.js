const triviaManager = require('../lib/trivia');
const logger = require('../lib/logger');
const { checkGroupPermissions } = require('../lib/groupPermissions');
const userNames = require('../lib/userNames');

/**
 * Normaliza cualquier JID eliminando sufijos de dispositivo (:1, :2) y caracteres no numéricos
 */
const cleanPhone = (id) => (id ? id.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');
const cleanDevice = (id) => (id ? id.replace(/:\d+@/, '@') : '');

module.exports = [
    // 1. .ruleta (Ruleta Rusa de Grupo)
    {
        name: 'ruleta',
        alias: ['ruletarusa', 'roulette'],
        category: 'juegos',
        desc: 'Juego de la ruleta rusa: 1 de cada 6 disparos es letal y expulsa al participante si el bot es admin',
        usage: '.ruleta',
        groupOnly: true,
        execute: async ({ sock, m, args = [] }) => {
            await m.react?.('🎲');

            const jid = m.chat;
            const senderJid = m.sender || m.key?.participant || '';
            const userPhone = cleanPhone(senderJid) || 'participante';
            const mentionJid = cleanDevice(senderJid) || `${userPhone}@s.whatsapp.net`;
            const userName = (m.pushName || '').trim() || userNames.get(mentionJid) || `@${userPhone}`;

            // Tambor de 6 recámaras, 1 sola bala (probabilidad exacta 1/6)
            // Soporta .ruleta test / .ruleta disparar para pruebas de verificación
            const forceShot = Array.isArray(args) && args.some(a => ['test', 'shot', 'bang', 'disparar'].includes(String(a).toLowerCase()));
            const isShot = forceShot || Math.floor(Math.random() * 6) === 0;

            if (!isShot) {
                // Caso: Sobrevive (Clic)
                return await sock.sendMessage(jid, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `*¡Clic! La recámara estaba vacía. Te has salvado.* 😅\n` +
                        `_El tambor giró y el percutor no encontró bala. ${userName} respira aliviado._`,
                    mentions: [mentionJid]
                }, { quoted: m });
            }

            // Caso: Disparo letal (¡BANG! 💥)
            await m.react?.('💥');

            // 1. Obtener metadata y permisos de administrador de forma robusta (LIDs, números y dispositivo)
            const permissions = await checkGroupPermissions(sock, jid, senderJid, null, m);
            const isBotAdmin = permissions.isBotAdmin;
            const senderMember = permissions.senderMember;
            const isSenderAdmin = permissions.isSenderAdmin;

            // Determinar JID de expulsión exacto registrado en el grupo sin sufijo de dispositivo
            const rawExpelId = senderMember?.id || m.key?.participant || senderJid;
            const expelJid = cleanDevice(rawExpelId);

            if (!isBotAdmin) {
                // Si el bot NO es admin: mensaje lúdico indicando falta de permisos para expulsar
                return await sock.sendMessage(jid, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `💥 *¡BANG!* Recibiste el disparo en pleno rostro, ${userName}... 🩸\n\n` +
                        `_Has perdido la ronda de la ruleta rusa. Te has salvado de la expulsión únicamente porque el bot no cuenta con permisos de Administrador en este grupo._`,
                    mentions: [mentionJid]
                }, { quoted: m });
            }

            // Si el participante que perdió es el Creador/Superadmin del grupo (WhatsApp prohíbe expulsar al creador)
            if (senderMember?.admin === 'superadmin') {
                return await sock.sendMessage(jid, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `💥 *¡BANG!* La bala te atravesó la frente, ${userName}... 💀\n\n` +
                        `👑 _¡Inmunidad de Creador! Recibiste el tiro letal, pero como eres el Creador del grupo, las reglas de WhatsApp impiden expulsarte._`,
                    mentions: [mentionJid]
                }, { quoted: m });
            }

            // 2. Si el bot ES admin: notificar de inmediato la eliminación en el grupo
            await sock.sendMessage(jid, {
                text:
                    `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                    `💥 *¡BANG! La bala estaba en la recámara. Adiós...* ${userName} ⚰️\n\n` +
                    `_Jalaste del gatillo y el disparo fue letal. Has sido eliminado automáticamente del grupo por perder en la ruleta rusa._`,
                mentions: [mentionJid]
            }, { quoted: m });

            // 3. Pausa breve (800ms) para garantizar que el mensaje se distribuya en el chat antes de expulsar
            await new Promise((resolve) => setTimeout(resolve, 800));

            // 4. Expulsar automáticamente al perdedor
            try {
                await sock.groupParticipantsUpdate(jid, [expelJid], 'remove');
            } catch (expelErr) {
                logger.error('Error al expulsar usuario en ruleta:', expelErr.message);

                // Si falló y el usuario tiene rango admin, intentar degradar primero y luego remover
                if (isSenderAdmin || senderMember?.admin === 'admin') {
                    try {
                        await sock.groupParticipantsUpdate(jid, [expelJid], 'demote');
                        await sock.groupParticipantsUpdate(jid, [expelJid], 'remove');
                        return;
                    } catch (retryErr) {
                        logger.warn('[RULETA] No se pudo degradar y remover admin:', retryErr.message);
                    }
                }

                const errStr = String(expelErr?.message || expelErr);
                if (errStr.includes('403') || errStr.toLowerCase().includes('admin')) {
                    await sock.sendMessage(jid, {
                        text: `⚠️ No se pudo expulsar a ${userName} porque también es Administrador del grupo.`,
                        mentions: [mentionJid]
                    }, { quoted: m });
                } else {
                    await sock.sendMessage(jid, {
                        text: `⚠️ No se pudo expulsar a ${userName}: ${expelErr.message}`,
                        mentions: [mentionJid]
                    }, { quoted: m });
                }
            }
        }
    },

    // 2. .trivia
    {
        name: 'trivia',
        alias: ['quiz', 'pregunta'],
        category: 'juegos',
        desc: 'Inicia una trivia de cultura general con opciones A, B, C y D (45 seg límite)',
        usage: '.trivia',
        execute: async ({ sock, m, args }) => {
            const sub = (args && args[0] ? args[0] : '').toLowerCase();
            if (sub === 'stop' || sub === 'cancel' || sub === 'cancelar') {
                const cancelled = triviaManager.cancelGame(m.chat);
                if (cancelled) {
                    return await sock.sendMessage(m.chat, { text: '🧠 Partida de trivia cancelada con éxito.' }, { quoted: m });
                }
                return await sock.sendMessage(m.chat, { text: 'ℹ️ No hay ninguna trivia activa en este chat.' }, { quoted: m });
            }
            await triviaManager.startGame(sock, m);
        }
    },
    {
        name: 'canceltrivia',
        alias: ['stoptrivia', 'stopquiz'],
        category: 'juegos',
        desc: 'Cancela la trivia en curso en el chat',
        usage: '.canceltrivia',
        execute: async ({ sock, m }) => {
            const cancelled = triviaManager.cancelGame(m.chat);
            if (cancelled) {
                await sock.sendMessage(m.chat, { text: '🧠 Partida de trivia cancelada con éxito.' }, { quoted: m });
            } else {
                await sock.sendMessage(m.chat, { text: 'ℹ️ No hay ninguna trivia activa en este chat.' }, { quoted: m });
            }
        }
    }
];
