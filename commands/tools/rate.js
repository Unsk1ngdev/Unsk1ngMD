'use strict';

const TIER_RESPONSES = [
    {
        min: 9.5,
        emoji: '👑🔥',
        comments: [
            '¡Obra de arte viviente! Los dioses del Olimpo lloran de envidia.',
            'Un 10 rotundo. No encuentro fallas en tu lógica ni en tu existencia.',
            'Perfección pura. Guárdalo en una vitrina para que no se desgaste.'
        ]
    },
    {
        min: 8.0,
        emoji: '✨👌',
        comments: [
            'Bastante sólido y respetable. Te doy mi sello de aprobación oficial.',
            'Muy por encima del promedio. Un verdadero espectáculo.',
            'Tiene estilo, personalidad y buen porte. Me convence.'
        ]
    },
    {
        min: 6.0,
        emoji: '⚖️👍',
        comments: [
            'Decente. Pasa con honores raspando la cuerda floja.',
            'No está nada mal, aunque con un poco de esfuerzo llegas a la gloria.',
            'Aprobado. Cumple su función sin presumir demasiado.'
        ]
    },
    {
        min: 4.0,
        emoji: '😬📉',
        comments: [
            'Mmm... digamos que tiene salud y buenas intenciones.',
            'Hay potencial oculto, pero está bien escondido.',
            'Se intentó, y eso es lo que cuenta (supongo).'
        ]
    },
    {
        min: 0.0,
        emoji: '💀🗑️',
        comments: [
            'Mis sensores de IA sufrieron un cortocircuito al ver esto.',
            'Por respeto a la humanidad, fingiré que nunca evalué esto.',
            'Ni la caridad pública se atrevería a defender semejante tragedia.'
        ]
    }
];

function getRandomScore() {
    // Generar un número entre 1.0 y 10.0 con 1 decimal
    const score = (Math.random() * 9 + 1).toFixed(1);
    return parseFloat(score);
}

module.exports = {
    name: 'rate',
    alias: ['calificar', 'puntuar', 'puntuacion', 'opinar'],
    category: 'diversión',
    desc: 'El bot evalúa y califica cualquier cosa, foto, objeto o pregunta con un puntaje de 0 a 10 y su veredicto',
    usage: '.rate <lo que quieras calificar>',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const target = (args && args.length > 0 ? args.join(' ') : (text || m.quoted?.body || '')).trim();

        if (!target) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 ⭐ CRÍTICO & CALIFICADOR IA 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.rate <lo que quieras calificar>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.rate mi cara`',
                    '┃├◆ 📌 *Ejemplo 2:* `.rate este outfit` (respondiendo a foto)',
                    '┃├◆ 📌 *Ejemplo 3:* `.rate mi suerte hoy`',
                    '┃',
                    '┃├◆ ⚖️ El bot dará su opinión sincera y sin filtros.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const score = getRandomScore();
        const tier = TIER_RESPONSES.find(t => score >= t.min) || TIER_RESPONSES[TIER_RESPONSES.length - 1];
        const comment = tier.comments[Math.floor(Math.random() * tier.comments.length)];

        await m.react?.('⚖️');
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 ⭐ CALIFICACIÓN DEL BOT 》 ❐',
                '┃',
                `┃├◆ 🎯 *Evaluando:* "${target}"`,
                `┃├◆ 📊 *Puntuación:* *${score} / 10* ${tier.emoji}`,
                '┃',
                `┃├◆ 💬 *Dictamen del juez:*`,
                `┃  "${comment}"`,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n')
        }, { quoted: m });
    }
};

