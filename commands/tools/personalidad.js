'use strict';

const personalidadEngine = require('../../lib/personalidadEngine');

module.exports = {
    name: 'personalidad',
    alias: ['testpersonalidad', 'perfiltest', 'mbti', 'test'],
    category: 'juegos',
    desc: 'Inicia un test interactivo de 6 preguntas dinámicas para descubrir tu arquetipo de personalidad profundo',
    usage: '.personalidad | .personalidad stop',

    execute: async ({ sock, m, args }) => {
        const jid = m.chat || m.key.remoteJid;
        const sender = m.sender;

        if (!global.personalidadTest) global.personalidadTest = {};

        const subCmd = (args[0] || '').toLowerCase().trim();
        if (subCmd === 'stop' || subCmd === 'cancelar' || subCmd === 'reiniciar') {
            if (!global.personalidadTest[sender]) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No tienes ningún test de personalidad activo.'
                }, { quoted: m });
            }
            delete global.personalidadTest[sender];
            return await sock.sendMessage(jid, {
                text: '✅ Test de personalidad cancelado. Puedes iniciar uno nuevo cuando quieras con *.personalidad*.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        if (global.personalidadTest[sender]) {
            const test = global.personalidadTest[sender];
            const pActual = test.preguntas[test.preguntaActual];
            return await sock.sendMessage(jid, {
                text: `⚠️ Ya tienes un test en progreso [Pregunta ${test.preguntaActual + 1} de ${test.preguntas.length}]:\n\n` +
                      `${pActual.texto}\n\n` +
                      `${pActual.a}\n${pActual.b}\n${pActual.c}\n\n` +
                      `_Responde con A, B o C (o escribe .personalidad stop para cancelar)_`
            }, { quoted: m });
        }

        // Seleccionar 6 preguntas dinámicas del banco de preguntas
        const preguntas = personalidadEngine.seleccionarPreguntas(6);

        global.personalidadTest[sender] = {
            chat: jid,
            preguntas,
            preguntaActual: 0,
            respuestas: []
        };

        const primera = preguntas[0];

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  🎭 *TEST DE PERSONALIDAD*  ║\n` +
                  `╚══════════════════╝\n\n` +
                  `Descubre tu arquetipo psicológico respondiendo con sinceridad.\n` +
                  `📍 *Total:* 6 preguntas situacionales.\n` +
                  `💡 *Cómo responder:* Escribe únicamente *A*, *B* o *C*.\n` +
                  `🛑 Usa *.personalidad stop* si deseas cancelar.\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `1️⃣ *[ Pregunta 1 de 6 ]*\n\n` +
                  `${primera.texto}\n\n` +
                  `${primera.a}\n` +
                  `${primera.b}\n` +
                  `${primera.c}\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `_Responde con A, B o C_\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};
