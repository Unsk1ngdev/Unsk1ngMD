'use strict';

const fs = require('fs-extra');
const path = require('path');

const torneoPath = path.join(process.cwd(), 'torneo.json');

const initTorneo = () => {
    try {
        if (!fs.existsSync(torneoPath)) {
            fs.writeJsonSync(torneoPath, {}, { spaces: 2 });
        }
    } catch (_) {}
};

initTorneo();

const loadTorneos = () => {
    try {
        if (!fs.existsSync(torneoPath)) {
            initTorneo();
            return {};
        }
        return fs.readJsonSync(torneoPath);
    } catch (_) {
        return {};
    }
};

const saveTorneos = (data) => {
    try {
        fs.writeJsonSync(torneoPath, data, { spaces: 2 });
    } catch (_) {}
};

module.exports = {
    name: 'torneo',
    alias: ['tournament', 'bracket'],
    category: 'grupo',
    desc: 'Crea y gestiona un torneo de eliminación entre miembros del grupo (Admins)',
    usage: '.torneo @user1 @user2 ... | .torneo ver | .torneo next',
    groupOnly: true,

    execute: async ({ sock, m, args, isAdmin, isOwner }) => {
        const jid = m.chat || m.key.remoteJid;

        if (!isOwner && !isAdmin) {
            return await sock.sendMessage(jid, {
                text: '❌ Solo los administradores del grupo pueden gestionar torneos.\n\n_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        const subCmd = (args[0] || '').toLowerCase().trim();
        const torneoData = loadTorneos();

        // 1. Ver torneo actual
        if (subCmd === 'ver' || subCmd === 'bracket') {
            const torneo = torneoData[jid];
            if (!torneo || !torneo.rondas || torneo.rondas.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay ningún torneo activo en este grupo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const ronda = torneo.rondas[torneo.rondaActual] || [];
            const bracket = ronda.map((match, i) =>
                `⚔️ Partido ${i + 1}:\n` +
                `   🔵 ${match.jugador1}\n` +
                `   VS\n` +
                `   🔴 ${match.jugador2 || 'BYE'}`
            ).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `🏆 *TORNEO - Ronda ${torneo.rondaActual + 1}*\n\n` +
                      `${bracket}\n\n` +
                      `Usa *.torneo next* para avanzar de ronda.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 2. Avanzar ronda
        if (subCmd === 'next' || subCmd === 'siguiente') {
            const torneo = torneoData[jid];
            if (!torneo || !torneo.rondas || torneo.rondas.length === 0) {
                return await sock.sendMessage(jid, {
                    text: '⚠️ No hay torneo activo en este grupo.\n\n_Unknown Codexツ</>_'
                }, { quoted: m });
            }

            const rondaActual = torneo.rondas[torneo.rondaActual];
            const ganadores = [];

            let resultados = `⚔️ *Resultados Ronda ${torneo.rondaActual + 1}*\n\n`;

            for (const match of rondaActual) {
                if (!match.jugador2 || match.jugador2 === 'BYE') {
                    ganadores.push(match.jugador1);
                    resultados += `🏆 ${match.jugador1} avanza (BYE)\n\n`;
                } else {
                    const ganador = Math.random() < 0.5 ? match.jugador1 : match.jugador2;
                    const perdedor = ganador === match.jugador1 ? match.jugador2 : match.jugador1;
                    ganadores.push(ganador);
                    resultados += `🔵 ${match.jugador1} VS 🔴 ${match.jugador2}\n` +
                                 `🏆 Ganador: *${ganador}*\n` +
                                 `💀 Eliminado: *${perdedor}*\n\n`;
                }
            }

            if (ganadores.length === 1) {
                delete torneoData[jid];
                saveTorneos(torneoData);
                return await sock.sendMessage(jid, {
                    text: `${resultados}\n` +
                          `🏆 *¡CAMPEÓN DEL TORNEO!*\n\n` +
                          `👑 *${ganadores[0]}* es el ganador absoluto!\n\n` +
                          `_Unknown Codexツ</>_`
                }, { quoted: m });
            }

            // Crear siguiente ronda
            const siguienteRonda = [];
            for (let i = 0; i < ganadores.length; i += 2) {
                siguienteRonda.push({
                    jugador1: ganadores[i],
                    jugador2: ganadores[i + 1] || 'BYE'
                });
            }

            torneo.rondaActual++;
            torneo.rondas.push(siguienteRonda);
            torneoData[jid] = torneo;
            saveTorneos(torneoData);

            const bracket = siguienteRonda.map((match, i) =>
                `⚔️ Partido ${i + 1}:\n` +
                `   🔵 ${match.jugador1}\n` +
                `   VS\n` +
                `   🔴 ${match.jugador2}`
            ).join('\n\n');

            return await sock.sendMessage(jid, {
                text: `${resultados}\n` +
                      `🏆 *Ronda ${torneo.rondaActual + 1}*\n\n` +
                      `${bracket}\n\n` +
                      `Usa *.torneo next* para continuar.\n\n` +
                      `_Unknown Codexツ</>_`
            }, { quoted: m });
        }

        // 3. Crear nuevo torneo
        const mentioned = m.mentionedJid || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length < 2) {
            return await sock.sendMessage(jid, {
                text: '❌ Menciona al menos a 2 participantes.\n' +
                      'Ejemplo: *.torneo @user1 @user2 @user3 @user4*\n\n' +
                      '_Unknown Codexツ</>_'
            }, { quoted: m });
        }

        // Mezclar participantes aleatoriamente
        const participantes = [...mentioned]
            .map(j => '+' + j.replace('@s.whatsapp.net', '').split(':')[0])
            .sort(() => Math.random() - 0.5);

        // Crear primera ronda
        const primeraRonda = [];
        for (let i = 0; i < participantes.length; i += 2) {
            primeraRonda.push({
                jugador1: participantes[i],
                jugador2: participantes[i + 1] || 'BYE'
            });
        }

        torneoData[jid] = {
            rondaActual: 0,
            rondas: [primeraRonda]
        };
        saveTorneos(torneoData);

        const bracket = primeraRonda.map((match, i) =>
            `⚔️ Partido ${i + 1}:\n` +
            `   🔵 ${match.jugador1}\n` +
            `   VS\n` +
            `   🔴 ${match.jugador2}`
        ).join('\n\n');

        await sock.sendMessage(jid, {
            text: `🏆 *TORNEO CREADO*\n\n` +
                  `👥 Participantes: *${participantes.length}*\n\n` +
                  `━━━━━━━━━━━━━━━\n` +
                  `⚔️ *Ronda 1*\n` +
                  `━━━━━━━━━━━━━━━\n\n` +
                  `${bracket}\n\n` +
                  `Usa *.torneo next* para ver resultados.\n` +
                  `Usa *.torneo ver* para ver el bracket.\n\n` +
                  `_Unknown Codexツ</>_`
        }, { quoted: m });
    }
};

