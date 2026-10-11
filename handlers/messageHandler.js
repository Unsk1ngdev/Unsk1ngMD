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
        if (!m.body) return;

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

        const isOwner = database.isOwner(m.sender);
        const currentMode = database.getMode();

        // En modo privado, solo el dueño puede interactuar
        if (currentMode === 'private' && !isOwner) {
            return;
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
            // 0. Modo Roleplay activo para el usuario
            if (global.roleplayMode && global.roleplayMode[m.sender]) {
                const personaje = global.roleplayMode[m.sender];
                const respuestas = {
                    naruto: ['¡Dattebayo! 🍥', '¡Nunca me rindo, ese es mi camino ninja!', '¡Seré Hokage algún día! 🍥'],
                    goku: ['¡Kamehameha! 💥', '¡Me encanta pelear contra alguien fuerte!', '¡Esto me pone emocionado! 🔥'],
                    vegeta: ['Soy el Príncipe de los Saiyajins.', '¡Eres demasiado débil para enfrentarme!', '¡FINAL FLASH! 💥'],
                    sasuke: ['...', '¡Solo vivo para la venganza!', 'Eres demasiado débil.'],
                    luffy: ['¡Seré el Rey de los Piratas! ⚓', '¡Tengo hambre! 🍖', '¡Gomu Gomu no...! 🤜'],
                    zoro: ['¿Dónde estoy? Me perdí de nuevo... 🗡️', 'Un corte más.', 'Santoryu... Ogi! ⚔️'],
                    gojo: ['Lamentablemente eres demasiado débil para mí.', '¡Infinity! ∞', 'Soy el más fuerte. 😎'],
                    levi: ['Eres un idiota de primera clase.', 'La elección que no te arrepentirás. ⚔️', '...Tch.'],
                    saitama: ['Un golpe. 👊', '¿Por qué no siento nada?', 'Está bien. 😐'],
                    light: ['¡Soy KIRA! ✍️', 'Este mundo necesita ser purificado.', 'Según lo planeado. 😏'],
                    tanjiro: ['¡Respiración del agua! 💧', '¡Protegeré a todos!', '¡Nezuko! 🌸'],
                    zenitsu: ['¡Tengo miedo! ⚡', '¡Nezuko-chaaan! 🌸⚡', '¡Por favor sálvenme! 😭'],
                    eren: ['¡Los destruiré a todos! ⚔️', '¡Tatakae! ¡Tatakae! 🔥', 'La libertad está más allá de las murallas.'],
                    deku: ['¡Smash! 💥', '¡Tengo que esforzarme aún más!', '¡Seré el héroe número uno! 💚'],
                    bakugo: ['¡SHINEEE! 💥', '¡Muérete, nerd!', '¡Yo seré el número uno! 🧨']
                };

                const cleanPersonaje = (personaje || '').toLowerCase();
                const respuestasList = respuestas[cleanPersonaje] || [`Soy ${personaje} y estoy aquí. ⚔️`];
                const respuesta = respuestasList[Math.floor(Math.random() * respuestasList.length)];

                await sock.sendMessage(m.chat, {
                    text: `*[${personaje}]:* ${respuesta}`
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

