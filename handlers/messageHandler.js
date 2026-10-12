const { serialize } = require('../lib/serialize');
const { getCommand } = require('./commandLoader');
const database = require('../lib/database');
const groupSettings = require('../lib/groupSettings');
const acertijoManager = require('../lib/acertijo');
const triviaManager = require('../lib/trivia');
const akinatorManager = require('../lib/akinator');
const antilinkManager = require('../lib/antilink');
const logger = require('../lib/logger');
const config = require('../config');
const chalk = require('chalk');
const { checkGroupPermissions, cleanJid } = require('../lib/groupPermissions');
const bannedManager = require('../lib/banned');
const silenciadosManager = require('../lib/silenciados');
const rankManager = require('../lib/rank');
const logsManager = require('../lib/logs');
const roleplayEngine = require('../lib/roleplayEngine');
const personalidadEngine = require('../lib/personalidadEngine');
const debateEngine = require('../lib/debateEngine');

// Cache simple de metadatos de grupos con TTL de 30 segundos
const groupCache = new Map();
const getCachedGroupMetadata = async (sock, jid) => {
    const cached = groupCache.get(jid);
    const now = Date.now();
    if (cached && now - cached.timestamp < 30000) {
        return cached.data;
    }
    try {
        const metadata = await sock.groupMetadata(jid);
        groupCache.set(jid, { data: metadata, timestamp: now });
        return metadata;
    } catch (e) {
        return null;
    }
};


/**
 * Manejador principal de mensajes entrantes
 */
