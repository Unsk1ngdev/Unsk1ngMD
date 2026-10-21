'use strict';

module.exports = {
    name: 'amigorandom',
    alias: ['amistad', 'amigodeldia', 'compas'],
    category: 'grupo',
    desc: 'Escoge 2 miembros aleatorios del grupo y los declara como los Amigos del Día',
    usage: '.amigorandom',
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

        if (filtered.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ Se necesitan al menos 2 participantes en el grupo para elegir a los amigos del día.'
            }, { quoted: m });
        }

        // Seleccionar 2 miembros aleatorios y distintos
        const shuffled = [...filtered].sort(() => Math.random() - 0.5);
        const amigo1 = shuffled[0];
        const amigo2 = shuffled[1];

        const frasesAmistad = [
            '¡El destino los ha unido hoy! Tienen que hablarse sí o sí. 🤝',
            'Una amistad indestructible acaba de nacer en este chat. 🫂',
            'Dicen que los verdaderos panas se conocen de formas misteriosas. ✨',
            'Etiqueta a tu nuevo mejor amigo y mándale un meme para sellar el pacto. 😂',
            '100% de compatibilidad en chismes, risas y desveladas. 🔥'
        ];

        const frase = frasesAmistad[Math.floor(Math.random() * frasesAmistad.length)];

        return await sock.sendMessage(jid, {
            text: [
                '╔══════════════════════════╗',
                '║   🤝  AMIGOS DEL DÍA    ║',
                '╚══════════════════════════╝',
                '',
                `✨ @${amigo1.split('@')[0]} y @${amigo2.split('@')[0]}`,
                '',
                `💬 *Decreto de Amistad:*`,
                `"${frase}"`,
                '',
                '🎉 ¡Felicidades a los nuevos amigos del grupo!',
                '_Unknown Codexツ</>_'
            ].join('\n'),
            mentions: [amigo1, amigo2]
        }, { quoted: m });
    }
};

