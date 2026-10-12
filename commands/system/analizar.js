'use strict';

const database = require('../../lib/database');

module.exports = {
    name: 'analizar',
    alias: ['scanuser', 'perfilpsico'],
    category: 'sistema',
    desc: 'Genera un divertido y dramático análisis cuántico/psicológico de un usuario (solo owner)',
    usage: '.analizar @usuario',
    ownerOnly: true,

    execute: async ({ sock, m, args, isOwner }) => {
        if (!isOwner && !database.isOwner(m.sender)) return;

        const jid = m.chat || m.key.remoteJid;
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;

        let target = mentioned[0] || quotedParticipant;

        if (!target && args[0]) {
            const raw = args[0].replace(/[^0-9]/g, '');
            if (raw.length >= 7) {
                target = `${raw}@s.whatsapp.net`;
            }
        }

        if (!target || target === 'undefined@s.whatsapp.net') {
            return await sock.sendMessage(jid, {
                text: '❌ Uso: *.analizar @usuario*\n' +
                      'O responde a un mensaje del usuario con *.analizar*'
            }, { quoted: m });
        }

        const numero = target.replace('@s.whatsapp.net', '').split(':')[0];

        await sock.sendMessage(jid, {
            text: `🔬 Analizando a @${numero}...\n🔄 Procesando datos...`,
            mentions: [target]
        }, { quoted: m });

        await new Promise(r => setTimeout(r, 1500));

        // Datos aleatorios divertidos
        const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const randArr = arr => arr[Math.floor(Math.random() * arr.length)];

        const nivelPeligro = rand(0, 100);
        const probabilidadTraicion = rand(0, 100);
        const actividadSospechosa = rand(0, 100);
        const iq = rand(50, 200);
        const nivelChisme = rand(0, 100);
        const probabilidadExito = rand(0, 100);

        const personalidades = [
            'Caos Controlado 🌪️',
            'Agente Doble Encubierto 🕵️',
            'Líder Silencioso 👑',
            'Saboteador Experto 😈',
            'Héroe Sin Capa 🦸',
            'Villano en Potencia 😤',
            'Observador Peligroso 👁️',
            'Manipulador Nato 🎭',
            'Aliado Impredecible ⚡',
            'Mente Criminal Brillante 🧠'
        ];

        const predicciones = [
            'Intentará tomar el control del grupo en los próximos 7 días.',
            'Está planeando algo que nadie espera. Cuidado.',
            'Pronto revelará información clasificada del grupo.',
            'Tiene aliados secretos que nadie conoce aún.',
            'Su próximo movimiento será completamente inesperado.',
            'Está recopilando información de todos los miembros del grupo.',
            'Tiene un plan maestro que lleva meses ejecutando en silencio.',
            'Pronto pedirá algo que nadie querrá dar.'
        ];

        const diagnosticos = [
            'Comportamiento errático pero calculado.',
            'Alto nivel de inteligencia emocional oculta.',
            'Patrón de comunicación típico de un líder nato.',
            'Señales claras de doble personalidad detectadas.',
            'Actividad neuronal inusualmente alta en momentos clave.',
            'Capacidad de manipulación por encima del promedio.',
            'Tendencias caóticas mezcladas con momentos de genialidad.'
        ];

        const emojiPeligro = nivelPeligro > 75 ? '🔴' : nivelPeligro > 40 ? '🟡' : '🟢';
        const emojiTraicion = probabilidadTraicion > 75 ? '💀' : probabilidadTraicion > 40 ? '⚠️' : '✅';

        await sock.sendMessage(jid, {
            text: `╔══════════════════╗\n` +
                  `║  🔬 *ANÁLISIS OFICIAL*  ║\n` +
                  `╚══════════════════╝\n\n` +
                  `👤 Sujeto: @${numero}\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `📊 *RESULTADOS:*\n\n` +
                  `${emojiPeligro} *Nivel de peligro:* ${nivelPeligro}%\n` +
                  `${emojiTraicion} *Prob. traición:* ${probabilidadTraicion}%\n` +
                  `🕵️ *Actividad sospechosa:* ${actividadSospechosa}%\n` +
                  `🧠 *Coeficiente intelectual:* ${iq}\n` +
                  `🗣️ *Nivel de chisme:* ${nivelChisme}%\n` +
                  `🎯 *Prob. de éxito:* ${probabilidadExito}%\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `🎭 *Personalidad detectada:*\n` +
                  `_${randArr(personalidades)}_\n\n` +
                  `🔍 *Diagnóstico:*\n` +
                  `_${randArr(diagnosticos)}_\n\n` +
                  `🔮 *Predicción:*\n` +
                  `_${randArr(predicciones)}_\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `⚠️ _Análisis generado con IA cuántica v4.2_\n` +
                  `_Precisión: ${rand(85, 99)}.${rand(1, 9)}%_\n\n` +
                  `_Unknown Codexツ</>_`,
            mentions: [target]
        });
    }
};