const handleMessage = async (sock, rawMsg) => {
    try {
        if (!rawMsg.message) return;
        if (rawMsg.key && rawMsg.key.remoteJid === 'status@broadcast') return;

        const m = serialize(sock, rawMsg);
        const hasMedia = Boolean(
            m.message?.imageMessage ||
            m.message?.videoMessage ||
            m.message?.audioMessage ||
            m.message?.stickerMessage ||
            m.message?.documentMessage
        );
        if (!m.body && !hasMedia) return;

        // Si el usuario está baneado, ignorar completamente todos sus mensajes
        if (bannedManager.isBanned(m.sender)) {
            return;
        }

        // Si el usuario está silenciado por el owner, ignorar todos sus mensajes
        if (silenciadosManager.isSilenciado(m.sender)) {
            return;
        }

        // Modo Ghost: simular desconexión e ignorar todo excepto .ghost stop
        if (global.ghostMode) {
            const prefix = database.getPrefix();
            const textBody = (m.body || '').trim().toLowerCase();
            const isGhostCommand = textBody.startsWith(`${prefix}ghost`) || textBody.startsWith(`${prefix}fantasma`);
            if (!isGhostCommand) {
                return;
            }
        }

        const isOwner = database.isOwner(m.sender) || Boolean(m.fromMe);
        const currentMode = database.getMode();

        // En modo privado, solo el dueño puede interactuar
        if (currentMode === 'private' && !isOwner) {
            return;
        }

        // Monitoreo de respuestas interactivas de .verdadoreto
        if (global.vdrEsperando && global.vdrEsperando[m.chat]) {
            const esperando = global.vdrEsperando[m.chat];
            const stanzaId = m.quoted?.id || m.message?.extendedTextMessage?.contextInfo?.stanzaId;
            const isReply = Boolean(stanzaId && stanzaId === esperando.msgId);

            const senderDigits = (m.sender || '').replace(/[^0-9]/g, '');
            const esperandoDigits = (esperando.jid || '').replace(/[^0-9]/g, '');
            const botDigits = (sock.user?.id || sock.user?.jid || '').replace(/[^0-9]/g, '');

            const senderMatches = Boolean(
                (senderDigits && esperandoDigits && (senderDigits === esperandoDigits || senderDigits.endsWith(esperandoDigits) || esperandoDigits.endsWith(senderDigits))) ||
                (m.fromMe && botDigits && esperandoDigits && (botDigits === esperandoDigits || botDigits.endsWith(esperandoDigits) || esperandoDigits.endsWith(botDigits))) ||
                (m.sender && esperando.jid && m.sender.split('@')[0].split(':')[0] === esperando.jid.split('@')[0].split(':')[0])
            );

            const esElElegido = senderMatches;
            const prefix = database.getPrefix();
            const isAnotherCommand = m.body && prefix && m.body.startsWith(prefix) &&
                !m.body.toLowerCase().startsWith(prefix + 'paso') &&
                !m.body.toLowerCase().startsWith(prefix + 'no');

            if ((esElElegido || isReply) && !isAnotherCommand) {
                const respuesta = (m.body || '').toLowerCase().trim();
                const hasEvidenceMedia = Boolean(
                    m.message?.imageMessage ||
                    m.message?.videoMessage ||
                    m.message?.audioMessage ||
                    m.message?.stickerMessage ||
                    m.message?.documentMessage
                );

                if (esperando.timer) clearTimeout(esperando.timer);
                delete global.vdrEsperando[m.chat];

                let emoji = '👀';
                let comentario = '';

                if (hasEvidenceMedia) {
                    emoji = '🎉';
                    comentario = '📸🎤 *¡RETO CUMPLIDO CON EVIDENCIA!* 💪🔥\n¡El participante no se acobardó y envió la prueba en vivo! ¡Respetos máximos del grupo!';
                } else if (respuesta.includes('paso') || respuesta.includes('no quiero') || respuesta === 'no' || respuesta.includes('ni loco') || respuesta.includes('pena')) {
                    emoji = '🐔';
                    comentario = '🐔 *¡SE ACOBARDÓ!* 🐔\n¡No tuvo el valor de cumplirlo! El grupo exige penitencia o que elija al siguiente.';
                } else if (respuesta.length > 50) {
                    emoji = '🍿';
                    comentario = '🍿 *¡QUÉ BOMBA ACABA DE SOLTAR!* 😱\n¡Confesión completa y sin filtros! El grupo entero ha quedado en shock.';
                } else if (respuesta.length < 10 && !hasEvidenceMedia) {
                    emoji = '😒';
                    comentario = '😒 *¡Qué respuesta tan tímida!* Pero bueno... al menos no se rajó.';
                } else if (
                    respuesta.includes('jaja') || respuesta.includes('lol') ||
                    respuesta.includes('jeje') || respuesta.includes('😂')
                ) {
                    emoji = '😂';
                    comentario = '😂 *¡Jajajajaja excelente respuesta!* ¡Qué buen sentido del humor!';
                } else if (
                    respuesta.includes('vergüenza') || respuesta.includes('verguenza') ||
                    respuesta.includes('ay') || respuesta.includes('😳')
                ) {
                    emoji = '😳';
                    comentario = '😳 *¡Trágame tierra!* Se sintió la vergüenza hasta el otro lado de la pantalla.';
                } else {
                    emoji = '✅';
                    comentario = '✅ *¡Respuesta registrada con éxito!* El juego continúa.';
                }

                try {
                    await sock.sendMessage(m.chat, {
                        react: { text: emoji, key: m.key }
                    });
                } catch (_) {}

                await sock.sendMessage(m.chat, {
                    text: `${comentario}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
                return;
            }
        }

        // Obtener metadatos y permisos en grupos usando el helper normalizado
        let groupMetadata = null;
        let participants = [];
        let groupAdmins = [];
        let isBotAdmin = false;
        let isAdmin = false;

        if (m.isGroup) {
            rankManager.increment(m.chat, m.sender);

            const cachedMeta = await getCachedGroupMetadata(sock, m.chat);
            const perms = await checkGroupPermissions(sock, m.chat, m.sender, cachedMeta);
            groupMetadata = perms.groupMetadata;
            participants = perms.participants;
            groupAdmins = perms.groupAdmins;
            isBotAdmin = perms.isBotAdmin;
            isAdmin = perms.isSenderAdmin || isOwner;

            // --- 1. FILTRO ANTIENLACES (ANTILINK CON EXPULSIÓN INMEDIATA) ---
            const isAntilinkActive = groupSettings.isAntilinkEnabled(m.chat) || antilinkManager.isEnabled(m.chat);
            if (isAntilinkActive && !isAdmin && !isOwner) {
                const linkRegex = /(?:chat\.whatsapp\.com\/(?:invite\/)?[0-9A-Za-z]{20,24}|wa\.me\/[0-9]+|(?:https?:\/\/|www\.)[^\s]+)/i;
                if (linkRegex.test(m.body)) {
                    // Borrar mensaje inmediatamente
                    await sock.sendMessage(m.chat, { delete: m.key });

                    // Expulsar al participante sin excepciones
                    try {
                        await sock.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
                    } catch (_) {}

                    // Notificación breve
                    await sock.sendMessage(m.chat, {
                        text: `⚠️ @${m.sender.split('@')[0]} fue eliminado automáticamente por enviar enlaces no autorizados.`,
                        mentions: [m.sender]
                    });
                    return; // No procesar más el mensaje con enlace
                }
            }

        }

        // --- COMPROBACIÓN DE JUEGOS ACTIVOS Y COMANDOS ---
        const prefix = database.getPrefix();
        if (!m.body.startsWith(prefix)) {
            // Test de Personalidad interactivo
            if (global.personalidadTest && global.personalidadTest[m.sender]) {
                const test = global.personalidadTest[m.sender];
                const respuesta = (m.body || '').toLowerCase().trim();

                if (['a', 'b', 'c'].includes(respuesta)) {
                    const emojisReaccion = { a: '🔴', b: '🔵', c: '🟢' };
                    try {
                        await sock.sendMessage(m.chat, {
                            react: { text: emojisReaccion[respuesta], key: m.key }
                        });
                    } catch (_) {}

                    test.respuestas.push(respuesta);
                    test.preguntaActual++;

                    const preguntas = test.preguntas || [];

                    if (test.preguntaActual < preguntas.length) {
                        const sig = preguntas[test.preguntaActual];
                        const num = test.preguntaActual + 1;
                        const total = preguntas.length;

                        await sock.sendMessage(m.chat, {
                            text: `✅ *Respuesta registrada*\n\n` +
                                  `━━━━━━━━━━━━━━━\n` +
                                  `🔹 *[ Pregunta ${num} de ${total} ]*\n\n` +
                                  `${sig.texto}\n\n` +
                                  `${sig.a}\n` +
                                  `${sig.b}\n` +
                                  `${sig.c}\n\n` +
                                  `━━━━━━━━━━━━━━━\n` +
                                  `_Responde con A, B o C (o .personalidad stop para cancelar)_\n\n` +
                                  `_Unknown Codexツ</>_`
                        }, { quoted: m });
                        return;
                    }

                    // Calcular resultado final con diagnóstico detallado
                    delete global.personalidadTest[m.sender];
                    const perfil = personalidadEngine.calcularPerfil(test.respuestas);

                    await sock.sendMessage(m.chat, {
                        text: `╔══════════════════╗\n` +
                              `║  🎭 *RESULTADO FINAL*  ║\n` +
                              `╚══════════════════╝\n\n` +
                              `${perfil.emoji} *${perfil.titulo}*\n` +
                              `🏷️ *Arquetipo:* ${perfil.tipo}\n` +
                              `🔮 *Elemento afín:* ${perfil.elemento}\n` +
                              `📺 *Aura de personaje:* ${perfil.anime}\n\n` +
                              `━━━━━━━━━━━━━━━\n` +
                              `📖 *Diagnóstico Psicológico:*\n_${perfil.descripcion}_\n\n` +
                              `✅ *Fortalezas Clave:*\n${perfil.fortalezas}\n\n` +
                              `⚠️ *Punto Ciego / Debilidad:*\n${perfil.debilidades}\n\n` +
                              `💡 *Consejo de Vida:*\n_${perfil.consejo}_\n\n` +
                              `━━━━━━━━━━━━━━━\n` +
                              `📊 *Desglose de Decisiones:*\n` +
                              `🔴 A (Acción/Liderazgo): ${perfil.porcentajes.a}%\n` +
                              `🔵 B (Ingenio/Estrategia): ${perfil.porcentajes.b}%\n` +
                              `🟢 C (Empatía/Sabiduría): ${perfil.porcentajes.c}%\n\n` +
                              `_Unknown Codexツ</>_`
                    }, { quoted: m });
                    return;
                }
            }

            // Debate interactivo con el bot (IA + Heurística avanzada con puntuación)
            if (global.debates && global.debates[m.sender]) {
                const debate = global.debates[m.sender];
                const argumentoUsuario = (m.body || '').trim();
                debate.rondas++;

                let respuesta = null;
                let reaccion = '🤔';
                let uScore = 65;
                let bScore = 80;

                const respIA = await debateEngine.generarContraargumentoIA(
                    debate.tema,
                    debate.posicion,
                    debate.rondas,
                    argumentoUsuario,
                    debate.historial || []
                );

                if (respIA) {
                    respuesta = respIA;
                    uScore = Math.floor(Math.random() * 20) + 75;
                    bScore = Math.floor(Math.random() * 15) + 82;
                    reaccion = argumentoUsuario.length > 80 ? '💪' : '🔥';
                } else {
                    const evalHeur = debateEngine.evaluarYContraargumentarHeuristico(
                        debate.tema,
                        debate.posicion,
                        debate.rondas,
                        argumentoUsuario
                    );
                    respuesta = evalHeur.texto;
                    uScore = evalHeur.scoreUsuario;
                    bScore = evalHeur.scoreBot;
                    reaccion = evalHeur.reaccion;
                }

                debate.userScore = (debate.userScore || 0) + uScore;
                debate.botScore = (debate.botScore || 0) + bScore;

                if (!debate.historial) debate.historial = [];
                debate.historial.push({ role: 'user', content: argumentoUsuario });
                debate.historial.push({ role: 'assistant', content: respuesta });

                try {
                    await sock.sendMessage(m.chat, {
                        react: { text: reaccion, key: m.key }
                    });
                } catch (_) {}

                if (debate.rondas >= 5) {
                    const finalUser = debate.userScore;
                    const finalBot = debate.botScore;
                    delete global.debates[m.sender];

                    let ganador = '';
                    let veredicto = '';

                    if (finalUser > finalBot) {
                        ganador = '¡Tú! 🏆';
                        veredicto = '¡Victoria del usuario! Tus argumentos y persistencia superaron los puntos del bot.';
                    } else if (finalUser === finalBot) {
                        ganador = '¡Empate Técnico! ⚖️';
                        veredicto = 'Ambos debatientes mantuvieron un nivel dialéctico supremo. Un choque de intelectos memorable.';
                    } else {
                        ganador = 'El Bot (Unsk1ngMD) 🤖';
                        veredicto = 'La defensa lógica y estructurada del bot logró inclinar la balanza final de los jueces.';
                    }

                    await sock.sendMessage(m.chat, {
                        text: `🗣️ *[Ronda Final 5/5]*\n\n` +
                              `${respuesta}\n\n` +
                              `╔══════════════════╗\n` +
                              `║  🏆 *VEREDICTO FINAL*  ║\n` +
                              `╚══════════════════╝\n\n` +
                              `📌 *Tema debatido:* ${debate.tema}\n` +
                              `👑 *Ganador Oficial:* ${ganador}\n\n` +
                              `━━━━━━━━━━━━━━━\n` +
                              `📊 *MARCADOR FINAL:*\n` +
                              `👤 Tú: *${finalUser} pts*\n` +
                              `🤖 Bot: *${finalBot} pts*\n\n` +
                              `⚖️ *Evaluación del Jurado:*\n_${veredicto}_\n\n` +
                              `_Unknown Codexツ</>_`
                    }, { quoted: m });
                    return;
                }

                await sock.sendMessage(m.chat, {
                    text: `🗣️ *[Ronda ${debate.rondas}/5]*\n\n` +
                          `${respuesta}\n\n` +
                          `━━━━━━━━━━━━━━━\n` +
                          `📊 *Puntos de ronda:* Tú: +${uScore} pts | Bot: +${bScore} pts\n` +
                          `_Escribe tu siguiente argumento o escribe .debatir stop para terminar_`
                }, { quoted: m });
                return;
            }

            // 0. Modo Roleplay activo para el usuario (Público y enriquecido)
            const rpKey = (global.roleplayMode && (
                global.roleplayMode[m.sender] ||
                global.roleplayMode[(m.sender || '').replace(/:\d+@/, '@')] ||
                (m.fromMe ? (global.roleplayMode[sock.user?.id] || global.roleplayMode[(sock.user?.id || '').replace(/:\d+@/, '@')]) : null)
            )) || null;

            if (rpKey) {
                const isMedia = Boolean(m.message?.imageMessage || m.message?.videoMessage || m.message?.stickerMessage || m.message?.audioMessage);
                const resp = await roleplayEngine.responderMensaje(rpKey, m.body, isMedia);

                try {
                    await sock.sendMessage(m.chat, {
                        react: { text: resp.emoji || '🎭', key: m.key }
                    });
                } catch (_) {}

                await sock.sendMessage(m.chat, {
                    text: `${resp.emoji} *[${resp.nombre}]:*\n\n${resp.texto}\n\n_Unknown Codexツ</>_`
                }, { quoted: m });
                return;
            }

            // 1. Comprobar si hay una partida de Akinator activa
            if (akinatorManager.hasActiveGame(m.chat)) {
                const processed = await akinatorManager.checkAnswer(sock, m);
                if (processed) return;
            }

            // 2. Comprobar si hay una trivia activa en el chat
            if (triviaManager.hasActiveGame(m.chat)) {
                const solved = await triviaManager.checkAnswer(sock, m);
                if (solved) return;
            }

            // 3. Comprobar si hay un acertijo activo en el chat
            if (acertijoManager.hasActiveGame(m.chat)) {
                await acertijoManager.checkAnswer(sock, m);
            }
            return;
        }

        const trimmed = m.body.slice(prefix.length).trim();
        if (!trimmed) return;

        // Comprobación de comandos compuestos (ej: "subbot list", "subbot stop")
        const words = trimmed.split(/\s+/);
        const twoWords = words.slice(0, 2).join(' ').toLowerCase();
        let cmd = getCommand(twoWords);
        let commandName = twoWords;
        let args = words.slice(2);
        let text = args.join(' ');

        if (!cmd) {
            commandName = words[0].toLowerCase();
            cmd = getCommand(commandName);
            args = words.slice(1);
            text = args.join(' ');
        }

        if (!cmd) return;

        // Comprobaciones de Permisos
        if (cmd.ownerOnly && !isOwner) {
            return await m.reply('❌ Este comando es exclusivo para el dueño del bot.');
        }

        if (cmd.groupOnly && !m.isGroup) {
            return await m.reply('❌ Este comando solo puede ser ejecutado dentro de un grupo.');
        }

        if (cmd.adminOnly && !isAdmin && !isOwner) {
            return await m.reply('❌ Este comando es exclusivo para administradores.');
        }

        if (cmd.botAdminRequired && !isBotAdmin) {
            return await m.reply('❌ Necesito ser administrador del grupo para cambiar la configuración.');
        }

        // Logger de Comandos en Consola (Terminal)
        const logTime = new Date().toLocaleTimeString('es-ES', { hour12: false });
        const chatType = m.isGroup ? 'GRUPO' : 'PRIVADO';
        const userName = m.pushName || 'Sin Nombre';
        const rawUserNum = (m.key.participant || m.key.remoteJid || '').split('@')[0].split(':')[0];
        const userNumber = rawUserNum.replace(/[^0-9]/g, '');
        const logArgs = `"${text || ''}"`;

        console.log(
            chalk.gray(`[${logTime}]`),
            chalk.cyan.bold(`[TIPO: ${chatType}]`),
            chalk.magenta.bold(`${prefix}${commandName}`),
            chalk.yellow(logArgs),
            chalk.white('por'),
            chalk.green.bold(userName),
            chalk.gray(`(+${userNumber})`)
        );
        database.incrementCommandCount();

        // Guardar en logs persistentes (logs.json)
        logsManager.addLog({
            usuario: (m.sender || '').replace('@s.whatsapp.net', '').split(':')[0],
            comando: `${prefix}${commandName}`,
            grupo: m.isGroup ? (groupMetadata?.subject || 'Grupo') : 'Privado',
            hora: new Date().toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo' })
        });

        // Ejecución segura
        try {
            await cmd.execute({
                sock,
                m,
                args,
                text,
                prefix,
                command: commandName,
                participants,
                groupAdmins,
                isBotAdmin,
                isAdmin,
                isOwner,
                groupMetadata
            });
        } catch (execErr) {
            logger.error(`Error ejecutando comando [${commandName}]:`, execErr);
            await m.reply(`❌ Ocurrió un error al procesar el comando: ${execErr.message || 'Error desconocido'}`);
        }

    } catch (err) {
        logger.error('Error general en handleMessage:', err);
    }
};

module.exports = {
    handleMessage
};

