'use strict';

function cleanName(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9áéíóúñ]/gi, '').trim();
}

/**
 * Calcula un porcentaje determinista basado en los dos nombres
 */
function calculateAffinity(nameA, nameB) {
    const combined = [cleanName(nameA), cleanName(nameB)].sort().join('&');
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash * 31 + combined.charCodeAt(i)) % 10007;
    }
    // Rango de 20% a 100% para que siempre sea divertido
    return 20 + (hash % 81);
}

function getProgressBar(percent) {
    const totalBars = 10;
    const filled = Math.round((percent / 100) * totalBars);
    const empty = totalBars - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

const COSMIC_VERDICTS = [
    { min: 90, title: '🔥 ¡ALMAS GEMELAS PREDELIMITADAS!', desc: 'Su conexión trasciende galaxias y vidas pasadas. Nacieron para estar juntos.' },
    { min: 75, title: '💖 ¡COMPATIBILIDAD MAGNÉTICA!', desc: 'Hay chispas y gran química cósmica. Juntos son una combinación imparable.' },
    { min: 60, title: '✨ BUENA SINTONÍA Y COMPLICIDAD', desc: 'Se entienden bien y se divierten. La comunicación es su mejor virtud.' },
    { min: 40, title: '🌪️ RELACIÓN DE CONTRASTES', desc: 'Los opuestos se atraen, aunque a veces saltan chispas de desacuerdo.' },
    { min: 0, title: '❄️ ALMAS EN DIFERENTE SINTONÍA', desc: 'Un misterio cósmico... Más vale llevarse como buenos amigos.' }
];

module.exports = {
    name: 'soulmatch',
    alias: ['almasgemelas', 'amor', 'compatibilidad', 'lovematch', 'shipalma'],
    category: 'diversión',
    desc: 'Calcula el porcentaje de afinidad cósmica y compatibilidad de almas entre dos nombres o personas',
    usage: '.soulmatch <nombre1> | <nombre2> o .soulmatch @persona1 @persona2',

    execute: async ({ sock, m, args, text }) => {
        const jid = m.chat || m.key.remoteJid;
        const raw = (args && args.length > 0 ? args.join(' ') : (text || '')).trim();

        let name1 = '';
        let name2 = '';

        // Si mencionaron usuarios
        const mentions = m.mentionedJid || [];
        if (mentions.length >= 2) {
            name1 = `@${mentions[0].replace(/[^0-9]/g, '')}`;
            name2 = `@${mentions[1].replace(/[^0-9]/g, '')}`;
        } else if (mentions.length === 1) {
            name1 = `@${(m.sender || '').replace(/[^0-9]/g, '')}`;
            name2 = `@${mentions[0].replace(/[^0-9]/g, '')}`;
        } else if (raw.includes('|')) {
            const parts = raw.split('|');
            name1 = parts[0].trim();
            name2 = parts[1].trim();
        } else if (raw.toLowerCase().includes(' y ')) {
            const parts = raw.split(/\s+y\s+/i);
            name1 = parts[0].trim();
            name2 = parts[1].trim();
        } else if (args && args.length >= 2) {
            name1 = args[0].trim();
            name2 = args.slice(1).join(' ').trim();
        }

        if (!name1 || !name2) {
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔮 CALCULADORA DE ALMAS GEMELAS 》 ❐',
                    '┃',
                    '┃├◆ 📋 *Uso:* `.soulmatch <nombre1> | <nombre2>`',
                    '┃├◆ 📌 *Ejemplo 1:* `.soulmatch Carlos | Maria`',
                    '┃├◆ 📌 *Ejemplo 2:* `.soulmatch @usuario1 @usuario2`',
                    '┃',
                    '┃├◆ ✨ Descubre la compatibilidad astral y sentimental',
                    '┃  entre dos personas según el oráculo cósmico.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        const percentage = calculateAffinity(name1, name2);
        const progressBar = getProgressBar(percentage);
        const verdict = COSMIC_VERDICTS.find(v => percentage >= v.min) || COSMIC_VERDICTS[COSMIC_VERDICTS.length - 1];

        await m.react?.('🔮');
        await sock.sendMessage(jid, {
            text: [
                '┏❐ 《 🔮 AFINIDAD CÓSMICA & SOULMATCH 》 ❐',
                '┃',
                `┃├◆ 👤 *Persona 1:* ${name1}`,
                `┃├◆ 👤 *Persona 2:* ${name2}`,
                '┃',
                `┃├◆ 📊 *Nivel de Conexión:* ${percentage}%`,
                `┃   [${progressBar}]`,
                '┃',
                `┃├◆ 💫 *Veredicto del Destino:*`,
                `┃   *${verdict.title}*`,
                `┃   _${verdict.desc}_`,
                '┗❐\n',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: mentions.length > 0 ? mentions : []
        }, { quoted: m });
    }
};

