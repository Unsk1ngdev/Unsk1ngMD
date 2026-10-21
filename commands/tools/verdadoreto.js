'use strict';

const verdadesClasicas = [
    '¿Cuál es tu mayor miedo inconfesable?',
    '¿Alguna vez le has mentido descaradamente a alguien de este grupo?',
    '¿Tienes o has tenido un crush secreto con alguien de este grupo? 👀',
    '¿Cuál es el secreto más grande que le ocultas a tu familia?',
    '¿Cuándo fue la última vez que lloraste por amor y por qué?',
    '¿A quién de este grupo le confiarías tu vida en una emergencia?',
    '¿Cuál ha sido la situación más vergonzosa que has vivido en público?',
    '¿Alguna vez te has quedado con algo ajeno y fingiste demencia?',
    '¿Cuál es la tontería más grande que has hecho por llamar la atención?',
    '¿Alguna vez has sentido envidia del estilo de vida de alguien de este grupo?',
    'Si tuvieras que eliminar a un participante de este grupo para siempre, ¿a quién elegirías?',
    '¿Cuál es tu mayor arrepentimiento del último año?',
    '¿Alguna vez has bloqueado a alguien solo para que te rogara atención?',
    '¿Has fingido una enfermedad grave o drama para no asistir a una cita?',
    '¿Qué es lo más tóxico que has hecho por celos?',
    '¿Has revisado las conversaciones del teléfono de tu pareja o amigo sin permiso?',
    '¿Alguna vez hablaste mal de tu mejor amigo/a a sus espaldas?',
    '¿Qué foto o video de tu galería borrarías de inmediato si te revisaran el teléfono ahora?',
    '¿Alguna vez has mandado un mensaje picante al chat equivocado? 😳',
    '¿Cuánto dinero es lo máximo que has gastado en algo completamente inútil?',
    '¿Alguna vez has stalkeado a la ex pareja de alguien de este grupo?',
    '¿Qué mentira le dijiste a tus padres que hasta el día de hoy se la creen?'
];

const verdadesPicantes = [
    '¿Cuál ha sido tu fantasía más atrevida que nunca le has contado a nadie? 🔥',
    '¿Te ha gustado alguna vez la pareja o ex-pareja de un amigo cercano?',
    '¿Cuál es la persona más prohibida con la que has tenido ganas de algo más?',
    '¿Alguna vez has besado a alguien solo por despecho?',
    '¿Qué es lo más atrevido que has hecho en un lugar público?',
    'Si tuvieras una noche libre sin consecuencias con alguien de este grupo, ¿a quién elegirías? 😏',
    '¿Alguna vez te han pillado en un momento íntimo comprometedor?',
    '¿Alguna vez has mandado una foto subida de tono y te arrepentiste a los 2 segundos?'
];

const retosClasicos = [
    'Manda una foto de tu rostro haciendo tu peor cara ridícula ahora mismo 📸',
    'Manda una nota de voz cantando a todo pulmón los primeros 15 segundos del coro de tu canción favorita 🎤',
    'Escribe un mensaje de declaración romántica exagerada a alguien de este grupo 👀',
    'Cambia tu foto de perfil de WhatsApp por una imagen chistosa o meme que te elija el grupo por 1 hora',
    'Manda una captura de pantalla de los últimos 3 mensajes de tu chat más reciente 📱',
    'Manda el meme más rancio y vergonzoso que tengas guardado en tu galería',
    'Confiesa públicamente cuál fue tu apodo de infancia más humillante',
    'Pon en tu estado de WhatsApp durante 1 hora: "Me enamoré y no sé cómo decírselo 🥺"',
    'Manda una foto de tus pies o de tus zapatos actuales sin dar explicaciones 👟',
    'Dedícale 3 cumplidos poéticos y exagerados al administrador de este grupo',
    'Envía un audio imitando a un animal furioso durante 10 segundos 🦁',
    'Manda una captura de tu tiempo de uso de pantalla del teléfono hoy ⏱️',
    'Escribe una historia dramática de 3 líneas donde tú seas el villano de la película',
    'Menciona a 3 personas del grupo y califícalas del 1 al 10 en belleza con justificación 😂',
    'Manda una foto de lo que tienes exactamente al frente tuyo ahora mismo',
    'Graba un audio diciendo un trabalenguas rápido sin equivocarte: "Tres tristes tigres tragaban trigo en un trigal"'
];

const retosPicantes = [
    'Manda una foto sonriendo de la forma más seductora que puedas 📸🔥',
    'Manda un audio susurrando un piropo atrevido como si fueras un locutor de radio de medianoche 🎙️😏',
    'Etiqueta a la persona del grupo que consideres más atractiva y dile qué es lo que más te llama la atención 👀',
    'Ponte de estado de WhatsApp por 30 minutos: "A veces pienso en ti cuando cae la noche... tú sabes quién eres"'
];

