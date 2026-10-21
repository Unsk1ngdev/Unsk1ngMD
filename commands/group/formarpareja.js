'use strict';

module.exports = {
    name: 'formarpareja',
    alias: ['parejas', 'parejasrandom', 'matchgroup'],
    category: 'grupo',
    desc: 'Forma 5 parejas aleatorias del grupo con compatibilidad y título divertido (Requiere 10+ miembros)',
    usage: '.formarpareja',
    groupOnly: true,

    execute: async ({ sock, m, groupMetadata, participants }) => {
        const jid = m.chat;

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
        const filtered = membersList
            .map(p => (p.id || '').replace(/:.*@/, '@').split('@')[0] + '@s.whatsapp.net')
            .filter(id => id && id !== botJid);

        if (filtered.length < 10) {
            return await sock.sendMessage(jid, {
                text: `❌ Se requieren al menos *10 miembros* activos en el grupo para formar 5 parejas (Miembros actuales disponibles: ${filtered.length}).`
            }, { quoted: m });
        }

        // Barajar aleatoriamente a los miembros
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);

        const titulos = [
            'Los Tóxicos Inseparables 💔',
            'Amor a Primera Vista 💖',
            'Boda en Secreto en Las Vegas 💍',
            'Solo Amigos con Derechos 👀',
            'La Pareja del Año 🔥',
            'Destinados a Pelear y Reconciliarse ⚡',
            'Amor Platónico Imposible 🥺',
            'Complicidad Absoluta 🤝'
        ];

        const parejas = [];
        const mentions = [];

        for (let i = 0; i < 5; i++) {
            const persona1 = shuffled[i * 2];
            const persona2 = shuffled[i * 2 + 1];
            const compatibilidad = Math.floor(Math.random() * 51) + 50; // Entre 50% y 100%
            const titulo = titulos[i % titulos.length];

            mentions.push(persona1, persona2);
            parejas.push(
                `*Pareja #${i + 1} — ${titulo}*\n` +
                `👩‍❤️‍👨 @${persona1.split('@')[0]} ❤️ @${persona2.split('@')[0]}\n` +
                `📊 Compatibilidad: *${compatibilidad}%*`
            );
        }

        return await sock.sendMessage(jid, {
            text: [
                '╔══════════════════════════╗',
                '║   💘  TOP 5 PAREJAS DEL DÍA ║',
                '╚══════════════════════════╝',
                '',
                'Cupido ha lanzado sus flechas en este grupo... 🏹💘',
                '',
                parejas.join('\n\n'),
                '',
                '🎉 _¿Cuándo es la boda? ¡Felicidades a los tortolitos!_',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions
        }, { quoted: m });
    }
};

