'use strict';

const nsfwManager = require('../../lib/nsfw');
const userNames = require('../../lib/userNames');

const DINAMICAS = [
    'Dominación salvaje y desenfrenada ⛓️🔥',
    'Noche de hotel sin descanso hasta el amanecer 🏨💦',
    'Tóxicos en el chat, pero en la cama se entienden al 100% 🥵',
    'Contra la pared sin tiempo de llegar a la habitación 🚪💋',
    'Furia y gemidos que despertaron al edificio completo 🔊💥',
    'Caricias prohibidas en el asiento trasero del auto 🚗🔥',
    'Sesión ardiente con aceite y velas aromáticas 🕯️💦',
    'Pasión prohibida que ninguno de los dos podrá negar jamás 🤫😈'
];

const LUGARES_PROHIBIDOS = [
    'En el baño del segundo piso durante una fiesta familiar',
    'En el balcón a las 3:30 AM desafiando a los vecinos de enfrente',
    'En el asiento trasero de un Uber con vidrios polarizados',
    'En las escaleras de emergencia de un centro comercial',
    'En la cocina sobre la meseta de mármol a oscuras',
    'En la playa bajo las palmeras con el sonido de las olas de fondo'
];

const POSICIONES_FAVORITAS = [
    'El helicóptero invertido sin frenos',
    'Estilo perrita salvaje con jalón de cabello incluido',
    'Misionero ultra profundo con miradas fijas y susurros sucios',
    'Ella arriba dominando el ritmo sin pedir permiso',
    'De pie contra la pared levantándola de las caderas',
    'La carretilla acrobática olímpica'
];

const RELATOS = [
    'bastó que cruzaran miradas en el pasillo para que se encerraran con pestillo. No hubo palabras bonitas ni romance: ropa rasgada en el suelo, marcas de uñas en la espalda y dos horas de sudor y jadeos incontrolables.',
    'empezaron diciendo "solo vamos a hablar cinco minutos" y terminaron enredados entre las sábanas sin saber qué hora era. Se devoraron con tanta hambre que la cama terminó corrida dos metros de su lugar.',
    'tienen una química tan tóxica y caliente que cada vez que están solos el termómetro revienta. Él no aguantó las ganas y la agarró fuerte; ella no puso ninguna resistencia y le pidió que no parara.',
    'no pudieron esperar a llegar a una cama. La adrenalina del momento los llevó al límite, con caricias agresivas, gemidos contenidos con la mano para no hacer ruido y un final épico que los dejó temblando.',
    'demostraron que cuando el deseo manda, la decencia se va de vacaciones. Una noche desenfrenada donde no quedó rincón de la habitación sin ser testigo de lo que hicieron.'
];