module.exports = {
    name: 'verdadoreto',
    alias: ['vdr', 'truthordare', 'reto', 'verdad'],
    category: 'juegos',
    desc: 'Juega al clásico verdad o reto con detección de respuestas y evidencia multimedia',
    usage: '.verdadoreto [verdad / reto / picante / stop]',
    groupOnly: true,

    execute: async ({ sock, m, args, command, groupMetadata, participants }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo funciona en grupos.'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();

        if (!global.vdrEsperando) global.vdrEsperando = {};

        // Cancelar turno activo
        if (subCmd === 'stop' || subCmd === 'cancelar' || subCmd === 'pasar') {
            if (!global.vdrEsperando[jid]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay ningún turno de verdad o reto pendiente en este grupo.'
                }, { quoted: m });
            }
            if (global.vdrEsperando[jid].timer) {
                clearTimeout(global.vdrEsperando[jid].timer);
            }
            delete global.vdrEsperando[jid];
            return await sock.sendMessage(jid, {
                text: '✅ Turno de verdad o reto cancelado. ¡Pueden iniciar otro cuando quieran!'
            }, { quoted: m });
        }

        // Obtener miembros del grupo excluyendo al bot
        let membersList = participants || [];
        if (!membersList.length && groupMetadata?.participants) {
            membersList = groupMetadata.participants;
        }

        if (!membersList.length) {
            try {
                const meta = await sock.groupMetadata(jid);
                membersList = meta?.participants || [];
            } catch (_) {}
        }

        const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';
        let miembros = membersList.filter(p => {
            const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
            return cleanId && cleanId !== botJid;
        });

        // Si se mencionó a alguien en específico para pasarle el reto
        const mentionedInCmd = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        let targetId = null;

        if (mentionedInCmd.length > 0) {
            targetId = mentionedInCmd[0];
        } else {
            if (miembros.length === 0 && membersList.length > 0) {
                miembros = membersList;
            }
            const elegido = miembros.length > 0
                ? miembros[Math.floor(Math.random() * miembros.length)]
                : { id: m.sender };
            targetId = elegido.id || m.sender;
        }

        const numeroElegido = (targetId || '').replace(/:\d+@/, '@').split('@')[0].replace(/[^0-9]/g, '');

        // Determinar tipo de reto
        const esPicante = subCmd === 'picante' || subCmd === 'hot';
        let esVerdad = false;

        if (command === 'verdad' || subCmd === 'verdad') {
            esVerdad = true;
        } else if (command === 'reto' || subCmd === 'reto') {
            esVerdad = false;
        } else {
            esVerdad = Math.random() < 0.5;
        }

        let lista = [];
        if (esPicante) {
            lista = esVerdad ? verdadesPicantes : retosPicantes;
        } else {
            lista = esVerdad ? verdadesClasicas : retosClasicos;
        }

        const contenido = lista[Math.floor(Math.random() * lista.length)];
        const tipoHeader = esPicante
            ? (esVerdad ? '🔥 *VERDAD PICANTE*' : '🌶️ *RETO PICANTE*')
            : (esVerdad ? '💬 *VERDAD*' : '🎯 *RETO*');
        const emojiPrincipal = esVerdad ? '🤔' : '😈';

        const msgEnviado = await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  🎭 *VERDAD O RETO*  ║\n` +
                  `╚══════════════════╝\n\n` +
                  `${emojiPrincipal} *Víctima elegida:* @${numeroElegido}\n\n` +
                  `${tipoHeader}:\n` +
                  `_${contenido}_\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `⏰ Tienes *60 segundos* para responder con tu texto, foto o audio.\n` +
                  `💡 *Responde citando este mensaje.*\n` +
                  `_(Escribe "paso" si te da miedo el castigo)_\n\n` +
                  `_Unknown Codexツ</>_`,
            mentions: [targetId]
        }, { quoted: m });

        if (global.vdrEsperando[jid]?.timer) {
            clearTimeout(global.vdrEsperando[jid].timer);
        }

        // Temporizador de 60 segundos
        const timer = setTimeout(async () => {
            if (global.vdrEsperando && global.vdrEsperando[jid] && global.vdrEsperando[jid].msgId === msgEnviado?.key?.id) {
                delete global.vdrEsperando[jid];
                await sock.sendMessage(jid, {
                    text: `⏰ @${numeroElegido} ¡Se le acabó el tiempo de 60 segundos! 🐔\n` +
                          `¡Se acobardó ante el grupo! Elige otro con *.verdadoreto*.\n\n` +
                          `_Unknown Codexツ</>_`,
                    mentions: [targetId]
                });
                if (msgEnviado?.key) {
                    try {
                        await sock.sendMessage(jid, {
                            react: { text: '⏰', key: msgEnviado.key }
                        });
                    } catch (_) {}
                }
            }
        }, 60000);

        global.vdrEsperando[jid] = {
            jid: targetId,
            msgId: msgEnviado?.key?.id,
            esVerdad,
            timer
        };
    }
};
