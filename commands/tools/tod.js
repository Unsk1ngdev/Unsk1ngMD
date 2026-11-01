'use strict';

const userNames = require('../../lib/userNames');

const TRUTH_QUESTIONS = [
    '¿Cuál es la mentira más grande que le has dicho a tus padres sin que se enteren?',
    '¿Alguna vez has revisado el teléfono de tu pareja o de un amigo a escondidas?',
    '¿Quién de este grupo te parece la persona más atractiva físicamente?',
    '¿Qué es lo más vergonzoso que te ha pasado en una cita o con alguien que te gustaba?',
    '¿Alguna vez has tenido un crush o te ha gustado alguien prohibido de este grupo o de tu entorno?',
    '¿Qué es lo más raro o turbio que has buscado en Google en el último mes?',
    '¿Alguna vez te has hecho el dormido para evitar hablar con alguien?',
    'Si tuvieras que eliminar a una persona de este grupo para siempre, ¿a quién elegirías?',
    '¿Cuál es tu placer culposo más vergonzoso que nadie sabe?',
    '¿Alguna vez has fingido una enfermedad o emergencia para no ir a un compromiso?'
];

const DARE_CHALLENGES = [
    'Envía un audio cantando el coro de tu canción favorita a todo pulmón en este grupo.',
    'Envía una captura de pantalla de las últimas 3 personas con las que hablaste en WhatsApp.',
    'Ponte de foto de perfil durante 1 hora una foto graciosa que elija el grupo.',
    'Declárale tu amor en una nota de voz a la tercera persona en tu lista de chats recientes.',
    'Escribe en tu estado de WhatsApp: "Me caso la próxima semana y todos están invitados" por 30 minutos.',
    'Haz 15 sentadillas o 10 flexiones y envía un video corto como prueba.',
    'Envía un mensaje a tu ex o a tu crush diciendo "Soñé contigo anoche" y muestra captura de la respuesta.',
    'Habla con acento extranjero o robótico en los próximos 3 audios que envíes al grupo.',
    'Confiesa cuál es la foto más vergonzosa que tienes en tu galería y compártela.'
];

function cleanPhone(jid) {
    if (!jid) return '';
    return String(jid).replace(/:.*@/, '@').split('@')[0].replace(/[^0-9]/g, '');
}

/**
 * Resuelve el identificador limpio, teléfono y nombre de usuario legible
 */
function resolveParticipant(p) {
    if (!p) return { jid: '', phone: '', tag: '@participante' };

    let phone = '';
    const rawId = (p.id || '').replace(/:\d+@/, '@');

    if (rawId.endsWith('@s.whatsapp.net')) {
        phone = rawId.split('@')[0].replace(/[^0-9]/g, '');
    } else if (p.phoneNumber || p.phone_number) {
        phone = String(p.phoneNumber || p.phone_number).replace(/[^0-9]/g, '');
    } else if (p.jid && p.jid.endsWith('@s.whatsapp.net')) {
        phone = p.jid.split('@')[0].replace(/[^0-9]/g, '');
    } else if (rawId.endsWith('@lid')) {
        const fromLid = userNames.getPhoneFromLid(rawId);
        if (fromLid) phone = fromLid.replace(/[^0-9]/g, '');
    }

    const realJid = phone ? `${phone}@s.whatsapp.net` : rawId;
    const directName = p.notify || p.name || p.verifiedName || null;
    let savedName = directName || userNames.get(realJid) || userNames.get(rawId) || null;

    // Si tiene un nombre guardado legible (no solo números)
    let tag = '';
    if (phone) {
        // En WhatsApp, @<teléfono> con mentions vincula el contacto clicable oficial
        if (savedName && savedName !== 'Alguien' && savedName !== 'Usuario' && !/^@?[0-9]+$/.test(savedName)) {
            tag = `@${phone} (${savedName})`;
        } else {
            tag = `@${phone}`;
        }
    } else if (savedName && savedName !== 'Alguien' && savedName !== 'Usuario' && !/^@?[0-9]+$/.test(savedName)) {
        tag = savedName.startsWith('@') ? savedName : `@${savedName}`;
    } else {
        tag = '@participante';
    }

    return {
        jid: realJid,
        rawId,
        phone,
        tag
    };
}

