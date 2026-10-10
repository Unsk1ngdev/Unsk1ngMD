const triviaManager = require('../lib/trivia');
const logger = require('../lib/logger');

/**
 * Normaliza cualquier JID eliminando sufijos de dispositivo (:1, :2) y caracteres no numéricos
 */
const cleanPhone = (id) => (id ? id.replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '') : '');

module.exports = [
    // 1. .ruleta (Ruleta Rusa de Grupo)
    {
        name: 'ruleta',
        alias: ['ruletarusa', 'roulette'],
        category: 'juegos',
        desc: 'Juego de la ruleta rusa: 1 de cada 6 disparos es letal y expulsa al participante',
        usage: '.ruleta',
        groupOnly: true,
        execute: async ({ sock, m }) => {
            await m.react('🎲');

            const jid = m.chat;
            const senderJid = m.sender;
            const userPhone = cleanPhone(senderJid) || 'participante';
            const targetJid = `${userPhone}@s.whatsapp.net`;

            // Tambor de 6 recámaras, 1 sola bala (probabilidad exacta 1/6)
            const isShot = Math.floor(Math.random() * 6) === 0;

            if (!isShot) {
                // Caso: Sobrevive (Clic)
                return await sock.sendMessage(jid, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `*¡Clic! La recámara estaba vacía. Te has salvado.* 😅\n` +
                        `_El tambor giró y el percutor no encontró bala. @${userPhone} respira aliviado._`,
                    mentions: [senderJid, targetJid]
                }, { quoted: m });
            }

            // Caso: Disparo letal (¡BANG! 💥)
            await m.react('💥');

            // 1. Obtener metadata del grupo para verificar permisos de administrador
            let groupMetadata = null;
            try {
                groupMetadata = await sock.groupMetadata(jid);
            } catch (err) {
                logger.error('Error al obtener groupMetadata en .ruleta:', err.message);
            }

            const participants = groupMetadata?.participants || [];
            const botPhone = cleanPhone(sock.user?.id || sock.user?.jid);
            const botLid = cleanPhone(sock.user?.lid);

            // Búsqueda robusta del bot entre participantes (por número o por LID)
            const botParticipant = participants.find(p => {
                const pPhone = cleanPhone(p.id);
                const pLid = cleanPhone(p.lid);
                return (botPhone && (pPhone === botPhone || pLid === botPhone)) ||
                       (botLid && (pPhone === botLid || pLid === botLid));
            });

            const isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';

            if (!isBotAdmin) {
                // Si el bot NO es admin: mensaje lúdico indicando falta de permisos
                return await sock.sendMessage(jid, {
                    text:
                        `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                        `💥 *¡BANG!* Recibiste el disparo en pleno rostro, @${userPhone}... 🩸\n\n` +
                        `_Has perdido la ronda, pero te salvaste de la expulsión porque el bot no cuenta con permisos de Administrador en este grupo._`,
                    mentions: [senderJid, targetJid]
                }, { quoted: m });
            }

            // 2. Si el bot ES admin: primero poner el mensaje de eliminación en el chat
            await sock.sendMessage(jid, {
                text:
                    `🎰 *[RULETA RUSA - UNSK1NGMD]*\n\n` +
                    `💥 *¡BANG! La bala estaba en la recámara. Adiós...* @${userPhone} ⚰️\n\n` +
                    `_Jalaste del gatillo y el disparo fue letal. Has sido eliminado del grupo._`,
                mentions: [senderJid, targetJid]
            }, { quoted: m });

            // 3. Pausa breve (1.5s) para garantizar que el mensaje se transmita y visualice antes de expulsar
            await new Promise((resolve) => setTimeout(resolve, 1500));

            // 4. Expulsar inmediatamente al participante del grupo
            try {
                // Resolver el JID exacto que tiene registrado el grupo
                const matchedParticipant = participants.find(p => cleanPhone(p.id) === userPhone);
                const expelJid = matchedParticipant?.id || targetJid;

                await sock.groupParticipantsUpdate(jid, [expelJid], 'remove');
            } catch (expelErr) {
                logger.error('Error al expulsar usuario en ruleta:', expelErr.message);
                const errStr = String(expelErr?.message || expelErr);
                if (errStr.includes('403') || errStr.toLowerCase().includes('admin')) {
                    await sock.sendMessage(jid, {
                        text: `⚠️ No se pudo expulsar a @${userPhone} porque también es Administrador del grupo (WhatsApp prohíbe que un admin expulse a otro).`,
                        mentions: [senderJid, targetJid]
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
        execute: async ({ sock, m }) => {
            await triviaManager.startGame(sock, m);
        }
    }
];
