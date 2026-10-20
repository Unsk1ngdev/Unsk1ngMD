'use strict';

module.exports = {
    name: 'debatir',
    alias: ['debate', 'discutir', 'polemica'],
    category: 'juegos',
    desc: 'Inicia un debate interactivo de 5 rondas con análisis de argumentos y puntuación',
    usage: '.debatir [tema] | .debatir stop',

    execute: async ({ sock, m, args, text, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!global.debates) global.debates = {};

        // Finalizar debate manualmente
        const sub = (args[0] || '').toLowerCase().trim();
        if (sub === 'stop' || sub === 'parar' || sub === 'cancelar' || sub === 'salir') {
            if (!global.debates[sender]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún debate activo.'
                }, { quoted: m });
            }
            delete global.debates[sender];
            return await sock.sendMessage(jid, {
                text: '✅ Debate finalizado anticipadamente.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const tema = text?.trim() || args.join(' ').trim();
        if (!tema) {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.debatir [tema]*\n' +
                      'Ejemplo: *.debatir la inteligencia artificial superará al ser humano*\n\n' +
                      '🛑 Usa *.debatir stop* para cancelar cuando quieras.'
            }, { quoted: m });
        }

        if (global.debates[sender]) {
            return await sock.sendMessage(jid, {
                text: '⚠️ Ya tienes un debate activo en curso.\n' +
                      `📌 Tema: *${global.debates[sender].tema}* [Ronda ${global.debates[sender].rondas}/5]\n\n` +
                      'Escribe tu argumento directamente o usa *.debatir stop* para cancelarlo.'
            }, { quoted: m });
        }

        const posicion = Math.random() < 0.5 ? 'favor' : 'contra';
        global.debates[sender] = {
            chat: jid,
            tema,
            posicion,
            rondas: 0,
            historial: [],
            userScore: 0,
            botScore: 0
        };

        const inicioFavor = [
            `Voy a sostener que *${tema}* es completamente acertado y necesario. Presentaré argumentos de peso para demostrar que cualquier oposición cae por su propio peso. ¿Listo para el reto? 💪`,
            `Asumo la defensa total de *${tema}*. Tengo evidencia y lógica para respaldarlo. Veamos si tus objeciones están a la altura de este debate. 🔥`,
            `Defenderé *${tema}* con firmeza. La historia y el progreso humano avalan esta postura. Te cedo la palabra para tu primer movimiento. ⚡`
        ];

        const inicioContra = [
            `Sostendré firmemente que *${tema}* es una postura equivocada con graves fallas estructurales. Demostraré punto por punto por qué no es sostenible. Te escucho. 😤`,
            `Estoy completamente en contra de *${tema}*. Los riesgos y consecuencias negativas son innegables. Intenta convencerme de lo contrario si tienes fundamentos sólidos. ❌`,
            `Me opongo categóricamente a *${tema}*. La teoría suena bien, pero la práctica y la realidad muestran un panorama completamente opuesto. Comienza cuando quieras. 😏`
        ];

        const inicios = posicion === 'favor' ? inicioFavor : inicioContra;
        const inicio = inicios[Math.floor(Math.random() * inicios.length)];

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  ⚔️ *DEBATE FORMAL INICIADO* ║\n` +
                  `╚══════════════════╝\n\n` +
                  `📌 *Tema:* ${tema}\n` +
                  `🤖 *Postura del Bot:* ${posicion === 'favor' ? '✅ A FAVOR' : '❌ EN CONTRA'}\n` +
                  `👤 *Tu Misión:* Defender la postura opuesta\n` +
                  `⏱️ *Duración:* 5 Rondas con puntuación\n\n` +
                  `━━━━━━━━━━━━━━━\n\n` +
                  `${inicio}\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `📢 *Ronda 1 de 5*\n` +
                  `_Escribe tu argumento directamente (sin comandos) para responder_\n` +
                  `_O escribe .debatir stop para rendirte_\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
