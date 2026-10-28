'use strict';

/**
 * 🎱 Comando: .8ball
 * Bola 8 mágica que responde preguntas con predicciones del destino
 */

const RESPUESTAS = [
    // Afirmativas
    '🟢 En mi opinión, sí.',
    '🟢 Es cierto.',
    '🟢 Es decididamente así.',
    '🟢 Probablemente.',
    '🟢 Buen pronóstico.',
    '🟢 Todo apunta a que sí.',
    '🟢 Sin duda alguna.',
    '🟢 Sí, definitivamente.',
    '🟢 Debes confiar en ello.',

    // Neutras / Inciertas
    '🟡 Respuesta vaga, vuelve a intentar.',
    '🟡 Pregunta en otro momento.',
    '🟡 Será mejor que no te lo diga ahora.',
    '🟡 No puedo predecirlo ahora.',
    '🟡 Concéntrate y vuelve a preguntar.',

    // Negativas
    '🔴 No cuentes con ello.',
    '🔴 Mi respuesta es no.',
    '🔴 Mis fuentes dicen que no.',
    '🔴 Las perspectivas no son muy buenas.',
    '🔴 Muy dudoso.',
    '🔴 Definitivamente no.'
];

module.exports = {
    name: '8ball',
    alias: ['bola8', 'magic8', 'suerte'],
    category: 'juegos',
    desc: 'Consulta a la bola mágica 8 sobre cualquier duda o pregunta',
    usage: '.8ball [tu pregunta]',

    execute: async ({ sock, m, text }) => {
        const pregunta = text?.trim() || m.quoted?.body?.trim();

        if (!pregunta) {
            return await sock.sendMessage(m.chat, {
                text: '🎱 *¿Qué deseas consultar a la Bola Mágica?*\n\n' +
                      'Ejemplo: *.8ball ¿Aprobaré mi examen mañana?*\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        try {
            if (typeof m.react === 'function') await m.react('🎱').catch(() => {});
        } catch (_) {}

        const respuesta = RESPUESTAS[Math.floor(Math.random() * RESPUESTAS.length)];
        const usuario = m.pushName || (m.sender ? `@${m.sender.split('@')[0]}` : 'Consultante');

        const card =
`╭━━━〔 🎱 *BOLA MÁGICA 8* 〕━━━⬣
┃ 👤 *Pregunta de:* ${usuario}
┃ ❓ *Duda:* "${pregunta}"
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣

🔮 *EL DESTINO REVELA:*
${respuesta}

_Unknown Codexツ</>_`;

        await sock.sendMessage(m.chat, {
            text: card,
            mentions: m.sender ? [m.sender] : []
        }, { quoted: m });
    }
};