module.exports = {
    name: 'shipnsfw',
    alias: ['shiphot', 'parejahot', 'ship18'],
    category: 'nsfw',
    desc: '[+18] Versión adulta del ship con compatibilidad íntima y descripción picante',
    usage: '.shipnsfw [@user1] [@user2]',
    groupOnly: true,

    execute: async ({ sock, m, groupMetadata, participants }) => {
        const chat = m.chat || m.key?.remoteJid;

        // 1. Verificación obligatoria de modo NSFW activo en el grupo
        if (!nsfwManager.isNsfwEnabled(chat)) {
            return await sock.sendMessage(chat, {
                text: [
                    '*[❗] 𝐋𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬 +𝟏𝟖 𝐞𝐬𝐭𝐚́𝐧 𝐝𝐞𝐬𝐚𝐜𝐭𝐢𝐯𝐚𝐝𝐨𝐬 𝐞𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨.*',
                    '> Usa *.nsfw on* para activarlos.'
                ].join('\n')
            }, { quoted: m });
        }

        const botJid = (sock.user?.id || sock.user?.jid || '').split(':')[0] + '@s.whatsapp.net';
        const sender = (m.sender || '').replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net';

        // 2. Extraer menciones
        const mentioned = m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const cleanMentioned = mentioned
            .map(j => j.replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net')
            .filter(j => j && j !== botJid);

        let user1 = null;
        let user2 = null;

        if (cleanMentioned.length >= 2) {
            user1 = cleanMentioned[0];
            user2 = cleanMentioned[1];
        } else if (cleanMentioned.length === 1) {
            user1 = sender;
            user2 = cleanMentioned[0];
        } else if (m.quoted?.sender) {
            user1 = sender;
            user2 = m.quoted.sender.replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net';
        } else {
            // Seleccionar 2 participantes aleatorios del grupo
            let membersList = participants || groupMetadata?.participants || [];
            if (!membersList.length) {
                try {
                    const meta = await sock.groupMetadata(chat);
                    membersList = meta?.participants || [];
                } catch (_) {}
            }

            const validPool = membersList
                .map(p => (p.id || '').replace(/:\d+/, '').split('@')[0] + '@s.whatsapp.net')
                .filter(id => id && id !== botJid);

            if (validPool.length < 2) {
                return await sock.sendMessage(chat, {
                    text: '❌ Debes mencionar a 2 usuarios para armar el ship: `.shipnsfw @user1 @user2`'
                }, { quoted: m });
            }

            const shuffled = [...validPool].sort(() => Math.random() - 0.5);
            user1 = shuffled[0];
            user2 = shuffled[1];
        }

        if (user1 === user2) {
            return await sock.sendMessage(chat, {
                text: '❌ No puedes shippear a una persona consigo misma en versión +18. Menciona a dos personas distintas.'
            }, { quoted: m });
        }

        try {
            await m.react('🔞');
        } catch (_) {}

        const u1Phone = user1.split('@')[0];
        const u2Phone = user2.split('@')[0];
        const u1Name = userNames.get(user1) || `@${u1Phone}`;
        const u2Name = userNames.get(user2) || `@${u2Phone}`;

        // Cálculo determinista o aleatorio de compatibilidad íntima
        const compatibilidad = Math.floor(Math.random() * 41) + 60; // 60% a 100% de candela
        const dinamica = DINAMICAS[Math.floor(Math.random() * DINAMICAS.length)];
        const lugar = LUGARES_PROHIBIDOS[Math.floor(Math.random() * LUGARES_PROHIBIDOS.length)];
        const posicion = POSICIONES_FAVORITAS[Math.floor(Math.random() * POSICIONES_FAVORITAS.length)];
        const relatoBase = RELATOS[Math.floor(Math.random() * RELATOS.length)];

        // Barra de fuego visual
        const blocks = 10;
        const filled = Math.round((compatibilidad / 100) * blocks);
        const empty = blocks - filled;
        const fireBar = '🔥'.repeat(filled) + '░'.repeat(empty);

        const finalText = [
            '╔══════════════════════════╗',
            '║  🔞  *SHIP +18 / CANDELA PURA* 🔞  ║',
            '╚══════════════════════════╝',
            '',
            `👩‍❤️‍💋‍👨 *Pareja En Celo:* @${u1Phone} ✖️ @${u2Phone}`,
            '',
            `🔥 *Nivel de Lujuria & Pasión:* ${compatibilidad}%`,
            `[${fireBar}]`,
            '',
            `🏷️ *Dinámica Secreta:*`,
            `> ${dinamica}`,
            '',
            `📍 *Lugar Favorito Para Escaparse:*`,
            `> _${lugar}_`,
            '',
            `🔞 *Posición Preferida:*`,
            `> *${posicion}*`,
            '',
            '📝 *Relato de una Noche Juntos:*',
            `_"Entre @${u1Phone} y @${u2Phone} ${relatoBase}"_`,
            '',
            '⚠️ *Diagnóstico Forense:*',
            '_Si estos dos se quedan solos en una habitación con la luz apagada, los bomberos tendrán que apagar el incendio._ 💦',
            '',
            '━━━━━━━━━━━━━━━━━━━━━━',
            '_Unknown Codexツ</>_'
        ].join('\n');

        return await sock.sendMessage(chat, {
            text: finalText,
            mentions: [user1, user2]
        }, { quoted: m });
    }
};