module.exports = {
    name: 'tod',
    alias: ['girarabotella', 'botella', 'spinthebottle', 'truthordare'],
    category: 'juegos',
    desc: 'Simula el juego de la botella de Verdad o Reto: gira la botella y elige a un miembro del grupo al azar para desafiarlo',
    usage: '.tod [girar] | .tod verdad [pregunta] | .tod reto [desafío]',
    groupOnly: true,

    execute: async ({ sock, m, args, groupMetadata }) => {
        const jid = m.chat;
        const sub = (args && args[0] ? args[0] : '').toLowerCase().trim();

        // 1. Pregunta directa de Verdad
        if (['verdad', 'truth', 'v'].includes(sub)) {
            const question = TRUTH_QUESTIONS[Math.floor(Math.random() * TRUTH_QUESTIONS.length)];
            await m.react?.('🤫');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🤫 VERDAD OBLIGATORIA 》 ❐',
                    '┃',
                    `┃├◆ ❓ *Pregunta:*`,
                    `┃  "${question}"`,
                    '┃',
                    '┃├◆ ⚠️ ¡Prohibido mentir o esquivar la respuesta!',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 2. Desafío directo de Reto
        if (['reto', 'dare', 'desafio', 'r'].includes(sub)) {
            const dare = DARE_CHALLENGES[Math.floor(Math.random() * DARE_CHALLENGES.length)];
            await m.react?.('🔥');
            return await sock.sendMessage(jid, {
                text: [
                    '┏❐ 《 🔥 RETO EXTREMO 》 ❐',
                    '┃',
                    `┃├◆ 🎯 *Tu Misión:*`,
                    `┃  "${dare}"`,
                    '┃',
                    '┃├◆ ⏳ Tienes 5 minutos para cumplirlo y enviar la evidencia al grupo.',
                    '┗❐\n',
                    '_Unknown Codexツ</>_'
                ].join('\n')
            }, { quoted: m });
        }

        // 3. Girar la botella y elegir a alguien al azar
        let metadata = groupMetadata;
        if (!metadata) {
            try {
                metadata = await sock.groupMetadata(jid);
            } catch (_) {}
        }

        const participants = metadata?.participants || [];
        const botJid = sock.user?.id || sock.user?.jid || '';
        const botPhone = cleanPhone(botJid);

        // Filtrar participantes descartando al propio bot
        const validCandidates = participants.filter(p => {
            const phone = cleanPhone(p.id);
            return phone && phone !== botPhone;
        });

        if (validCandidates.length === 0) {
            return await sock.sendMessage(jid, {
                text: '❌ No se encontraron suficientes participantes en el grupo para girar la botella.'
            }, { quoted: m });
        }

        const chosen = validCandidates[Math.floor(Math.random() * validCandidates.length)];
        const chosenUser = resolveParticipant(chosen);

        // Lista de menciones para que WhatsApp enlace el contacto
        const mentions = Array.from(new Set([chosenUser.jid, chosenUser.rawId])).filter(Boolean);

        await m.react?.('🍾');

        const message = [
            '┏❐ 《 🍾 GIRA LA BOTELLA - VERDAD O RETO 》 ❐',
            '┃',
            '┃ 🍾 💫 *La botella comienza a girar velozmente...*',
            '┃ 🌀 *Gira... gira... va perdiendo velocidad...*',
            '┃',
            `┃ 👉 *¡LA PUNTA SE DETIENE Y APUNTA A:*`,
            `┃ 🎯 *${chosenUser.tag}*`,
            '┃',
            `┃├◆ ¡Te ha tocado, *${chosenUser.tag}*!`,
            '┃  Debes elegir inmediatamente tu destino:',
            '┃',
            '┃  👉 Escribe: `.tod verdad` (Para responder una pregunta)',
            '┃  👉 Escribe: `.tod reto` (Para cumplir un desafío)',
            '┗❐\n',
            '_Unknown Codexツ</>_'
        ].join('\n');

        await sock.sendMessage(jid, {
            text: message,
            mentions
        }, { quoted: m });
    }
};
