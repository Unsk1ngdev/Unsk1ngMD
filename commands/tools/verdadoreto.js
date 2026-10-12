'use strict';

const verdades = [
    '¿Cuál es tu mayor miedo?',
    '¿Alguna vez has mentido a alguien del grupo?',
    '¿Tienes crush en alguien del grupo?',
    '¿Cuál es tu mayor secreto?',
    '¿Alguna vez has llorado por una persona?',
    '¿A quién del grupo le tienes más confianza?',
    '¿Cuál fue tu mayor vergüenza?',
    '¿Has robado algo alguna vez?',
    '¿Cuál es la cosa más estúpida que has hecho?',
    '¿Tienes envidia de alguien del grupo?',
    '¿A quién del grupo no soportas?',
    '¿Has tenido sentimientos por alguien del grupo?',
    '¿Cuál es tu mayor arrepentimiento?',
    '¿Has bloqueado a alguien sin razón?',
    '¿Alguna vez has fingido estar enfermo para no salir?'
];

const retos = [
    'Manda una foto de tu cara ahora mismo 📸',
    'Escribe un mensaje de amor a alguien del grupo',
    'Cambia tu foto de perfil por un meme por 24 horas',
    'Manda el último meme que guardaste',
    'Escribe algo vergonzoso de ti mismo',
    'Haz una confesión pública en el grupo',
    'Manda una nota de voz cantando 🎤',
    'Pon de estado "Soy tonto" por 1 hora',
    'Manda una foto de tus zapatos',
    'Escribe 5 cosas que te gustan de alguien del grupo',
    'Manda el primer meme de tu galería 📱',
    'Menciona a tu crush del grupo 👀',
    'Manda una selfie haciendo cara rara 😜',
    'Escribe una historia de 3 líneas sobre ti',
    'Admite algo que nunca has contado en el grupo'
];

module.exports = {
    name: 'verdadoreto',
    alias: ['vdr', 'truthordare', 'reto', 'verdad'],
    category: 'juegos',
    desc: 'Juega al clásico verdad o reto seleccionando un participante al azar',
    usage: '.verdadoreto [verdad/reto opcional]',
    groupOnly: true,

    execute: async ({ sock, m, args, groupMetadata, participants }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!jid.endsWith('@g.us')) {
            return await sock.sendMessage(jid, {
                text: '❌ Este comando solo funciona en grupos.'
            }, { quoted: m });
        }

        const subCmd = args[0]?.toLowerCase();

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
        const miembros = membersList.filter(p => {
            const cleanId = (p.id || '').split(':')[0] + '@s.whatsapp.net';
            return cleanId && cleanId !== botJid;
        });

        const target = miembros.length > 0
            ? miembros[Math.floor(Math.random() * miembros.length)]
            : { id: m.sender };

        const targetId = target.id || m.sender;
        const numeroElegido = targetId.replace(/:\d+@/, '@').split('@')[0];

        const esVerdad = subCmd === 'verdad' ? true
            : subCmd === 'reto' ? false
            : Math.random() < 0.5;

        const lista = esVerdad ? verdades : retos;
        const contenido = lista[Math.floor(Math.random() * lista.length)];
        const tipo = esVerdad ? '💬 *VERDAD*' : '🎯 *RETO*';
        const emoji = esVerdad ? '🤔' : '😈';

        // Enviar el mensaje y registrar su key
        const msgEnviado = await sock.sendMessage(jid, {
            text: `🎭 *VERDAD O RETO*\n\n` +
                  `${emoji} Le toca a: @${numeroElegido}\n\n` +
                  `${tipo}:\n_${contenido}_\n\n` +
                  `⏰ Tienes *60 segundos* para responder.\n` +
                  `💡 Responde a *este mensaje*.\n` +
                  `_(Di "paso" si no quieres)_\n\n` +
                  `_Unknown Codexツ</>_`,
            mentions: [targetId]
        }, { quoted: m });

        if (!global.vdrEsperando) global.vdrEsperando = {};
        if (global.vdrEsperando[jid]?.timer) {
            clearTimeout(global.vdrEsperando[jid].timer);
        }

        // Temporizador de 60 segundos si no responde
        const timer = setTimeout(async () => {
            if (global.vdrEsperando && global.vdrEsperando[jid] && global.vdrEsperando[jid].msgId === msgEnviado?.key?.id) {
                delete global.vdrEsperando[jid];
                await sock.sendMessage(jid, {
                    text: `⏰ @${numeroElegido} no respondió a tiempo! 😤\n\n_Unknown Codexツ</>_`,
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
            timer
        };
    }
};

